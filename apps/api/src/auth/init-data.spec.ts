import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { InitDataError, verifyInitData } from './init-data';

// Алгоритм из документации Telegram (core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app):
// secret = HMAC_SHA256(key="WebAppData", bot_token); hash = hex(HMAC_SHA256(secret, data_check_string)),
// data_check_string — пары key=value кроме hash, по алфавиту, через \n. Токен — тестовый, не секрет.
const BOT_TOKEN = '123456:test-bot-token';
const NOW = new Date('2026-11-10T12:00:00Z');
const nowSec = Math.floor(NOW.getTime() / 1000);
const user = { id: 777000111, first_name: 'Анна', last_name: 'K', username: 'anna', language_code: 'ru' };

function sign(fields: Record<string, string>, token = BOT_TOKEN): string {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

const fields = (authDate: number) => ({
  auth_date: String(authDate),
  query_id: 'AAHdF6IQAAAAAN0XohDhrOrc',
  user: JSON.stringify(user),
  start_param: 'booking_abc',
});

const reason = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof InitDataError ? e.reason : `other: ${String(e)}`;
  }
  return 'accepted';
};

describe('verifyInitData', () => {
  it('принимает подписанный ключом бота initData и отдаёт пользователя', () => {
    const r = verifyInitData(sign(fields(nowSec - 60)), BOT_TOKEN, NOW);
    expect(r.user).toMatchObject({ id: '777000111', firstName: 'Анна', username: 'anna', languageCode: 'ru' });
    expect(r.startParam).toBe('booking_abc');
    expect(r.authDate.toISOString()).toBe(new Date((nowSec - 60) * 1000).toISOString());
  });

  it('отклоняет подделанное поле (подменённый Telegram ID)', () => {
    const forged = sign(fields(nowSec)).replace('777000111', '777000112');
    expect(reason(() => verifyInitData(forged, BOT_TOKEN, NOW))).toBe('BAD_SIGNATURE');
  });

  it('отклоняет initData, подписанный другим ботом', () => {
    expect(reason(() => verifyInitData(sign(fields(nowSec), '999:other'), BOT_TOKEN, NOW))).toBe('BAD_SIGNATURE');
  });

  it('отклоняет auth_date старше 24 ч', () => {
    expect(reason(() => verifyInitData(sign(fields(nowSec - 86_401)), BOT_TOKEN, NOW))).toBe('EXPIRED');
    expect(reason(() => verifyInitData(sign(fields(nowSec - 86_000)), BOT_TOKEN, NOW))).toBe('accepted');
  });

  it('отклоняет строку без hash или без user', () => {
    expect(reason(() => verifyInitData('auth_date=1&user=%7B%7D', BOT_TOKEN, NOW))).toBe('MALFORMED');
    const noUser = sign({ auth_date: String(nowSec), query_id: 'x' });
    expect(reason(() => verifyInitData(noUser, BOT_TOKEN, NOW))).toBe('MALFORMED');
  });
});
