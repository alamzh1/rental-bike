import type { AdminIncomeBreakdown } from '@rental/shared';
import { paidTotal, refundedTotal } from '../../bookings/refund';

// Доход брони — чистые функции (тесты в calc.spec.ts). Статьи совпадают с выручкой сводки и сверкой платежей.

const EARNING = new Set(['CONFIRMED', 'ISSUED', 'COMPLETED', 'PROBLEM']);
const CANCELLED = new Set(['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM']);
const DAY_MS = 86_400_000;

export interface IncomeSource {
  status: string;
  rentAmount: number;
  extrasAmount: number;
  deliveryAmount: number;
  discountAmount: number;
  totalAmount: number;
  depositAmount: number;
  lateFeeAmount: number;
  refundAmount: number | null;
  payments: { kind: string; status: string; amount: number; receivedAmount: number | null }[];
  deductions: { amount: number }[];
}

export const EMPTY_BREAKDOWN: AdminIncomeBreakdown = { rent: 0, extras: 0, delivery: 0, lateFees: 0, deductions: 0, cancellationFees: 0, refunds: 0 };

export function bookingIncome(b: IncomeSource): AdminIncomeBreakdown {
  const refunded = refundedTotal(b.payments);
  if (CANCELLED.has(b.status)) return { ...EMPTY_BREAKDOWN, cancellationFees: Math.max(0, paidTotal(b.payments) - Math.max(b.refundAmount ?? 0, refunded)) };
  if (!EARNING.has(b.status)) return EMPTY_BREAKDOWN;
  return {
    rent: b.rentAmount - b.discountAmount,
    extras: b.extrasAmount,
    delivery: b.deliveryAmount,
    lateFees: b.lateFeeAmount,
    deductions: b.deductions.reduce((s, d) => s + d.amount, 0),
    cancellationFees: 0,
    // Возврат сверх депозита и излишка (жест доброй воли) уменьшает доход
    refunds: 0 - Math.max(0, refunded - (b.status === 'COMPLETED' ? (b.refundAmount ?? 0) : 0) - Math.max(0, paidTotal(b.payments) - b.totalAmount - b.depositAmount - b.lateFeeAmount)),
  };
}

export const incomeTotal = (x: AdminIncomeBreakdown): number => x.rent + x.extras + x.delivery + x.lateFees + x.deductions + x.cancellationFees + x.refunds;

export function addBreakdown(a: AdminIncomeBreakdown, b: AdminIncomeBreakdown): AdminIncomeBreakdown {
  return {
    rent: a.rent + b.rent,
    extras: a.extras + b.extras,
    delivery: a.delivery + b.delivery,
    lateFees: a.lateFees + b.lateFees,
    deductions: a.deductions + b.deductions,
    cancellationFees: a.cancellationFees + b.cancellationFees,
    refunds: a.refunds + b.refunds,
  };
}

/** Начислено, но ещё не получено: только брони, которые держат байк. Депозит считается — его тоже должны внести. */
export function bookingOutstanding(b: IncomeSource): number {
  if (!EARNING.has(b.status)) return 0;
  return Math.max(0, b.totalAmount + b.depositAmount + b.lateFeeAmount - paidTotal(b.payments));
}

/** Пересечение брони с окном, мс. */
export function overlapMs(start: Date, end: Date, from: Date, to: Date): number {
  return Math.max(0, Math.min(end.getTime(), to.getTime()) - Math.max(start.getTime(), from.getTime()));
}

export const toDays = (ms: number): number => Math.round((ms / DAY_MS) * 10) / 10;

/** Периоды графика: по дням до 31 дня включительно, дальше по месяцам. Даты — YYYY-MM-DD. */
export function periodKeys(from: string, to: string): { granularity: 'day' | 'month'; keys: string[] } {
  const a = Date.parse(`${from}T00:00:00Z`);
  const b = Date.parse(`${to}T00:00:00Z`);
  const days = Math.round((b - a) / DAY_MS) + 1;
  if (days <= 31) return { granularity: 'day', keys: Array.from({ length: days }, (_, i) => new Date(a + i * DAY_MS).toISOString().slice(0, 10)) };
  const keys: string[] = [];
  const d = new Date(a);
  d.setUTCDate(1);
  while (d.getTime() <= b) {
    keys.push(d.toISOString().slice(0, 7));
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return { granularity: 'month', keys };
}
