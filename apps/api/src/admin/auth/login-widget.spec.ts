import { createHash, createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LoginWidgetError, verifyLoginWidget } from './login-widget';

// Пример подписан вручную по алгоритму https://core.telegram.org/widgets/login#checking-authorization
const TOKEN = '123456:test-token';
const NOW = new Date('2026-11-12T00:00:00Z');
const AUTH_DATE = Math.floor(NOW.getTime() / 1000) - 60;

function sign(fields: Record<string, string | number>, token = TOKEN) {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  return { ...fields, hash: createHmac('sha256', createHash('sha256').update(token).digest()).update(dcs).digest('hex') };
}

const reason = (fn: () => unknown) => {
  try {
    fn();
  } catch (e) {
    return e instanceof LoginWidgetError ? e.reason : 'OTHER';
  }
  return 'OK';
};

describe('verifyLoginWidget', () => {
  it('верная подпись → пользователь', () => {
    const u = verifyLoginWidget(sign({ id: 42, first_name: 'Anna', username: 'anna', auth_date: AUTH_DATE }), TOKEN, NOW);
    expect(u).toMatchObject({ id: '42', firstName: 'Anna', username: 'anna', lastName: null });
  });

  it('изменённое поле, чужой токен, ключ initData вместо SHA256(token) → BAD_SIGNATURE', () => {
    const ok = sign({ id: 42, first_name: 'Anna', auth_date: AUTH_DATE });
    expect(reason(() => verifyLoginWidget({ ...ok, first_name: 'Eve' }, TOKEN, NOW))).toBe('BAD_SIGNATURE');
    expect(reason(() => verifyLoginWidget(sign({ id: 42, auth_date: AUTH_DATE }, '1:other'), TOKEN, NOW))).toBe('BAD_SIGNATURE');
    const fields = { auth_date: AUTH_DATE, id: 42 };
    const webAppKey = createHmac('sha256', 'WebAppData').update(TOKEN).digest();
    const hash = createHmac('sha256', webAppKey).update(`auth_date=${AUTH_DATE}\nid=42`).digest('hex');
    expect(reason(() => verifyLoginWidget({ ...fields, hash }, TOKEN, NOW))).toBe('BAD_SIGNATURE');
  });

  it('auth_date старше 24 ч или из будущего → EXPIRED', () => {
    expect(reason(() => verifyLoginWidget(sign({ id: 1, auth_date: AUTH_DATE - 24 * 3600 }), TOKEN, NOW))).toBe('EXPIRED');
    expect(reason(() => verifyLoginWidget(sign({ id: 1, auth_date: AUTH_DATE + 3600 }), TOKEN, NOW))).toBe('EXPIRED');
  });

  it('нет hash, id или не объект → MALFORMED', () => {
    expect(reason(() => verifyLoginWidget({ id: 1, auth_date: AUTH_DATE }, TOKEN, NOW))).toBe('MALFORMED');
    expect(reason(() => verifyLoginWidget(sign({ auth_date: AUTH_DATE }), TOKEN, NOW))).toBe('MALFORMED');
    expect(reason(() => verifyLoginWidget('x', TOKEN, NOW))).toBe('MALFORMED');
    expect(reason(() => verifyLoginWidget({ ...sign({ id: 1, auth_date: AUTH_DATE }), extra: { a: 1 } }, TOKEN, NOW))).toBe('MALFORMED');
  });
});
