import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { devDefaults } from '../../scripts/env-defaults.mjs';
import { httpsOnlyPreview, PUBLIC_PORTS } from '../../scripts/public-env.mjs';

// В бандл попадают только адрес API — никаких секретов. Имя бота и флаг dev-входа админка берёт из GET /admin/auth/config.
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), ''), ...process.env };
  const dev = mode !== 'production';
  const apiPort = env.API_PORT || (dev ? devDefaults.API_PORT : '') || '3000';
  // dev — через прокси Vite (cookie сессии same-origin); prod — API_PUBLIC_URL, если API на другом домене.
  const apiBase = dev ? '/api' : `${(env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/api`;
  // Постоянный туннель (pnpm public): собранная админка пускает только хост из ADMIN_URL.
  const publicHost = URL.canParse(env.ADMIN_URL ?? '') ? new URL(env.ADMIN_URL!).hostname : '';

  const proxy = { '/api': { target: `http://127.0.0.1:${apiPort}`, changeOrigin: true } };

  return {
    plugins: [react(), httpsOnlyPreview()],
    // Одна копия React: карта подгружается отдельным чанком, и react-leaflet иначе получает свою
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }, dedupe: ['react', 'react-dom'] },
    optimizeDeps: { include: ['leaflet', 'react-leaflet'] },
    define: { __API_BASE__: JSON.stringify(apiBase) },
    server: {
      port: 5174,
      host: 'localhost',
      proxy,
    },
    preview: { port: PUBLIC_PORTS.admin, strictPort: true, host: 'localhost', allowedHosts: publicHost && publicHost !== 'localhost' ? [publicHost] : [], proxy },
    build: { target: 'es2020' },
  };
});
