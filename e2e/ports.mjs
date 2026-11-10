// Порты e2e отдельно от dev (3000 / 5173), чтобы прогон не мешал запущенному `pnpm dev`.
export const E2E = {
  apiPort: Number(process.env.E2E_API_PORT ?? 3100),
  miniappPort: Number(process.env.E2E_MINIAPP_PORT ?? 5183),
};
