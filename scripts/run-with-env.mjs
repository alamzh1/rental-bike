#!/usr/bin/env node
// Запускает команду с переменными из .env и dev-значениями по умолчанию.
// Пример: node scripts/run-with-env.mjs prisma migrate dev
import { spawn } from 'node:child_process';
import { applyEnv } from './env-defaults.mjs';

applyEnv();
const [cmd, ...args] = process.argv.slice(2);
if (!cmd) {
  console.error('usage: run-with-env <command> [...args]');
  process.exit(2);
}
const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
