import { rateLimited } from '../bookings/errors';

// Общий лимит запросов с одного адреса: защищает то, что доступно без входа, и разгружает API при переборе.
// Счётчик в памяти процесса. Адрес — req.ip: за прокси его определяет trust proxy, заголовок клиента не подменит.

const WINDOW_MS = 60_000;
const MAX_TRACKED = 50_000;

type Req = { originalUrl?: string; method?: string; ip?: string; socket?: { remoteAddress?: string } };
type Res = { setHeader(name: string, value: string): unknown };

const LOGIN_POSTS = new Set(['/api/auth/telegram', '/api/admin/auth/telegram', '/api/admin/auth/webapp', '/api/admin/auth/dev', '/api/admin/auth/link']);

/** Лимит группы в минуту; null — без лимита: у webhook свои подписи и повторы, а фото каталога грузятся пачками. */
export function ipLimitOf(method: string, path: string): { bucket: string; limit: number } | null {
  if (path === '/api/health' || path.startsWith('/api/webhooks/') || path.startsWith('/api/telegram/') || path.startsWith('/api/files/public/')) return null;
  if (method === 'POST' && LOGIN_POSTS.has(path)) return { bucket: 'login', limit: 30 };
  // Страница входа опрашивает статус каждые 2 секунды
  if (path === '/api/admin/auth/link/status') return { bucket: 'login-status', limit: 90 };
  if (path === '/api/events') return { bucket: 'events', limit: 60 };
  // Traccar шлёт точки всех байков с одного адреса
  if (path.startsWith('/api/gps/')) return { bucket: 'gps', limit: 1200 };
  return { bucket: 'api', limit: 600 };
}

const windows = new Map<string, { count: number; resetAt: number }>();

function prune(now: number): void {
  for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k);
  if (windows.size > MAX_TRACKED) windows.clear();
}

export function ipRateLimit(req: Req, res: Res, next: () => void): void {
  if (process.env.IP_RATE_LIMIT === 'off') return next();
  const path = (req.originalUrl ?? '').split('?')[0]!.replace(/\/+$/, '').toLowerCase();
  const rule = ipLimitOf((req.method ?? 'GET').toUpperCase(), path);
  if (!rule) return next();
  const now = Date.now();
  if (windows.size > MAX_TRACKED) prune(now);
  const key = `${rule.bucket}:${req.ip ?? req.socket?.remoteAddress ?? '?'}`;
  let w = windows.get(key);
  if (!w || w.resetAt <= now) windows.set(key, (w = { count: 0, resetAt: now + WINDOW_MS }));
  if (++w.count > rule.limit) {
    res.setHeader('Retry-After', String(Math.ceil((w.resetAt - now) / 1000)));
    throw rateLimited();
  }
  next();
}
