import type { BookingStatus } from './types.js';

export interface LateFeeRules { graceMinutes: number; hourlyFee: number; extraDayAfterHours: number; dayPrice: number }
export interface RefundRules { fullHours: number; halfHours: number; halfPercent: number }

const MIN_MS = 60_000;
const DAY_MIN = 1440;

/**
 * Доплата за опоздание (ТЗ §5.2): до graceMinutes — бесплатно, дальше — почасовая за каждый начатый час
 * сверх льготного, больше extraDayAfterHours — ещё сутки. Полные сутки опоздания — по суткам, остаток — по тем же правилам.
 */
export function lateFee(plannedEnd: Date, actualEnd: Date, rules: LateFeeRules): number {
  const lateMin = Math.ceil((actualEnd.getTime() - plannedEnd.getTime()) / MIN_MS);
  if (lateMin <= 0) return 0;
  const fullDays = Math.floor(lateMin / DAY_MIN);
  const rest = lateMin - fullDays * DAY_MIN;
  let fee = fullDays * rules.dayPrice;
  if (rest > rules.extraDayAfterHours * 60) fee += rules.dayPrice;
  else if (rest > rules.graceMinutes) fee += Math.ceil((rest - rules.graceMinutes) / 60) * rules.hourlyFee;
  return fee;
}

/** Процент возврата при отмене (ТЗ §5.6): > fullHours до выдачи — 100, от fullHours до halfHours — halfPercent, меньше — 0. */
export function refundPercent(startAt: Date, cancelledAt: Date, rules: RefundRules): number {
  const hoursBefore = (startAt.getTime() - cancelledAt.getTime()) / 3_600_000;
  if (hoursBefore > rules.fullHours) return 100;
  if (hoursBefore >= rules.halfHours) return rules.halfPercent;
  return 0;
}

export const BOOKING_STATUSES: readonly BookingStatus[] = [
  'PENDING_PAYMENT',
  'CONFIRMED',
  'ISSUED',
  'COMPLETED',
  'CANCELLED_BY_CLIENT',
  'CANCELLED_BY_SYSTEM',
  'PROBLEM',
];

/** Статусы, в которых бронь держит байк (совпадает с условием exclusion constraint в БД). */
export const HOLDING_BOOKING_STATUSES: readonly BookingStatus[] = ['PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM'];

const TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  PENDING_PAYMENT: ['CONFIRMED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM', 'PROBLEM'],
  CONFIRMED: ['ISSUED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM', 'PROBLEM'],
  ISSUED: ['COMPLETED', 'PROBLEM'],
  PROBLEM: ['CONFIRMED', 'ISSUED', 'COMPLETED', 'CANCELLED_BY_SYSTEM'],
  COMPLETED: [],
  CANCELLED_BY_CLIENT: [],
  CANCELLED_BY_SYSTEM: [],
};

/**
 * Переход с учётом истории брони. «Проблема» помнит, был ли байк выдан: выданный нельзя снова «подтвердить» или
 * отменить (байк у клиента), а невыданный нельзя объявить выданным или завершённым без акта.
 */
export function canTransitionBooking(from: BookingStatus, to: BookingStatus, wasIssued: boolean): boolean {
  if (!canTransition(from, to)) return false;
  if (from !== 'PROBLEM') return true;
  return wasIssued ? to === 'ISSUED' || to === 'COMPLETED' : to === 'CONFIRMED' || to === 'CANCELLED_BY_SYSTEM';
}

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Код брони для назначения перевода и экрана: BK-24117 (минимум 5 цифр). */
export function bookingCode(seq: number): string {
  if (!Number.isInteger(seq) || seq <= 0) throw new RangeError(`Invalid booking sequence: ${seq}`);
  return `BK-${String(seq).padStart(5, '0')}`;
}
