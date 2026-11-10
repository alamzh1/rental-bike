import { describe, expect, it } from 'vitest';
import { quote, rentalDays, type QuoteInput, type TariffBracket } from '../src/index.js';

const TZ = 'Asia/Ho_Chi_Minh';
const H = 3_600_000;

// Тарифная сетка по ТЗ §5.2: 1–2, 3–6, 7–29, 30+ дней (цены — условные для теста).
const tariffs: TariffBracket[] = [
  { minDays: 1, maxDays: 2, pricePerDay: 150_000 },
  { minDays: 3, maxDays: 6, pricePerDay: 130_000 },
  { minDays: 7, maxDays: 29, pricePerDay: 110_000 },
  { minDays: 30, maxDays: null, pricePerDay: 90_000 },
];

// 10:00 по Вьетнаму = 03:00 UTC
const start = new Date('2026-11-12T03:00:00Z');
const after = (hours: number) => new Date(start.getTime() + hours * H);

function input(over: Partial<QuoteInput>): QuoteInput {
  return { startAt: start, endAt: after(24), timezone: TZ, tariffs, seasons: [], extras: [], deposit: 0, ...over };
}

describe('rentalDays — сутки = 24 ч от выдачи', () => {
  it('ровно 24 ч — 1 день', () => expect(rentalDays(start, after(24))).toBe(1));
  it('24 ч 1 мин — 2 дня', () => expect(rentalDays(start, new Date(after(24).getTime() + 60_000))).toBe(2));
  it('меньше суток — минимум 1 день', () => expect(rentalDays(start, after(5))).toBe(1));
  it('конец не позже начала — 1 день', () => expect(rentalDays(start, start)).toBe(1));
});

describe('quote — 10 сценариев приёмки', () => {
  it('1. 1 день по тарифу 1–2 дня', () => {
    const q = quote(input({ endAt: after(24) }));
    expect(q).toMatchObject({ days: 1, pricePerDay: 150_000, rent: 150_000, extras: 0, total: 150_000, deposit: 0, payable: 150_000 });
  });

  it('2. 25 часов — 2 суток', () => {
    const q = quote(input({ endAt: after(25) }));
    expect(q).toMatchObject({ days: 2, pricePerDay: 150_000, rent: 300_000, total: 300_000 });
  });

  it('3. 3 дня — тариф «от 3 дней»', () => {
    const q = quote(input({ endAt: after(72) }));
    expect(q).toMatchObject({ days: 3, pricePerDay: 130_000, rent: 390_000, total: 390_000 });
  });

  it('4. 7 дней — тариф «от 7 дней»', () => {
    const q = quote(input({ endAt: after(7 * 24) }));
    expect(q).toMatchObject({ days: 7, pricePerDay: 110_000, rent: 770_000, total: 770_000 });
  });

  it('5. 30 дней — тариф «месяц»', () => {
    const q = quote(input({ endAt: after(30 * 24) }));
    expect(q).toMatchObject({ days: 30, pricePerDay: 90_000, rent: 2_700_000, total: 2_700_000 });
  });

  it('6. 5 часов — минимум сутки', () => {
    const q = quote(input({ endAt: after(5) }));
    expect(q).toMatchObject({ days: 1, rent: 150_000 });
  });

  it('7. сезонный коэффициент действует только на дни внутри сезона', () => {
    // выдача 05.02.2027 10:00, сезон 06.02–10.02 ×1.5: 130 000 + 195 000 + 195 000
    const startAt = new Date('2027-02-05T03:00:00Z');
    const q = quote(input({
      startAt,
      endAt: new Date(startAt.getTime() + 72 * H),
      seasons: [{ from: '2027-02-06', to: '2027-02-10', coefficient: 1.5 }],
    }));
    expect(q.rent).toBe(520_000);
    expect(q.pricePerDay).toBe(130_000);
    const rentLines = q.lines.filter((l) => l.kind === 'RENT');
    expect(rentLines).toEqual([
      { kind: 'RENT', days: 1, unitPrice: 130_000, amount: 130_000 },
      { kind: 'RENT', days: 2, unitPrice: 195_000, amount: 390_000 },
    ]);
  });

  it('8. опции за день и разовые', () => {
    const q = quote(input({
      endAt: after(72),
      extras: [
        { id: 'helmet', price: 20_000, per: 'DAY', qty: 1 },
        { id: 'raincoat', price: 30_000, per: 'ONCE', qty: 2 },
      ],
    }));
    expect(q.rent).toBe(390_000);
    expect(q.extras).toBe(120_000);
    expect(q.total).toBe(510_000);
    expect(q.lines).toContainEqual({ kind: 'EXTRA', refId: 'helmet', days: 3, unitPrice: 20_000, amount: 60_000 });
    expect(q.lines).toContainEqual({ kind: 'EXTRA', refId: 'raincoat', unitPrice: 30_000, amount: 60_000 });
  });

  it('9. депозит — отдельной строкой, не входит в стоимость аренды', () => {
    const q = quote(input({ endAt: after(24), deposit: 2_000_000 }));
    expect(q.total).toBe(150_000);
    expect(q.deposit).toBe(2_000_000);
    expect(q.payable).toBe(2_150_000);
    expect(q.lines).toContainEqual({ kind: 'DEPOSIT', unitPrice: 2_000_000, amount: 2_000_000 });
  });

  it('10. день сезона определяется по часовому поясу точки, а не UTC', () => {
    // 31.12.2026 17:30 UTC = 01.01.2027 00:30 по Вьетнаму; сезон только 01.01 ×2
    const startAt = new Date('2026-12-31T17:30:00Z');
    const q = quote(input({
      startAt,
      endAt: new Date(startAt.getTime() + 7 * 24 * H),
      seasons: [{ from: '2027-01-01', to: '2027-01-01', coefficient: 2 }],
      delivery: 50_000,
    }));
    expect(q.days).toBe(7);
    expect(q.rent).toBe(220_000 + 6 * 110_000);
    expect(q.delivery).toBe(50_000);
    expect(q.total).toBe(880_000 + 50_000);
  });
});

