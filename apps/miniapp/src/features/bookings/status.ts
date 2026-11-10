import type { BookingStatus } from '@rental/shared';

// История 39: «Активные» — байк у клиента или проблема; «Предстоящие» — ждёт оплаты или подтверждена;
// «Завершённые» — завершённые и отменённые.
export type BookingTab = 'active' | 'upcoming' | 'past';
export const BOOKING_TABS: BookingTab[] = ['active', 'upcoming', 'past'];

/** Вкладка «Мои брони», в которую попадает бронь. */
export function bookingTab(status: BookingStatus | string): BookingTab {
  if (status === 'ISSUED' || status === 'PROBLEM') return 'active';
  if (status === 'CONFIRMED' || status === 'PENDING_PAYMENT') return 'upcoming';
  return 'past';
}

/** Вкладка при открытии экрана: первая непустая; без броней — «Активные». */
export function initialTab(items: { status: BookingStatus | string }[]): BookingTab {
  return BOOKING_TABS.find((tab) => items.some((b) => bookingTab(b.status) === tab)) ?? 'active';
}

/** Конец аренды для предупреждений: за сутки — soon, после срока — overdue; только пока байк у клиента. */
export function rentalEnding(b: { status: string; endAt: string }, now: number): 'soon' | 'overdue' | null {
  if (b.status !== 'ISSUED') return null;
  const left = Date.parse(b.endAt) - now;
  if (left <= 0) return 'overdue';
  return left <= 24 * 3_600_000 ? 'soon' : null;
}

export function remainingMs(until: string, now: number): number {
  return Math.max(0, Date.parse(until) - now);
}

/** «15:00», «09:05»; от часа — «1:02:05». Округление вверх: «00:00» только когда время вышло. */
export function formatCountdown(ms: number): string {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Опрос статуса: раз в 3 с, пока бронь ждёт оплаты (webhook меняет статус на сервере). */
export function pollInterval(status: BookingStatus | string): number | false {
  return status === 'PENDING_PAYMENT' ? 3000 : false;
}

export type CardTimer = { kind: 'payWithin' | 'startsIn' | 'returnIn'; ms: number };

/** Таймер карточки брони (история 39): до оплаты, до выдачи или до возврата; у завершённых и отменённых его нет. */
export function cardTimer(b: { status: string; holdExpiresAt: string | null; startAt: string; endAt: string }, now: number): CardTimer | null {
  if (b.status === 'PENDING_PAYMENT' && b.holdExpiresAt) return { kind: 'payWithin', ms: remainingMs(b.holdExpiresAt, now) };
  if (b.status === 'CONFIRMED') return { kind: 'startsIn', ms: remainingMs(b.startAt, now) };
  if (b.status === 'ISSUED') return { kind: 'returnIn', ms: remainingMs(b.endAt, now) };
  return null;
}
