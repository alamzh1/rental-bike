// CORS: API принимает запросы браузера только со своих адресов (MINIAPP_URL, ADMIN_URL), в разработке — ещё с localhost.
// Запросы без Origin (бот, webhook, трекеры, curl) браузерной защиты не касаются.

type Callback = (err: Error | null, allow?: boolean) => void;

export function corsAllowed(origin: string | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!origin) return true;
  const own = [env.MINIAPP_URL, env.ADMIN_URL, env.API_PUBLIC_URL].filter(Boolean).map((u) => (u as string).replace(/\/$/, ''));
  if (own.includes(origin)) return true;
  if (env.NODE_ENV !== 'development' && env.NODE_ENV !== 'test') return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function corsOrigin(env: NodeJS.ProcessEnv = process.env) {
  return (origin: string | undefined, cb: Callback): void => cb(null, corsAllowed(origin, env));
}
