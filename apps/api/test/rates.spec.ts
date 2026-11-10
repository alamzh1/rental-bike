import { afterEach, describe, expect, it, vi } from 'vitest';
import { RatesService } from '../src/rates/rates.service';

// Курс: обновление из источника; при сбое остаётся прежнее значение. Фейковая БД хранит одну строку Setting.
function setup(initial: unknown = undefined) {
  let row: { key: string; value: unknown } | undefined = initial === undefined ? undefined : { key: 'rates', value: initial };
  const prisma = {
    setting: {
      findUnique: async () => row,
      upsert: async ({ create, update }: { create: { key: string; value: unknown }; update: { value: unknown } }) => (row = row ? { ...row, value: update.value } : create),
    },
  };
  const jobs = { every: vi.fn() };
  const clock = { now: () => new Date('2026-10-28T10:00:00Z') };
  const svc = new RatesService(prisma as never, jobs as never, clock as never);
  return { svc, jobs, row: () => row };
}

afterEach(() => vi.unstubAllGlobals());

describe('RatesService', () => {
  it('регистрирует суточную задачу обновления', () => {
    const { jobs } = setup();
    expect(jobs.every).toHaveBeenCalledWith('rates.refresh', 24 * 3_600_000, expect.any(Function));
  });

  it('успешный ответ источника записывается в Setting rates с датой', async () => {
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ result: 'success', rates: { RUB: 0.0034, USD: 0.00004, EUR: 0.00003 } })));
    const { svc, row } = setup({ RUB: 0.003533, USD: 0.000038, updatedAt: null });
    expect(await svc.refresh()).toBe(true);
    expect(row()?.value).toEqual({ RUB: 0.0034, USD: 0.00004, updatedAt: '2026-10-28T10:00:00.000Z' });
    expect(await svc.info()).toEqual({ RUB: 0.0034, USD: 0.00004, updatedAt: '2026-10-28T10:00:00.000Z' });
  });

  it.each([
    ['сеть недоступна', async () => Promise.reject(new Error('offline'))],
    ['HTTP 500', async () => new Response('x', { status: 500 })],
    ['мусор в ответе', async () => new Response(JSON.stringify({ rates: { RUB: 'abc' } }))],
  ])('сбой источника (%s): остаётся прежний курс', async (_name, impl) => {
    vi.stubGlobal('fetch', impl);
    const prev = { RUB: 0.0031, USD: 0.00003, updatedAt: '2026-10-27T10:00:00.000Z' };
    const { svc, row } = setup(prev);
    expect(await svc.refresh()).toBe(false);
    expect(row()?.value).toEqual(prev);
    expect(await svc.get()).toEqual({ RUB: 0.0031, USD: 0.00003 });
  });

  it('без Setting rates отдаёт запасные значения и updatedAt = null', async () => {
    const { svc } = setup();
    const info = await svc.info();
    expect(info.updatedAt).toBeNull();
    expect(info.RUB).toBeGreaterThan(0);
    expect(info.USD).toBeGreaterThan(0);
  });
});
