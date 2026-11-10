import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { devDefaults } from '../../scripts/env-defaults.mjs';
import { httpsOnlyPreview, PUBLIC_PORTS } from '../../scripts/public-env.mjs';

// В бандл попадают только флаг DEV_AUTH, адрес API и имя бота — никаких секретов.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), ''), ...process.env };
  const dev = mode !== 'production';
  const pick = (name: keyof typeof devDefaults | 'TELEGRAM_BOT_USERNAME') =>
    env[name] || (dev ? (devDefaults as Record<string, string>)[name] : '') || '';
  const apiPort = pick('API_PORT') || '3000';
  // dev — через прокси Vite; prod — API_PUBLIC_URL, если API на другом домене.
  const apiBase = dev ? '/api' : `${(env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/api`;
  // Туннель для проверки в Telegram (docs/deploy.md): Vite пускает только хост из MINIAPP_URL.
  const tunnelHost = URL.canParse(env.MINIAPP_URL ?? '') ? new URL(env.MINIAPP_URL!).hostname : '';

  const proxy = { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } };

  return {
    plugins: [react(), httpsOnlyPreview()],
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
    define: {
      __DEV_AUTH__: JSON.stringify(pick('DEV_AUTH') === '1'),
      __API_BASE__: JSON.stringify(apiBase),
      __BOT_USERNAME__: JSON.stringify(pick('TELEGRAM_BOT_USERNAME')),
    },
    server: {
      port: 5173,
      host: 'localhost',
      allowedHosts: tunnelHost && tunnelHost !== 'localhost' ? [tunnelHost] : [],
      proxy,
    },
    preview: { port: PUBLIC_PORTS.miniapp, strictPort: true, host: 'localhost', allowedHosts: tunnelHost && tunnelHost !== 'localhost' ? [tunnelHost] : [], proxy },
    build: {
      target: 'es2020',
      manifest: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/entry-[hash].js',
          chunkFileNames: (chunk) => {
            const feature = /\/features\/([^/]+)\/index\.tsx$/.exec(chunk.facadeModuleId ?? '')?.[1];
            return feature ? `assets/feature-${feature}-[hash].js` : 'assets/[name]-[hash].js';
          },
        },
      },
    },
  };
});
