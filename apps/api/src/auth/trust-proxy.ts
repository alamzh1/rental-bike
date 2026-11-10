import type { NestExpressApplication } from '@nestjs/platform-express';

// Express `trust proxy` (история 86): за обратным прокси req.ip берётся из X-Forwarded-For только от доверенного прокси.
// TRUST_PROXY — значение для Express: пусто = 'loopback' (прокси на той же машине), число — сколько прокси перед API,
// true/false, либо список адресов/подсетей через запятую.
export type TrustProxy = boolean | number | string;

export function trustProxySetting(env: { TRUST_PROXY?: string } = process.env): TrustProxy {
  const v = (env.TRUST_PROXY ?? '').trim();
  if (!v) return 'loopback';
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

export function applyTrustProxy(app: NestExpressApplication, env: { TRUST_PROXY?: string } = process.env): NestExpressApplication {
  app.set('trust proxy', trustProxySetting(env));
  return app;
}
