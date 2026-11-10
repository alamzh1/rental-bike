// Правила публичного запуска с Mac (pnpm public) — чистые функции, тесты в public-env.test.mjs.
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const TUNNEL_NAME = 'rental-bike';
export const PUBLIC_PORTS = { miniapp: 4173, admin: 4174 };
const SECRETS = ['JWT_SECRET', 'ADMIN_SESSION_SECRET', 'FILES_SIGNING_SECRET', 'PAYMENT_KEYS_SECRET'];
const DOMAIN_RE = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/;

export function hostsFor(domain) {
  const d = domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(d)) throw new Error(`Некорректный домен: ${domain}`);
  return { app: `app.${d}`, admin: `admin.${d}` };
}

/** Что дописать в .env перед публикацией: адреса, режим входа и недостающие секреты (случайные, нигде не печатаются). */
export function publicEnvPatch(env, hosts) {
  const patch = {};
  if (hosts) {
    patch.MINIAPP_URL = `https://${hosts.app}`;
    patch.API_PUBLIC_URL = `https://${hosts.app}`;
    patch.ADMIN_URL = `https://${hosts.admin}`;
  }
  if (env.DEV_AUTH !== '0' && env.DEV_AUTH !== 'local') patch.DEV_AUTH = 'local';
  for (const name of SECRETS) if (!env[name] || env[name].startsWith('dev-only-')) patch[name] = randomBytes(32).toString('hex');
  return patch;
}

/** Причины не открывать приложение в интернет. Пустой список — можно запускать. */
export function publicEnvProblems(env) {
  const out = [];
  if (env.DEV_AUTH !== '0' && env.DEV_AUTH !== 'local') out.push('DEV_AUTH должен быть 0 или local: иначе любой войдёт администратором');
  for (const name of SECRETS) if (!env[name] || env[name].startsWith('dev-only-')) out.push(`${name} пуст или стандартный: подпись сессий можно подделать`);
  for (const name of ['MINIAPP_URL', 'ADMIN_URL', 'API_PUBLIC_URL']) {
    if (!/^https:\/\/[^/]+$/.test(env[name] ?? '') || env[name].includes('trycloudflare.com')) out.push(`${name} должен быть постоянным адресом https://…`);
  }
  if (!env.TELEGRAM_BOT_TOKEN) out.push('TELEGRAM_BOT_TOKEN пуст: без него не войти через Telegram');
  if (!env.TELEGRAM_BOT_USERNAME) out.push('TELEGRAM_BOT_USERNAME пуст');
  return out;
}

/** Заменяет или дописывает строки KEY=value; остальной файл, включая комментарии, не меняется. */
export function updateEnvText(text, patch) {
  let out = text.endsWith('\n') || !text ? text : `${text}\n`;
  for (const [key, value] of Object.entries(patch)) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    out = line.test(out) ? out.replace(line, () => `${key}=${value}`) : `${out}${key}=${value}\n`;
  }
  return out;
}

/** Настройки туннеля: документация API наружу не отдаётся, остальное — приложение и админка. */
export function tunnelConfig({ tunnelId, credentialsFile, hosts }) {
  return `tunnel: ${tunnelId}
credentials-file: ${credentialsFile}
ingress:
  - hostname: ${hosts.app}
    path: ^/api/docs
    service: http_status:404
  - hostname: ${hosts.admin}
    path: ^/api/docs
    service: http_status:404
  - hostname: ${hosts.app}
    service: http://localhost:${PUBLIC_PORTS.miniapp}
  - hostname: ${hosts.admin}
    service: http://localhost:${PUBLIC_PORTS.admin}
  - service: http_status:404
`;
}

/** Политика страниц приложения. Встроенные скрипты разрешены по хешу, внешний — только вход через Telegram. */
export function pageCsp(html) {
  const hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map((m) => `'sha256-${createHash('sha256').update(m[1]).digest('base64')}'`);
  return [
    "default-src 'self'",
    `script-src 'self' https://telegram.org ${hashes.join(' ')}`.trim(),
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' data: https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https:",
    'frame-src https://oauth.telegram.org',
    "frame-ancestors 'self' https://*.telegram.org",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Vite preview за туннелем: только https и защитные заголовки. Telegram в браузере открывает приложение во фрейме, поэтому ему frame-ancestors разрешён. */
export function httpsOnlyPreview() {
  return {
    name: 'https-only-preview',
    configurePreviewServer(server) {
      let csp = '';
      try {
        csp = pageCsp(readFileSync(resolve(server.config.root, server.config.build.outDir, 'index.html'), 'utf8'));
      } catch {
        // сборки ещё нет: vite preview сам сообщит об этом
      }
      server.middlewares.use(httpsOnlyMiddleware);
      server.middlewares.use((req, res, next) => {
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
        // Форма списка байков — отдельная страница со встроенным скриптом, данных приложения в ней нет
        if (csp && !(req.url ?? '').startsWith('/danh-sach-xe.html')) res.setHeader('Content-Security-Policy', csp);
        next();
      });
    },
  };
}

export function httpsOnlyMiddleware(req, res, next) {
  const proto = req.headers['x-forwarded-proto'];
  if (proto === 'http') {
    res.writeHead(301, { Location: `https://${req.headers.host}${req.url}` });
    res.end();
    return;
  }
  if (proto === 'https') res.setHeader('Strict-Transport-Security', 'max-age=31536000');
  next();
}
