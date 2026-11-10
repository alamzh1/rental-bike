import { defineConfig, devices } from '@playwright/test';
import { E2E } from './ports.mjs';

// `pnpm e2e`: поднимает API (e2e/serve-api.mjs — своя БД, тестовая оплата) и Mini App (Vite, DEV_AUTH=1),
// гоняет сценарии на 360 px. Скриншоты для проверки языков и тем — e2e/screenshots/.
export default defineConfig({
  testDir: './tests',
  outputDir: './.output/results',
  fullyParallel: false,
  workers: 1, // сценарии делят одного тестового клиента и одну БД
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [['list'], ['html', { outputFolder: './.output/report', open: 'never' }]],
  use: {
    baseURL: `http://localhost:${E2E.miniappPort}`,
    ...devices['Pixel 5'],
    viewport: { width: 360, height: 780 },
    locale: 'ru-RU',
    timezoneId: 'Asia/Ho_Chi_Minh',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'miniapp-360', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command: 'node e2e/serve-api.mjs',
      cwd: '..',
      url: `http://localhost:${E2E.apiPort}/api/health`,
      timeout: 180_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
    {
      command: `pnpm --filter @rental/miniapp exec vite --port ${E2E.miniappPort} --strictPort`,
      cwd: '..',
      url: `http://localhost:${E2E.miniappPort}`,
      env: { API_PORT: String(E2E.apiPort), DEV_AUTH: '1' },
      timeout: 60_000,
      reuseExistingServer: false,
      stdout: 'ignore',
      stderr: 'pipe',
    },
  ],
});
