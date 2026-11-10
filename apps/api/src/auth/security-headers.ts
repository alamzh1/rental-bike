// Защитные заголовки ответов API. Файлы и договор открываются прямо в браузере, поэтому CSP им не ставится: она ломает просмотр PDF.

type Req = { originalUrl?: string };
type Res = { setHeader(name: string, value: string): unknown };

const hasOwnViewer = (path: string) => path.startsWith('/api/files/') || path.startsWith('/api/docs') || /^\/api\/bookings\/[^/]+\/contract$/.test(path);

export function securityHeaders(req: Req, res: Res, next: () => void): void {
  const path = (req.originalUrl ?? '').split('?')[0]!.toLowerCase();
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  if (!hasOwnViewer(path)) res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  next();
}
