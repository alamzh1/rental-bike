#!/usr/bin/env node
// API для e2e: отдельная БД <POSTGRES_DB>_e2e (сбрасывается и засевается при каждом запуске),
// свой порт, очереди в памяти, тестовый провайдер оплаты, сообщения бота — в лог.
// Переменные — через scripts/env-defaults.mjs (NODE_ENV=development, DEV_AUTH=1).
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { applyEnv } from '../scripts/env-defaults.mjs';
import { E2E } from './ports.mjs';

applyEnv();
const env = process.env;
const root = new URL('..', import.meta.url).pathname;
const apiDir = new URL('../apps/api', import.meta.url).pathname;

const pg = `postgresql://${env.POSTGRES_USER}:${env.POSTGRES_PASSWORD}@localhost:${env.POSTGRES_PORT}`;
const e2eDb = `${env.POSTGRES_DB}_e2e`;
const apiEnv = {
  ...env,
  NODE_ENV: 'development',
  DEV_AUTH: '1',
  DATABASE_URL: `${pg}/${e2eDb}?schema=public`,
  API_PORT: String(E2E.apiPort),
  API_PUBLIC_URL: `http://localhost:${E2E.apiPort}`,
  MINIAPP_URL: `http://localhost:${E2E.miniappPort}`,
  JOBS_DRIVER: 'memory',
  IP_RATE_LIMIT: 'off',
  // Никаких внешних действий из e2e: без токена бота — LogNotifier, без ключей payOS — TestProvider.
  TELEGRAM_BOT_TOKEN: '',
  PAYOS_CLIENT_ID: '',
  PAYOS_API_KEY: '',
  PAYOS_CHECKSUM_KEY: '',
  SENTRY_DSN: '',
};

function fail(message) {
  console.error(`\n[e2e] ${message}\n`);
  process.exit(1);
}
const run = (cmd, args, opts = {}) => spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts }).status === 0;

if (!run('docker', ['compose', 'up', '-d', '--wait', 'postgres'])) fail('PostgreSQL не поднялся: запустите Docker и повторите `pnpm e2e`.');

const exists = execFileSync(
  'docker',
  ['compose', 'exec', '-T', 'postgres', 'psql', '-U', env.POSTGRES_USER, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname = '${e2eDb}'`],
  { cwd: root, encoding: 'utf8' },
).trim();
if (exists !== '1' && !run('docker', ['compose', 'exec', '-T', 'postgres', 'createdb', '-U', env.POSTGRES_USER, e2eDb])) fail(`не удалось создать БД ${e2eDb}`);

// Сброс + миграции + сид: каждый прогон начинается с «нового клиента».
if (!run('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force', '--skip-generate'], { cwd: apiDir, env: apiEnv })) fail('не удалось применить миграции и сид к e2e-БД');

// Сид отмечает тестового клиента прошедшим онбординг; e2e проверяет путь именно нового клиента.
const newClientSql = `UPDATE users SET onboarded_at = NULL, phone = NULL, license_category = NULL WHERE telegram_id = '100000001'`;
if (!run('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', env.POSTGRES_USER, '-d', e2eDb, '-c', newClientSql], { stdio: 'ignore' })) fail('не удалось сбросить тестового клиента');

// Сборка при каждом запуске: устаревший dist/ проверял бы не тот код, что в исходниках.
if (!run('pnpm', ['--filter', '@rental/api', 'build']) || !existsSync(`${apiDir}/dist/main.js`)) fail('не удалось собрать API');

const child = spawn(process.execPath, ['--enable-source-maps', 'dist/main.js'], { cwd: apiDir, env: apiEnv, stdio: 'inherit' });
const stop = () => child.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));
