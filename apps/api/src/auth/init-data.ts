import { createHmac, timingSafeEqual } from 'node:crypto';

// Проверка Telegram.WebApp.initData (ТЗ §10.3): HMAC-SHA256 ключом бота, auth_date не старше 24 ч.
// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app

export const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60;

export type InitDataFailure = 'MALFORMED' | 'BAD_SIGNATURE' | 'EXPIRED';

export class InitDataError extends Error {
  constructor(readonly reason: InitDataFailure) {
    super(`initData rejected: ${reason}`);
  }
}

export interface TelegramUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  languageCode: string | null;
  photoUrl: string | null;
}

export interface VerifiedInitData {
  user: TelegramUser;
  authDate: Date;
  startParam: string | null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function parseUser(raw: string | null): TelegramUser | null {
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as Record<string, unknown>;
    if (typeof u.id !== 'number' && typeof u.id !== 'string') return null;
    return {
      id: String(u.id),
      firstName: str(u.first_name),
      lastName: str(u.last_name),
      username: str(u.username),
      languageCode: str(u.language_code),
      photoUrl: str(u.photo_url),
    };
  } catch {
    return null;
  }
}

/** Бросает InitDataError, если подпись не сходится, строка неполная или auth_date старше maxAgeSec. */
export function verifyInitData(initData: string, botToken: string, now: Date = new Date(), maxAgeSec = INIT_DATA_MAX_AGE_SEC): VerifiedInitData {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) throw new InitDataError('MALFORMED');

  const dataCheckString = [...params.entries()]
    .filter(([key]) => key !== 'hash')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expected = createHmac('sha256', secret).update(dataCheckString).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, 'hex'))) throw new InitDataError('BAD_SIGNATURE');

  const authDateSec = Number(params.get('auth_date'));
  const user = parseUser(params.get('user'));
  if (!Number.isFinite(authDateSec) || authDateSec <= 0 || !user) throw new InitDataError('MALFORMED');
  const ageSec = now.getTime() / 1000 - authDateSec;
  if (ageSec > maxAgeSec) throw new InitDataError('EXPIRED');

  return { user, authDate: new Date(authDateSec * 1000), startParam: str(params.get('start_param')) };
}
