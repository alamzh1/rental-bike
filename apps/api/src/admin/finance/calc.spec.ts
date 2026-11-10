import { describe, expect, it } from 'vitest';
import { bookingIncome, bookingOutstanding, incomeTotal, overlapMs, periodKeys, type IncomeSource } from './calc';

const base: IncomeSource = {
  status: 'COMPLETED',
  rentAmount: 1_000_000,
  extrasAmount: 100_000,
  deliveryAmount: 50_000,
  discountAmount: 150_000,
  totalAmount: 1_000_000,
  depositAmount: 500_000,
  lateFeeAmount: 40_000,
  refundAmount: 300_000,
  payments: [
    { kind: 'RENT', status: 'PAID', amount: 1_000_000, receivedAmount: null },
    { kind: 'DEPOSIT', status: 'PAID', amount: 500_000, receivedAmount: null },
  ],
  deductions: [{ amount: 200_000 }],
};

describe('доход брони', () => {
  it('завершённая: аренда со скидкой, опции, доставка, опоздание и удержание; депозит — не доход', () => {
    expect(bookingIncome(base)).toEqual({ rent: 850_000, extras: 100_000, delivery: 50_000, lateFees: 40_000, deductions: 200_000, cancellationFees: 0, refunds: 0 });
    expect(incomeTotal(bookingIncome(base))).toBe(1_240_000);
  });

  it('отменённая: доход — оплаченное минус возврат', () => {
    const x = bookingIncome({ ...base, status: 'CANCELLED_BY_CLIENT', refundAmount: 1_200_000 });
    expect(incomeTotal(x)).toBe(300_000);
    expect(x.cancellationFees).toBe(300_000);
  });

  it('отмена без оплаты и неоплаченная бронь дохода не дают', () => {
    expect(incomeTotal(bookingIncome({ ...base, status: 'CANCELLED_BY_SYSTEM', payments: [], refundAmount: null }))).toBe(0);
    expect(incomeTotal(bookingIncome({ ...base, status: 'PENDING_PAYMENT' }))).toBe(0);
  });

  it('не получено: начислено минус оплачено, отмены не считаются', () => {
    expect(bookingOutstanding(base)).toBe(40_000);
    expect(bookingOutstanding({ ...base, status: 'CONFIRMED', payments: [], lateFeeAmount: 0 })).toBe(1_500_000);
    expect(bookingOutstanding({ ...base, status: 'CANCELLED_BY_CLIENT' })).toBe(0);
  });
});

describe('возвраты в доходе', () => {
  const refund = (amount: number, status = 'PAID') => ({ kind: 'REFUND', status, amount, receivedAmount: null });

  it('возврат депозита доход не уменьшает, возврат сверх него уменьшает', () => {
    expect(bookingIncome({ ...base, payments: [...base.payments, refund(300_000)] }).refunds).toBe(0);
    expect(bookingIncome({ ...base, payments: [...base.payments, refund(300_000), refund(100_000)] }).refunds).toBe(-100_000);
  });

  it('отмена: сверх назначенного возврата доход падает', () => {
    const x = bookingIncome({ ...base, status: 'CANCELLED_BY_CLIENT', refundAmount: 1_000_000, payments: [...base.payments, refund(1_000_000, 'PENDING'), refund(100_000)] });
    expect(x.cancellationFees).toBe(400_000);
  });
});

describe('период', () => {
  it('до 31 дня — дни, дальше — месяцы, границы включительно', () => {
    expect(periodKeys('2026-10-30', '2026-11-01')).toEqual({ granularity: 'day', keys: ['2026-10-30', '2026-10-31', '2026-11-01'] });
    expect(periodKeys('2026-10-01', '2026-10-31').granularity).toBe('day');
    expect(periodKeys('2026-10-31', '2027-01-02')).toEqual({ granularity: 'month', keys: ['2026-10', '2026-11', '2026-12', '2027-01'] });
  });

  it('пересечение брони с окном', () => {
    const d = (n: number) => new Date(Date.UTC(2026, 9, n));
    expect(overlapMs(d(1), d(5), d(3), d(10))).toBe(2 * 86_400_000);
    expect(overlapMs(d(1), d(2), d(3), d(10))).toBe(0);
  });
});
