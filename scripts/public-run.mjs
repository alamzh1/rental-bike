#!/usr/bin/env node
// pnpm public — собирает приложение и открывает его тестерам через постоянный туннель. Ctrl+C останавливает всё.
// --no-tunnel: без выхода в интернет (проверка на этой машине). --env-file=<путь>: другой файл настроек.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { applyEnv } from './env-defaults.mjs';
import { PUBLIC_PORTS, publicEnvProblems, TUNNEL_NAME, updateEnvText } from './public-env.mjs';

const root = new URL('..', import.meta.url).pathname;
const noTunnel = process.argv.includes('--no-tunnel');
const envArg = process.argv.find((a) => a.startsWith('--env-file='))?.slice('--env-file='.length);
const configFile = join(homedir(), '.cloudflared', `${TUNNEL_NAME}.yml`);

function fail(message) {
  console.error(`\n[public] ${message}\n`);
  process.exit(1);
}

if (envArg) Object.assign(process.env, parseEnv(readFileSync(envArg, 'utf8')));
// Проверяем сам файл, до подстановки значений разработки: они подменили бы пустые секреты и DEV_AUTH
const fileEnv = { ...parseEnv(existsSync(join(root, '.env')) && !envArg ? readFileSync(join(root, '.env'), 'utf8') : ''), ...(envArg ? parseEnv(readFileSync(envArg, 'utf8')) : {}) };
// .env, настроенный до появления ключей оплаты точек: секрет создаётся один раз и больше не меняется, иначе сохранённые ключи не расшифровать
if (!envArg && existsSync(join(root, '.env')) && (!fileEnv.PAYMENT_KEYS_SECRET || fileEnv.PAYMENT_KEYS_SECRET.startsWith('dev-only-'))) {
  fileEnv.PAYMENT_KEYS_SECRET = randomBytes(32).toString('hex');
  writeFileSync(join(root, '.env'), updateEnvText(readFileSync(join(root, '.env'), 'utf8'), { PAYMENT_KEYS_SECRET: fileEnv.PAYMENT_KEYS_SECRET }));
  process.env.PAYMENT_KEYS_SECRET = fileEnv.PAYMENT_KEYS_SECRET;
}
const problems = publicEnvProblems(fileEnv).filter((p) => !(noTunnel && p.startsWith('TELEGRAM')));
if (problems.length) fail(`Запуск остановлен:\n  - ${problems.join('\n  - ')}\n\nСначала выполни: pnpm public:setup твойдомен.ru`);
applyEnv();
if (process.env.NODE_ENV === 'production') fail('NODE_ENV=production: этот запуск рассчитан на тестовую оплату.');

const apiPort = Number(process.env.API_PORT);
for (const port of [apiPort, PUBLIC_PORTS.miniapp, PUBLIC_PORTS.admin]) {
  const busy = spawnSync('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'], { encoding: 'utf8' }).stdout.trim();
  if (busy) fail(`Порт ${port} занят (процесс ${busy.split('\n')[0]}). Останови pnpm dev или старый запуск и повтори.`);
}
if (!noTunnel && !existsSync(configFile)) fail('Туннель не настроен. Выполни: pnpm public:setup твойдомен.ru');

function run(cmd, args, extraEnv = {}) {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...extraEnv } });
  if (r.status !== 0) fail(`Не выполнилось: ${cmd} ${args.join(' ')}`);
}

console.log('[public] База и Redis…');
run('docker', ['compose', 'up', '-d', '--wait', 'postgres', 'redis', 'backup']);
run('pnpm', ['--filter', '@rental/api', 'exec', 'prisma', 'migrate', 'deploy']);
const models = execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', process.env.POSTGRES_USER, '-d', process.env.POSTGRES_DB, '-tAc', 'select count(*) from bike_models'], { cwd: root, encoding: 'utf8' }).trim();
// Как в production: тестовые менеджер и админ в открытом доступе не нужны
if (models === '0') run('pnpm', ['--filter', '@rental/api', 'exec', 'tsx', 'prisma/seed.ts'], { NODE_ENV: 'production' });

console.log('[public] Сборка…');
run('pnpm', ['build:packages']);
// Относительный /api и рабочая сборка React; тестовый вход в бандл не попадает
for (const app of ['@rental/miniapp', '@rental/admin']) run('pnpm', ['--filter', app, 'build'], { API_PUBLIC_URL: '', NODE_ENV: 'production' });
run('pnpm', ['--filter', '@rental/api', 'build']);

// Сайт открыт в интернет: бесплатно подтверждать брони могут только сотрудники и тестеры из TEST_PAY_TELEGRAM_IDS
process.env.RESTRICT_TEST_PAYMENTS = '1';
process.env.API_DOCS = 'off';

const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill('SIGTERM');
  setTimeout(() => process.exit(code), 500);
}
function start(name, cmd, args, opts = {}) {
  const c = spawn(cmd, args, { cwd: root, stdio: 'inherit', env: process.env, ...opts });
  c.on('exit', (code) => {
    if (stopping) return;
    console.error(`\n[public] ${name} остановился (код ${code}). Останавливаю всё.\n`);
    stop(1);
  });
  children.push(c);
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

start('API', 'node', ['dist/main.js'], { cwd: join(root, 'apps/api') });
start('Mini App', 'pnpm', ['--filter', '@rental/miniapp', 'exec', 'vite', 'preview']);
start('админка', 'pnpm', ['--filter', '@rental/admin', 'exec', 'vite', 'preview']);

let healthy = false;
for (let i = 0; i < 60 && !healthy && !stopping; i++) {
  await new Promise((r) => setTimeout(r, 1000));
  healthy = await fetch(`http://localhost:${PUBLIC_PORTS.miniapp}/api/health`).then((r) => r.ok, () => false);
}
if (!healthy) {
  console.error('\n[public] API не ответил за минуту.\n');
  stop(1);
} else if (!stopping) {
  if (noTunnel) {
    console.log(`\n[public] Без туннеля: http://localhost:${PUBLIC_PORTS.miniapp} и http://localhost:${PUBLIC_PORTS.admin}\n`);
  } else {
    start('туннель', 'cloudflared', ['tunnel', '--config', configFile, 'run']);
    console.log(`\n[public] Открыто для тестеров:\n  приложение: ${process.env.MINIAPP_URL}\n  админка:    ${process.env.ADMIN_URL}\n  вход на этом Mac: http://localhost:${PUBLIC_PORTS.admin}\nCtrl+C — остановить.\n`);
  }
  // Mac не засыпает, пока работает этот процесс
  if (process.platform === 'darwin') spawn('caffeinate', ['-dims', '-w', String(process.pid)], { stdio: 'ignore' }).unref();
}
