import { describe, expect, it, vi } from 'vitest';
import { resolveLaunchMode, startParamToPath, versionAtLeast } from '../src/app/platform/launch';
import { startSession } from '../src/app/session/auth';

const tgUser = { id: 777001, first_name: 'Ivan', language_code: 'ru' };
const initData = `user=${encodeURIComponent(JSON.stringify(tgUser))}&auth_date=1793000000&hash=abc`;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('resolveLaunchMode — история 3', () => {
  it('есть initData → telegram', () => expect(resolveLaunchMode({ initData, devAuth: false })).toBe('telegram'));
  it('нет initData, DEV_AUTH=1 → dev', () => expect(resolveLaunchMode({ initData: undefined, devAuth: true })).toBe('dev'));
  it('нет initData, без DEV_AUTH → outside', () => expect(resolveLaunchMode({ initData: '', devAuth: false })).toBe('outside'));
});

describe('versionAtLeast — история 89 (Bot API 8.0+)', () => {
  it.each([
    ['8.0', '8.0', true],
    ['8.2', '8.0', true],
    ['10.1', '8.0', true],
    ['7.10', '8.0', false],
    ['7.7', '7.10', false],
    [undefined, '8.0', false],
  ] as const)('%s ≥ %s → %s', (v, min, ok) => expect(versionAtLeast(v, min)).toBe(ok));
});

describe('startParamToPath — ссылки бота startapp=booking_<id>', () => {
  it('booking_<id> → карточка брони', () => expect(startParamToPath('booking_ck123')).toBe('/bookings/ck123'));
  it('model_<id> → карточка модели', () => expect(startParamToPath('model_m42')).toBe('/bikes/m42'));
  it('manager → режим менеджера', () => expect(startParamToPath('manager')).toBe('/manager'));
  it('пусто или мусор → null', () => {
    expect(startParamToPath(undefined)).toBeNull();
    expect(startParamToPath('booking_../../x')).toBeNull();
    expect(startParamToPath('unknown')).toBeNull();
  });
});

describe('startSession — POST /api/auth/telegram → { token, user, role }', () => {
  it('вне Telegram без DEV_AUTH API не вызывается', async () => {
    const fetch = vi.fn();
    const result = await startSession({ mode: 'outside', initData: undefined, fetch, apiBase: '/api', allowMock: false });
    expect(result).toEqual({ status: 'outside' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('шлёт initData и отдаёт ответ сервера как есть', async () => {
    const body = {
      token: 'jwt',
      role: 'CLIENT',
      user: { id: 'u1', telegramId: '777001', firstName: 'Ivan', lang: 'ru', currency: 'RUB', role: 'CLIENT', onboarded: false },
    };
    const fetch = vi.fn(async () => jsonResponse(200, body));
    const result = await startSession({ mode: 'telegram', initData, fetch, apiBase: '/api', allowMock: false });
    expect(fetch).toHaveBeenCalledWith(
      '/api/auth/telegram',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ initData }) }),
    );
    expect(result).toEqual({ status: 'ready', session: body, mocked: false });
  });

  it('dev-режим шлёт {devUser} по роли, а не неподписанный initData', async () => {
    const body = { token: 'jwt', role: 'MANAGER', user: { id: 'u2' }, expiresAt: '2026-10-29T00:00:00Z', startParam: null };
    const fetch = vi.fn(async () => jsonResponse(200, body));
    const result = await startSession({ mode: 'dev', initData, fetch, apiBase: '/api', allowMock: true, mockRole: 'MANAGER' });
    expect(fetch).toHaveBeenCalledWith('/api/auth/telegram', expect.objectContaining({ body: JSON.stringify({ devUser: 'manager' }) }));
    expect(result).toMatchObject({ status: 'ready', mocked: false });
  });

  it('эндпоинта ещё нет (404) и мок разрешён → сессия того же формата из initData', async () => {
    const fetch = vi.fn(async () => jsonResponse(404, { code: 'NOT_FOUND', message: 'Cannot POST' }));
    const result = await startSession({ mode: 'dev', initData, fetch, apiBase: '/api', allowMock: true, mockRole: 'MANAGER' });
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') return;
    expect(result.mocked).toBe(true);
    expect(result.session.role).toBe('MANAGER');
    expect(result.session.token).toMatch(/\S/);
    expect(result.session.user).toMatchObject({ telegramId: '777001', firstName: 'Ivan', lang: 'ru', role: 'MANAGER' });
  });

  it('API не запущен (прокси dev отвечает 500 без JSON) и мок разрешён → мок', async () => {
    const fetch = vi.fn(async () => new Response('', { status: 500 }));
    const result = await startSession({ mode: 'dev', initData, fetch, apiBase: '/api', allowMock: true });
    expect(result).toMatchObject({ status: 'ready', mocked: true });
  });

  it('ошибка сервера без мока → error с машинным кодом', async () => {
    const fetch = vi.fn(async () => jsonResponse(401, { code: 'UNAUTHORIZED', message: 'bad hash' }));
    const result = await startSession({ mode: 'telegram', initData, fetch, apiBase: '/api', allowMock: false });
    expect(result).toEqual({ status: 'error', code: 'UNAUTHORIZED' });
  });
});
