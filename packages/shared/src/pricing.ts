import { toLocationDate } from './dates.js';

// Расчёт цены — единственное место (ТЗ §5.2). API и клиент вызывают одну и ту же функцию.

export interface TariffBracket { minDays: number; maxDays: number | null; pricePerDay: number }
/** Сезон: даты YYYY-MM-DD в часовом поясе точки, включительно. */
export interface SeasonRuleInput { from: string; to: string; coefficient: number }
export interface ExtraInput { id: string; price: number; per: 'DAY' | 'ONCE'; qty: number }
export interface QuoteInput {
  startAt: Date;
  endAt: Date;
  timezone: string;
  tariffs: TariffBracket[];
  seasons: SeasonRuleInput[];
  extras: ExtraInput[];
  deposit: number;
  /** Доставка в отель, VND (разово); по умолчанию 0 */
  delivery?: number;
}
export interface QuoteLine { kind: 'RENT' | 'EXTRA' | 'DELIVERY' | 'DEPOSIT'; refId?: string; days?: number; unitPrice: number; amount: number }
/**
 * `total` — стоимость аренды: аренда + опции + доставка (без депозита).
 * `payable` — к оплате вместе с денежным депозитом: total + deposit.
 */
export interface Quote {
  days: number;
  pricePerDay: number;
  rent: number;
  extras: number;
  delivery: number;
  total: number;
  deposit: number;
  payable: number;
  lines: QuoteLine[];
}

const DAY_MS = 86_400_000;

/** Сутки аренды = 24 ч от выдачи: ceil(часы / 24), минимум 1. */
export function rentalDays(startAt: Date, endAt: Date): number {
  const ms = endAt.getTime() - startAt.getTime();
  return Math.max(1, Math.ceil(ms / DAY_MS));
}

/** Тариф по длительности; если сетка не покрывает срок — ближайший тариф с меньшим minDays. */
function pickTariff(tariffs: TariffBracket[], days: number): TariffBracket {
  const exact = tariffs.find((t) => t.minDays <= days && (t.maxDays === null || days <= t.maxDays));
  if (exact) return exact;
  const lower = tariffs.filter((t) => t.minDays <= days).sort((a, b) => b.minDays - a.minDays)[0];
  if (!lower) throw new RangeError(`No tariff for ${days} day(s)`);
  return lower;
}

function seasonCoefficient(seasons: SeasonRuleInput[], date: string): number {
  // Наибольший из действующих сезонов: 0,9 — скидка, если других нет. Вне сезонов — обычная цена.
  const active = seasons.filter((s) => s.from <= date && date <= s.to).map((s) => s.coefficient);
  return active.length ? Math.max(...active) : 1;
}

export function quote(input: QuoteInput): Quote {
  const { startAt, endAt, timezone } = input;
  if (endAt.getTime() <= startAt.getTime()) throw new RangeError('endAt must be after startAt');

  const days = rentalDays(startAt, endAt);
  const { pricePerDay } = pickTariff(input.tariffs, days);

  // Каждые сутки начинаются в startAt + 24 ч × i; сезон определяется по дате начала суток в tz точки.
  const rentLines: QuoteLine[] = [];
  let rent = 0;
  for (let i = 0; i < days; i++) {
    const date = toLocationDate(new Date(startAt.getTime() + i * DAY_MS), timezone);
    const unitPrice = Math.round(pricePerDay * seasonCoefficient(input.seasons, date));
    rent += unitPrice;
    const last = rentLines[rentLines.length - 1];
    if (last && last.unitPrice === unitPrice) {
      last.days = (last.days ?? 0) + 1;
      last.amount += unitPrice;
    } else {
      rentLines.push({ kind: 'RENT', days: 1, unitPrice, amount: unitPrice });
    }
  }

  const extraLines: QuoteLine[] = input.extras
    .filter((e) => e.qty > 0)
    .map((e) =>
      e.per === 'DAY'
        ? { kind: 'EXTRA', refId: e.id, days, unitPrice: e.price, amount: e.price * e.qty * days }
        : { kind: 'EXTRA', refId: e.id, unitPrice: e.price, amount: e.price * e.qty },
    );
  const extras = extraLines.reduce((sum, l) => sum + l.amount, 0);

  const delivery = input.delivery ?? 0;
  const lines: QuoteLine[] = [...rentLines, ...extraLines];
  if (delivery > 0) lines.push({ kind: 'DELIVERY', unitPrice: delivery, amount: delivery });
  if (input.deposit > 0) lines.push({ kind: 'DEPOSIT', unitPrice: input.deposit, amount: input.deposit });

  const total = rent + extras + delivery;
  return { days, pricePerDay, rent, extras, delivery, total, deposit: input.deposit, payable: total + input.deposit, lines };
}
