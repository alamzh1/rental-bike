import { describe, expect, it } from 'vitest';
import { barGeometry, canDrop, chessDays, isoToLocalInput, localInputToIso, windowFor } from '../src/features/chess/layout';

// Шахматка: дни колонками в tz точки (Asia/Ho_Chi_Minh, UTC+7, без перехода на летнее время), брони полосами.
const TZ = 'Asia/Ho_Chi_Minh';

describe('окно и дни', () => {
  it('окно с 12.11 на 7 дней — полночь по времени точки', () => {
    expect(windowFor('2026-11-12', 7, TZ)).toEqual({ from: '2026-11-11T17:00:00.000Z', to: '2026-11-18T17:00:00.000Z' });
  });

  it('дни колонками — даты точки, а не устройства', () => {
    expect(chessDays('2026-11-11T17:00:00.000Z', 3, TZ).map((d) => d.date)).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
  });
});

describe('полоса брони', () => {
  const w = { from: '2026-11-11T17:00:00.000Z', to: '2026-11-15T17:00:00.000Z' }; // 4 суток

  it('сутки с 12:00 13.11 до 12:00 14.11 + час буфера: left 37.5 %, width 25 %, буфер 1/96', () => {
    const g = barGeometry({ startAt: '2026-11-13T05:00:00.000Z', endAt: '2026-11-14T05:00:00.000Z', blockedUntil: '2026-11-14T06:00:00.000Z' }, w)!;
    expect(g.left).toBeCloseTo(37.5);
    expect(g.width).toBeCloseTo(25);
    expect(g.buffer).toBeCloseTo(100 / 96);
    expect(g.clippedStart).toBe(false);
  });

  it('началась до окна — обрезается слева; вне окна — null', () => {
    const g = barGeometry({ startAt: '2026-11-10T17:00:00.000Z', endAt: '2026-11-12T17:00:00.000Z', blockedUntil: '2026-11-12T18:00:00.000Z' }, w)!;
    expect(g.left).toBe(0);
    expect(g.width).toBeCloseTo(25);
    expect(g.clippedStart).toBe(true);
    expect(barGeometry({ startAt: '2026-11-20T00:00:00.000Z', endAt: '2026-11-21T00:00:00.000Z', blockedUntil: '2026-11-21T01:00:00.000Z' }, w)).toBeNull();
  });
});

describe('куда можно бросить бронь', () => {
  const booking = { bikeId: 'b1', modelId: 'm1', status: 'CONFIRMED' as const };
  it('тот же байк — ничего; другая модель — причина; списанный — причина; закрытая бронь — причина', () => {
    expect(canDrop(booking, { id: 'b1', modelId: 'm1', status: 'ACTIVE' })).toBe('SAME');
    expect(canDrop(booking, { id: 'b2', modelId: 'm2', status: 'ACTIVE' })).toBe('BIKE_MODEL_MISMATCH');
    expect(canDrop(booking, { id: 'b2', modelId: 'm1', status: 'RETIRED' })).toBe('BIKE_UNAVAILABLE');
    expect(canDrop({ ...booking, status: 'COMPLETED' }, { id: 'b2', modelId: 'm1', status: 'ACTIVE' })).toBe('BOOKING_CLOSED');
    expect(canDrop(booking, { id: 'b2', modelId: 'm1', status: 'ACTIVE' })).toBeNull();
  });
});

describe('поля даты и времени в tz точки', () => {
  it('10:00 по Куинёну = 03:00 UTC и обратно', () => {
    expect(localInputToIso('2026-11-12T10:00', TZ)).toBe('2026-11-12T03:00:00.000Z');
    expect(isoToLocalInput('2026-11-12T03:00:00.000Z', TZ)).toBe('2026-11-12T10:00');
    expect(localInputToIso('garbage', TZ)).toBeNull();
  });
});
