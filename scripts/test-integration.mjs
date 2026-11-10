#!/usr/bin/env node
// Интеграционные тесты на настоящем PostgreSQL 16 из docker-compose:
// поднимает postgres, создаёт тестовую БД <POSTGRES_DB>_test, применяет миграции и запускает vitest.
import { execFileSync, spawnSync } from 'node:child_process';
import { applyEnv } from './env-defaults.mjs';

applyEnv();
const env = process.env;
const root = new URL('..', import.meta.url).pathname;
const apiDir = new URL('../apps/api', import.meta.url).pathname;

function fail(message) {
  console.error(`\n[integration] ${message}\n`);
  process.exit(1);
}

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', cwd: root, ...opts });
  return r.status === 0;
}

// 1. Docker и PostgreSQL
const docker = spawnSync('docker', ['info'], { stdio: 'ignore' });
if (docker.error || docker.status !== 0) {
  fail('PostgreSQL недоступен: Docker не запущен или не установлен. Запустите Docker и повторите `pnpm test:integration` (или задайте DATABASE_URL_TEST на доступный PostgreSQL 16).');
}
if (!run('docker', ['compose', 'up', '-d', '--wait', 'postgres'])) {
  fail('PostgreSQL недоступен: `docker compose up -d postgres` не поднял контейнер (см. вывод выше; проверьте, свободен ли порт POSTGRES_PORT).');
}

// 2. Тестовая БД
const testDb = new URL(env.DATABASE_URL_TEST).pathname.slice(1);
const exists = execFileSync(
  'docker',
  ['compose', 'exec', '-T', 'postgres', 'psql', '-U', env.POSTGRES_USER, '-d', 'postgres', '-tAc', `SELECT 1 FROM pg_database WHERE datname = '${testDb}'`],
  { cwd: root, encoding: 'utf8' },
).trim();
if (exists !== '1' && !run('docker', ['compose', 'exec', '-T', 'postgres', 'createdb', '-U', env.POSTGRES_USER, testDb])) {
  fail(`не удалось создать тестовую БД ${testDb}`);
}

// 3. Миграции и тесты
// Сценарии шлют сотни запросов с одного адреса; сам лимит проверяется в abuse-and-refunds.spec
const testEnv = { ...env, DATABASE_URL: env.DATABASE_URL_TEST, IP_RATE_LIMIT: 'off' };
if (!run('pnpm', ['exec', 'prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'], { cwd: apiDir, env: testEnv })) {
  fail('не удалось применить миграции к тестовой БД');
}
const vitestArgs = ['exec', 'vitest', 'run', '-c', 'vitest.integration.config.mts', ...process.argv.slice(2)];
process.exit(run('pnpm', vitestArgs, { cwd: apiDir, env: testEnv }) ? 0 : 1);
