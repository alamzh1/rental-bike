import { describe, expect, it } from 'vitest';
import { bikeAttention, trackedState, type StateInput } from './state';

const now = new Date('2026-11-01T12:00:00Z');
const H = 3_600_000;
const at = (hours: number) => new Date(now.getTime() + hours * H);
const base: StateInput = { status: 'ACTIVE', current: null, next: null, serviceDate: null, insuranceUntil: null, hasTracker: false, lastSeenAt: null, lastSpeedKmh: null };

describe('состояние байка', () => {
  it('приоритеты: списан, у клиента, просрочка, проблема, ремонт, резерв, свободен', () => {
    expect(trackedState({ ...base, status: 'RETIRED', current: { status: 'ISSUED', endAt: at(1) } }, now)).toBe('RETIRED');
    expect(trackedState({ ...base, current: { status: 'ISSUED', endAt: at(1) } }, now)).toBe('RENTED');
    expect(trackedState({ ...base, current: { status: 'ISSUED', endAt: at(-1) } }, now)).toBe('OVERDUE');
    expect(trackedState({ ...base, current: { status: 'PROBLEM', endAt: at(-1) } }, now)).toBe('PROBLEM');
    expect(trackedState({ ...base, status: 'REPAIR', next: { startAt: at(1) } }, now)).toBe('REPAIR');
    expect(trackedState({ ...base, next: { startAt: at(23) } }, now)).toBe('RESERVED');
    expect(trackedState({ ...base, next: { startAt: at(25) } }, now)).toBe('FREE');
  });
});

describe('поводы для внимания', () => {
  it('конец аренды: за 24 часа — скоро, после срока — просрочка', () => {
    expect(bikeAttention({ ...base, current: { status: 'ISSUED', endAt: at(25) } }, now)).toEqual([]);
    expect(bikeAttention({ ...base, current: { status: 'ISSUED', endAt: at(24) } }, now)).toEqual(['ENDING_SOON']);
    expect(bikeAttention({ ...base, current: { status: 'ISSUED', endAt: at(-1) } }, now)).toEqual(['OVERDUE']);
  });

  it('движение без аренды: только свежий сигнал и быстрее порога', () => {
    const tracker = { ...base, hasTracker: true, lastSeenAt: at(-0.05) };
    expect(bikeAttention({ ...tracker, lastSpeedKmh: 40 }, now)).toEqual(['MOVING_UNRENTED']);
    expect(bikeAttention({ ...tracker, lastSpeedKmh: 5 }, now)).toEqual([]);
    expect(bikeAttention({ ...tracker, lastSpeedKmh: 40, current: { status: 'ISSUED', endAt: at(48) } }, now)).toEqual([]);
    expect(bikeAttention({ ...tracker, lastSpeedKmh: 40, lastSeenAt: at(-0.25) }, now)).toEqual([]);
  });

  it('нет сигнала — только при подключённом трекере', () => {
    expect(bikeAttention({ ...base, hasTracker: true, lastSeenAt: at(-1) }, now)).toEqual(['GPS_OFFLINE']);
    expect(bikeAttention({ ...base, hasTracker: true }, now)).toEqual(['GPS_OFFLINE']);
    expect(bikeAttention({ ...base, lastSeenAt: at(-1) }, now)).toEqual([]);
  });

  it('страховка и ТО', () => {
    expect(bikeAttention({ ...base, insuranceUntil: at(-1) }, now)).toEqual(['INSURANCE_EXPIRED']);
    expect(bikeAttention({ ...base, insuranceUntil: at(24 * 29) }, now)).toEqual(['INSURANCE_SOON']);
    expect(bikeAttention({ ...base, insuranceUntil: at(24 * 31) }, now)).toEqual([]);
    expect(bikeAttention({ ...base, serviceDate: at(24 * 6) }, now)).toEqual(['SERVICE_DUE']);
    expect(bikeAttention({ ...base, status: 'RETIRED', serviceDate: at(-1) }, now)).toEqual([]);
  });
});
