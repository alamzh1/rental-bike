import { describe, expect, it } from 'vitest';
import {
  bookingCode,
  canTransition,
  fromLocationDateTime,
  lateFee,
  refundPercent,
  toLocationDate,
  type BookingStatus,
} from '../src/index.js';

const H = 3_600_000;
const M = 60_000;

describe('lateFee — опоздание с возвратом (ТЗ §5.2)', () => {
  const planned = new Date('2026-11-17T10:00:00Z');
  const rules = { graceMinutes: 60, hourlyFee: 30_000, extraDayAfterHours: 4, dayPrice: 150_000 };
  const late = (ms: number) => lateFee(planned, new Date(planned.getTime() + ms), rules);

  it('вернул раньше — 0', () => expect(late(-2 * H)).toBe(0));
  it('вовремя — 0', () => expect(late(0)).toBe(0));
  it('до 1 ч — бесплатно', () => expect(late(60 * M)).toBe(0));
  it('1 ч 1 мин — один час доплаты', () => expect(late(61 * M)).toBe(30_000));
  it('2 ч 30 мин — два часа сверх льготного', () => expect(late(150 * M)).toBe(60_000));
  it('ровно 4 ч — ещё почасовая', () => expect(late(4 * H)).toBe(90_000));
  it('больше 4 ч — ещё сутки', () => expect(late(4 * H + M)).toBe(150_000));
  it('25 ч — сутки + час в пределах льготного', () => expect(late(25 * H)).toBe(150_000));
  it('30 ч — сутки + сутки (остаток больше 4 ч)', () => expect(late(30 * H)).toBe(300_000));
});

describe('refundPercent — отмена (ТЗ §5.6)', () => {
  const start = new Date('2026-11-20T03:00:00Z');
  const rules = { fullHours: 24, halfHours: 2, halfPercent: 50 };
  const before = (ms: number) => refundPercent(start, new Date(start.getTime() - ms), rules);

  it('больше 24 ч до выдачи — 100%', () => expect(before(24 * H + M)).toBe(100));
  it('ровно 24 ч — 50%', () => expect(before(24 * H)).toBe(50));
  it('5 ч — 50%', () => expect(before(5 * H)).toBe(50));
  it('ровно 2 ч — 50%', () => expect(before(2 * H)).toBe(50));
  it('меньше 2 ч — 0%', () => expect(before(2 * H - M)).toBe(0));
  it('после начала — 0%', () => expect(before(-H)).toBe(0));
  it('проценты настраиваются', () =>
    expect(refundPercent(start, new Date(start.getTime() - 10 * H), { fullHours: 48, halfHours: 6, halfPercent: 30 })).toBe(30));
});

describe('canTransition — машина статусов (ТЗ §5.4)', () => {
  const allowed: [BookingStatus, BookingStatus][] = [
    ['PENDING_PAYMENT', 'CONFIRMED'],
    ['PENDING_PAYMENT', 'CANCELLED_BY_CLIENT'],
    ['PENDING_PAYMENT', 'CANCELLED_BY_SYSTEM'],
    ['PENDING_PAYMENT', 'PROBLEM'],
    ['CONFIRMED', 'ISSUED'],
    ['CONFIRMED', 'CANCELLED_BY_CLIENT'],
    ['CONFIRMED', 'CANCELLED_BY_SYSTEM'],
    ['CONFIRMED', 'PROBLEM'],
    ['ISSUED', 'COMPLETED'],
    ['ISSUED', 'PROBLEM'],
    ['PROBLEM', 'CONFIRMED'],
    ['PROBLEM', 'ISSUED'],
    ['PROBLEM', 'COMPLETED'],
    ['PROBLEM', 'CANCELLED_BY_SYSTEM'],
  ];
  const denied: [BookingStatus, BookingStatus][] = [
    ['PENDING_PAYMENT', 'ISSUED'],
    ['PENDING_PAYMENT', 'COMPLETED'],
    ['CONFIRMED', 'COMPLETED'],
    ['CONFIRMED', 'PENDING_PAYMENT'],
    ['ISSUED', 'CANCELLED_BY_CLIENT'],
    ['ISSUED', 'CONFIRMED'],
    ['COMPLETED', 'ISSUED'],
    ['COMPLETED', 'PROBLEM'],
    ['CANCELLED_BY_CLIENT', 'CONFIRMED'],
    ['CANCELLED_BY_SYSTEM', 'CONFIRMED'],
    ['CONFIRMED', 'CONFIRMED'],
  ];
  it.each(allowed)('%s → %s разрешён', (from, to) => expect(canTransition(from, to)).toBe(true));
  it.each(denied)('%s → %s запрещён', (from, to) => expect(canTransition(from, to)).toBe(false));
});

describe('bookingCode', () => {
  it('BK-24117', () => expect(bookingCode(24117)).toBe('BK-24117'));
  it('дополняет нулями до 5 цифр', () => expect(bookingCode(7)).toBe('BK-00007'));
  it('не обрезает длинные номера', () => expect(bookingCode(1234567)).toBe('BK-1234567'));
  it('только положительные целые', () => {
    expect(() => bookingCode(0)).toThrow(RangeError);
    expect(() => bookingCode(1.5)).toThrow(RangeError);
  });
});

describe('даты в часовом поясе точки (история 15)', () => {
  const TZ = 'Asia/Ho_Chi_Minh';

  it('выбор 12.11 23:30 по часам точки хранится как 16:30 UTC того же дня', () => {
    expect(fromLocationDateTime('2026-11-12', '23:30', TZ).toISOString()).toBe('2026-11-12T16:30:00.000Z');
  });

  it('день во Вьетнаме не зависит от часового пояса устройства (23:30 по Москве = 03:30 следующего дня в VN)', () => {
    const prev = process.env.TZ;
    process.env.TZ = 'Europe/Moscow';
    try {
      // 12.11 23:30 MSK = 20:30 UTC = 13.11 03:30 в VN
      expect(toLocationDate(new Date('2026-11-12T20:30:00Z'), TZ)).toBe('2026-11-13');
      // 23:30 в VN остаётся 12.11, как бы ни был настроен телефон
      expect(toLocationDate(fromLocationDateTime('2026-11-12', '23:30', TZ), TZ)).toBe('2026-11-12');
    } finally {
      process.env.TZ = prev;
    }
  });

  it('неверный формат — ошибка', () => {
    expect(() => fromLocationDateTime('12.11.2026', '23:30', TZ)).toThrow(RangeError);
    expect(() => fromLocationDateTime('2026-11-12', '25:00', TZ)).toThrow(RangeError);
  });
});
