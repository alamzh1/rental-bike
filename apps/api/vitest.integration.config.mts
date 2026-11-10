import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Интеграционные тесты на настоящем PostgreSQL. Запуск: pnpm test:integration из корня
// (scripts/test-integration.mjs поднимает postgres из compose и применяет миграции к тестовой БД).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    include: ['test/integration/**/*.spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
