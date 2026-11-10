import { describe, expect, it } from 'vitest';
import { AdminApiError, createAdminApi, setSessionToken } from '../src/app/api';
import { initDataFromHash } from '../src/app/telegram';

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  };
  return { fetch, calls };
}

describe('клиент API админки', () => {
  it('cookie-сессия: credentials include; изменения несут x-admin-request, чтение — нет', async () => {
    const f = fakeFetch(200, { ok: true });
    const api = createAdminApi({ base: '/api', fetch: f.fetch });
    await api.get('/admin/bookings', { status: 'CONFIRMED', q: '' });
    await api.patch('/admin/bookings/1', { bikeId: 'b2' });
    expect(f.calls[0]!.url).toBe('/api/admin/bookings?status=CONFIRMED');
    expect(f.calls[0]!.init.credentials).toBe('include');
    expect((f.calls[0]!.init.headers as Record<string, string>)['x-admin-request']).toBeUndefined();
    expect(f.calls[1]!.init.method).toBe('PATCH');
    expect((f.calls[1]!.init.headers as Record<string, string>)['x-admin-request']).toBe('1');
    expect(f.calls[1]!.init.body).toBe('{"bikeId":"b2"}');
  });

  it('409 с причиной → AdminApiError с кодом и бронью-помехой', async () => {
    const conflict = { bookingId: 'x', code: 'BK-10002', startAt: 'a', endAt: 'b' };
    const api = createAdminApi({ base: '/api', fetch: fakeFetch(409, { code: 'BIKE_TAKEN', message: 'busy', conflict }).fetch });
    const err = await api.patch('/admin/bookings/1', { bikeId: 'b2' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdminApiError);
    expect((err as AdminApiError).statusCode).toBe(409);
    expect((err as AdminApiError).code).toBe('BIKE_TAKEN');
    expect((err as AdminApiError).conflict).toEqual(conflict);
  });

  it('сеть недоступна → NETWORK', async () => {
    const api = createAdminApi({ base: '/api', fetch: async () => Promise.reject(new TypeError('offline')) });
    const err = (await api.get('/admin/dashboard').catch((e: unknown) => e)) as AdminApiError;
    expect(err.code).toBe('NETWORK');
  });
});

describe('админка внутри Telegram', () => {
  it('токен сессии уходит заголовком только после входа', async () => {
    const f = fakeFetch(200, { ok: true });
    const api = createAdminApi({ base: '/api', fetch: f.fetch });
    await api.get('/admin/bookings');
    expect((f.calls[0]!.init.headers as Record<string, string>).authorization).toBeUndefined();
    setSessionToken('abc');
    await api.get('/admin/bookings');
    expect((f.calls[1]!.init.headers as Record<string, string>).authorization).toBe('Bearer abc');
    setSessionToken(null);
  });

  it('подпись Telegram читается из адреса страницы', () => {
    const raw = 'query_id=A&user=%7B%22id%22%3A1%7D&auth_date=1&hash=ff';
    expect(initDataFromHash(`#tgWebAppData=${encodeURIComponent(raw)}&tgWebAppVersion=8.0`)).toBe(raw);
    expect(initDataFromHash('#section')).toBeNull();
    expect(initDataFromHash('')).toBeNull();
  });
});
