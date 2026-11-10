import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

// Проверка Telegram Login Widget (вход в веб-админку):
// data_check_string — все поля, кроме hash, «key=value» по алфавиту через \n; ключ HMAC — SHA256(bot_token).
// https://core.telegram.org/widgets/login#checking-authorization

export const LOGIN_MAX_AGE_SEC = 24 * 60 * 60;
/** Допуск на расхождение часов при auth_date из будущего */
const CLOCK_SKEW_SEC = 5 * 60;

export type LoginWidgetFailure = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED';

export class LoginWidgetError extends Error {
  constructor(readonly reason: LoginWidgetFailure) {
    super(`Login Widget data rejected: ${reason}`);
  }
}

export interface LoginWidgetUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  photoUrl: string | null;
  authDate: Date;
}

const str = (v: string | undefined): string | null => (v ? v : null);

export function verifyLoginWidget(data: unknown, botToken: string, now: Date = new Date()): LoginWidgetUser {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new LoginWidgetError('MALFORMED');
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
    if (v === undefined || v === null) continue;
    if (typeof v !== 'string' && typeof v !== 'number') throw new LoginWidgetError('MALFORMED');
    fields[k] = String(v);
  }
  const { hash, ...rest } = fields;
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash) || !rest.id || !/^\d+$/.test(rest.id) || !rest.auth_date) throw new LoginWidgetError('MALFORMED');

  const dcs = Object.keys(rest)
    .sort()
    .map((k) => `${k}=${rest[k]}`)
    .join('\n');
  const secret = createHash('sha256').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dcs).digest();
  const given = Buffer.from(hash, 'hex');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw new LoginWidgetError('BAD_SIGNATURE');

  const authSec = Number(rest.auth_date);
  const nowSec = Math.floor(now.getTime() / 1000);
  if (!Number.isFinite(authSec) || nowSec - authSec > LOGIN_MAX_AGE_SEC || authSec - nowSec > CLOCK_SKEW_SEC) throw new LoginWidgetError('EXPIRED');

  return {
    id: rest.id,
    firstName: str(rest.first_name),
    lastName: str(rest.last_name),
    username: str(rest.username),
    photoUrl: str(rest.photo_url),
    authDate: new Date(authSec * 1000),
  };
}
