import { describe, expect, it } from 'vitest';
import { earliestSlot, monthGrid, pickDay, quickRange, timeSlots, composeRange, endTimeOptions, startTimeOptions } from '../src/features/dates/slots';

const loc = { openTime: '08:00', closeTime: '20:00', timezone: 'Asia/Ho_Chi_Minh' };
// 12.11.2026 10:10 по Вьетнаму = 03:10 UTC
const now = new Date('2026-11-12T03:10:00Z');
const at = (iso: string) => new Date(iso).toISOString();

describe('timeSlots — слоты по 30 минут в часы точки (история 14)', () => {
  it('08:00–10:00 → пять слотов', () => expect(timeSlots('08:00', '10:00')).toEqual(['08:00', '08:30', '09:00', '09:30', '10:00']));
});

describe('earliestSlot — не раньше «сейчас + 1 ч», кратно 30 мин (история 16)', () => {
  it('10:10 + 60 мин = 11:10 → 11:30 по Вьетнаму', () => expect(earliestSlot(now, loc).toISOString()).toBe(at('2026-11-12T04:30:00Z')));
  it('до открытия → открытие того же дня', () => {
    const early = new Date('2026-11-11T22:00:00Z'); // 05:00 12.11
    expect(earliestSlot(early, loc).toISOString()).toBe(at('2026-11-12T01:00:00Z'));
  });
  it('после закрытия → открытие следующего дня', () => {
    const late = new Date('2026-11-12T12:30:00Z'); // 19:30 → 20:30 > закрытие
    expect(earliestSlot(late, loc).toISOString()).toBe(at('2026-11-13T01:00:00Z'));
  });
});

describe('quickRange — быстрые кнопки', () => {
  it('Неделя = 7 суток от ближайшего слота', () => {
    const r = quickRange('week', now, loc);
    expect(r.from.toISOString()).toBe(at('2026-11-12T04:30:00Z'));
    expect(r.to.toISOString()).toBe(at('2026-11-19T04:30:00Z'));
  });
  it('3 дня и Месяц (30 суток)', () => {
    expect(quickRange('days3', now, loc).to.toISOString()).toBe(at('2026-11-15T04:30:00Z'));
    expect(quickRange('month', now, loc).to.toISOString()).toBe(at('2026-12-12T04:30:00Z'));
  });
  it('Сегодня — от ближайшего слота до закрытия', () => {
    const r = quickRange('today', now, loc);
    expect(r.from.toISOString()).toBe(at('2026-11-12T04:30:00Z'));
    expect(r.to.toISOString()).toBe(at('2026-11-12T13:00:00Z'));
  });
  it('Завтра — открытие–закрытие завтрашнего дня', () => {
    const r = quickRange('tomorrow', now, loc);
    expect(r.from.toISOString()).toBe(at('2026-11-13T01:00:00Z'));
    expect(r.to.toISOString()).toBe(at('2026-11-13T13:00:00Z'));
  });
});

describe('monthGrid — неделя с понедельника', () => {
  it('ноябрь 2026 начинается в воскресенье', () => {
    const grid = monthGrid(2026, 11);
    expect(grid[0]).toEqual([null, null, null, null, null, null, '2026-11-01']);
    expect(grid[grid.length - 1]?.filter(Boolean).pop()).toBe('2026-11-30');
    expect(grid.every((w) => w.length === 7)).toBe(true);
  });
});

describe('pickDay — первое касание начало, второе конец (история 14)', () => {
  const busy = new Set(['2026-11-15']);
  it('первое касание — начало', () => expect(pickDay({ start: null, end: null }, '2026-11-12', busy)).toEqual({ start: '2026-11-12', end: null }));
  it('второе — конец', () => expect(pickDay({ start: '2026-11-12', end: null }, '2026-11-14', busy)).toEqual({ start: '2026-11-12', end: '2026-11-14' }));
  it('второе раньше начала → новое начало', () => expect(pickDay({ start: '2026-11-12', end: null }, '2026-11-10', busy)).toEqual({ start: '2026-11-10', end: null }));
  it('занятый день не выбирается', () => expect(pickDay({ start: '2026-11-12', end: null }, '2026-11-15', busy)).toEqual({ start: '2026-11-12', end: null }));
  it('диапазон через занятый день → начало заново', () => expect(pickDay({ start: '2026-11-12', end: null }, '2026-11-16', busy)).toEqual({ start: '2026-11-16', end: null }));
  it('третье касание — начинает заново', () => expect(pickDay({ start: '2026-11-12', end: '2026-11-14' }, '2026-11-20', busy)).toEqual({ start: '2026-11-20', end: null }));
});

describe('время выдачи и возврата', () => {
  const earliest = earliestSlot(now, loc);
  it('в первый доступный день слоты раньше ближайшего отключены', () => {
    expect(startTimeOptions('2026-11-12', earliest, loc)[0]).toBe('11:30');
    expect(startTimeOptions('2026-11-13', earliest, loc)[0]).toBe('08:00');
  });
  it('в тот же день возврат строго позже выдачи', () => {
    expect(endTimeOptions('2026-11-12', '2026-11-12', '19:30', loc)).toEqual(['20:00']);
    expect(endTimeOptions('2026-11-12', '2026-11-13', '19:30', loc)[0]).toBe('08:00');
  });
  it('23:30 по Москве не сдвигает день во Вьетнаме (история 15)', () => {
    // «Выбрана дата 12.11 и 23:30 по Москве» не влияет: слоты считаются по часам точки.
    const r = composeRange({ start: '2026-11-12', end: '2026-11-17' }, '09:00', '09:00', loc.timezone);
    expect(r?.from.toISOString()).toBe(at('2026-11-12T02:00:00Z'));
    expect(r?.to.toISOString()).toBe(at('2026-11-17T02:00:00Z'));
  });
  it('нет конца — нет диапазона', () => expect(composeRange({ start: '2026-11-12', end: null }, '09:00', '09:00', loc.timezone)).toBeNull());
});
