import type { BikeAttention, TrackedState } from '@rental/shared';

// Состояние байка и поводы для внимания — чистые функции (тесты в state.spec.ts).

const H = 3_600_000;
const DAY = 24 * H;
/** Сигнал считается свежим */
export const GPS_ONLINE_MS = 30 * 60_000;
/** Скорость, при которой байк без аренды считается едущим: шум GPS стоящего байка заметно ниже */
export const MOVING_KMH = 15;
const MOVING_FRESH_MS = 10 * 60_000;
const ENDING_SOON_MS = DAY;
const RESERVED_WITHIN_MS = DAY;
const INSURANCE_SOON_MS = 30 * DAY;
const SERVICE_SOON_MS = 7 * DAY;

export interface StateInput {
  status: 'ACTIVE' | 'REPAIR' | 'RETIRED';
  /** Бронь, по которой байк сейчас у клиента или в проблеме */
  current: { status: string; endAt: Date } | null;
  next: { startAt: Date } | null;
  serviceDate: Date | null;
  insuranceUntil: Date | null;
  hasTracker: boolean;
  lastSeenAt: Date | null;
  lastSpeedKmh: number | null;
}

export function trackedState(b: Pick<StateInput, 'status' | 'current' | 'next'>, now: Date): TrackedState {
  if (b.status === 'RETIRED') return 'RETIRED';
  if (b.current?.status === 'ISSUED') return b.current.endAt < now ? 'OVERDUE' : 'RENTED';
  if (b.current?.status === 'PROBLEM') return 'PROBLEM';
  if (b.status === 'REPAIR') return 'REPAIR';
  if (b.next && b.next.startAt.getTime() - now.getTime() <= RESERVED_WITHIN_MS) return 'RESERVED';
  return 'FREE';
}

export const gpsOnline = (lastSeenAt: Date | null, now: Date): boolean => !!lastSeenAt && now.getTime() - lastSeenAt.getTime() <= GPS_ONLINE_MS;

export function bikeAttention(b: StateInput, now: Date): BikeAttention[] {
  const out: BikeAttention[] = [];
  const t = now.getTime();
  const rented = b.current?.status === 'ISSUED';
  if (rented && b.current) {
    const left = b.current.endAt.getTime() - t;
    if (left < 0) out.push('OVERDUE');
    else if (left <= ENDING_SOON_MS) out.push('ENDING_SOON');
  }
  if (b.status === 'RETIRED') return out;
  if (b.hasTracker) {
    if (!rented && (b.lastSpeedKmh ?? 0) >= MOVING_KMH && !!b.lastSeenAt && t - b.lastSeenAt.getTime() <= MOVING_FRESH_MS) out.push('MOVING_UNRENTED');
    if (!gpsOnline(b.lastSeenAt, now)) out.push('GPS_OFFLINE');
  }
  if (b.insuranceUntil) {
    const left = b.insuranceUntil.getTime() - t;
    if (left < 0) out.push('INSURANCE_EXPIRED');
    else if (left <= INSURANCE_SOON_MS) out.push('INSURANCE_SOON');
  }
  if (b.serviceDate && b.serviceDate.getTime() - t <= SERVICE_SOON_MS) out.push('SERVICE_DUE');
  return out;
}
