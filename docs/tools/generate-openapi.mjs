#!/usr/bin/env node
// `pnpm openapi`: собирает API (если нет dist) и пишет docs/openapi.json из маршрутов NestJS через @nestjs/swagger.
// Сервер не запускается и в БД ничего не пишется: создаётся контейнер модулей, читаются контроллеры.
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { applyEnv } from '../../scripts/env-defaults.mjs';

applyEnv();
process.env.JOBS_DRIVER ||= 'memory';
const root = new URL('../../', import.meta.url).pathname;
const apiDir = `${root}apps/api/`;
const out = `${root}docs/openapi.json`;

if (process.argv.includes('--build') || !existsSync(`${apiDir}dist/main.js`)) {
  const r = spawnSync('pnpm', ['--filter', '@rental/api', 'build'], { cwd: root, stdio: 'inherit' });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

const require = createRequire(`${apiDir}package.json`);
require('reflect-metadata');
const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
const { AppModule } = require(`${apiDir}dist/app.module.js`);
const { configureApp } = require(`${apiDir}dist/app.setup.js`);

const app = configureApp(await NestFactory.create(AppModule, { logger: ['error'], abortOnError: false }));
const config = new DocumentBuilder()
  .setTitle('Аренда Байка API')
  .setDescription('REST API Mini App, режима менеджера и админки. Ошибки — { code, message }; типы ответов — packages/shared/src/api/*.ts.')
  .setVersion('0.1.0')
  .addBearerAuth()
  .addCookieAuth('admin_session')
  .build();
const document = SwaggerModule.createDocument(app, config);
writeFileSync(out, `${JSON.stringify(document, null, 2)}\n`);
console.log(`[openapi] ${Object.keys(document.paths).length} путей → docs/openapi.json`);
await app.close();
process.exit(0);
