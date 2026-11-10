#!/usr/bin/env node
// pnpm public:setup <домен> — один раз: вход в Cloudflare, постоянный туннель, DNS-записи app. и admin., настройки .env.
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { hostsFor, publicEnvPatch, tunnelConfig, TUNNEL_NAME, updateEnvText } from './public-env.mjs';

const root = new URL('..', import.meta.url).pathname;
const envFile = join(root, '.env');
const dir = join(homedir(), '.cloudflared');

function fail(message) {
  console.error(`\n[public] ${message}\n`);
  process.exit(1);
}

const domain = process.argv[2];
if (!domain) fail('Укажи домен: pnpm public:setup твойдомен.ru');
let hosts;
try {
  hosts = hostsFor(domain);
} catch (e) {
  fail(e.message);
}
if (spawnSync('cloudflared', ['--version'], { stdio: 'ignore' }).error) fail('Нет cloudflared: brew install cloudflared');

if (!existsSync(join(dir, 'cert.pem'))) {
  console.log('[public] Откроется браузер: войди в Cloudflare и выбери этот домен.');
  if (spawnSync('cloudflared', ['tunnel', 'login'], { stdio: 'inherit' }).status !== 0) fail('Вход в Cloudflare не завершён.');
}

// Пока туннелей нет, cloudflared печатает null
const list = () => JSON.parse(execFileSync('cloudflared', ['tunnel', 'list', '--output', 'json'], { encoding: 'utf8' }) || '[]') ?? [];
let tunnel = list().find((t) => t.name === TUNNEL_NAME);
if (!tunnel) {
  if (spawnSync('cloudflared', ['tunnel', 'create', TUNNEL_NAME], { stdio: 'inherit' }).status !== 0) fail('Туннель не создан.');
  tunnel = list().find((t) => t.name === TUNNEL_NAME);
}
if (!tunnel) fail('Туннель создан, но не найден в списке.');
const credentialsFile = join(dir, `${tunnel.id}.json`);
if (!existsSync(credentialsFile)) fail(`Нет файла ключа туннеля ${credentialsFile}. Туннель создавали на другом компьютере?`);

// Без --overwrite-dns: существующая запись этого имени не будет заменена молча
for (const host of [hosts.app, hosts.admin]) {
  if (spawnSync('cloudflared', ['tunnel', 'route', 'dns', TUNNEL_NAME, host], { stdio: 'inherit' }).status !== 0) {
    fail(`Не получилось создать DNS-запись ${host}. Если такая запись уже есть, проверь её в панели Cloudflare: она используется чем-то другим?`);
  }
}

mkdirSync(dir, { recursive: true });
const configFile = join(dir, `${TUNNEL_NAME}.yml`);
writeFileSync(configFile, tunnelConfig({ tunnelId: tunnel.id, credentialsFile, hosts }));
if (spawnSync('cloudflared', ['tunnel', '--config', configFile, 'ingress', 'validate'], { stdio: 'inherit' }).status !== 0) fail('Настройки туннеля не прошли проверку.');

const text = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
writeFileSync(envFile, updateEnvText(text, publicEnvPatch(parseEnv(text), hosts)));
chmodSync(envFile, 0o600);

console.log(`
[public] Готово. Адреса:
  приложение: https://${hosts.app}
  админка:    https://${hosts.admin}

В @BotFather:
  1. /mybots → бот → Bot Settings → Menu Button → https://${hosts.app}
  2. /setdomain → бот → ${hosts.admin}

Запуск: pnpm public
`);