describe('quote — граничные случаи', () => {
  it('при пересечении сезонов берётся больший коэффициент', () => {
    const q = quote(input({
      endAt: after(24),
      seasons: [
        { from: '2026-11-01', to: '2026-11-30', coefficient: 1.2 },
        { from: '2026-11-12', to: '2026-11-12', coefficient: 1.5 },
      ],
    }));
    expect(q.rent).toBe(225_000);
  });

  it('если сетка не покрывает срок — берётся ближайший меньший тариф', () => {
    const q = quote(input({ endAt: after(10 * 24), tariffs: [{ minDays: 1, maxDays: 2, pricePerDay: 150_000 }, { minDays: 3, maxDays: 6, pricePerDay: 130_000 }] }));
    expect(q.pricePerDay).toBe(130_000);
    expect(q.rent).toBe(1_300_000);
  });

  it('без подходящего тарифа — ошибка', () => {
    expect(() => quote(input({ tariffs: [{ minDays: 3, maxDays: null, pricePerDay: 1 }] }))).toThrow(RangeError);
  });

  it('конец раньше начала — ошибка', () => {
    expect(() => quote(input({ endAt: after(-1) }))).toThrow(RangeError);
  });
});

describe('сезонная скидка', () => {
  it('коэффициент меньше 1 снижает цену; из нескольких сезонов действует наибольший', () => {
    const start = new Date('2027-03-10T03:00:00Z');
    const base = { startAt: start, endAt: new Date(start.getTime() + 24 * 3_600_000), timezone: 'Asia/Ho_Chi_Minh', tariffs: [{ minDays: 1, maxDays: null, pricePerDay: 100_000 }], extras: [], deposit: 0 };
    const rent = (seasons: { from: string; to: string; coefficient: number }[]) => quote({ ...base, seasons } as never).rent;
    expect(rent([])).toBe(100_000);
    expect(rent([{ from: '2027-03-10', to: '2027-03-10', coefficient: 0.9 }])).toBe(90_000);
    expect(rent([{ from: '2027-03-10', to: '2027-03-10', coefficient: 0.9 }, { from: '2027-03-01', to: '2027-03-31', coefficient: 1.2 }])).toBe(120_000);
  });
});
