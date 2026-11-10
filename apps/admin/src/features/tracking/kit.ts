import type { BadgeTone } from '@rental/ui';
import type { TrackedState } from '@rental/shared';

export const STATE_TONE: Record<TrackedState, BadgeTone> = {
  OVERDUE: 'danger',
  RENTED: 'accent',
  PROBLEM: 'danger',
  RESERVED: 'warning',
  FREE: 'success',
  REPAIR: 'warning',
  RETIRED: 'neutral',
};

/** Осталось времени в часах и минутах; отрицательное — просрочка. */
export function leftParts(iso: string, now: number): { hours: number; minutes: number; overdue: boolean } {
  const ms = Date.parse(iso) - now;
  const abs = Math.abs(ms);
  return { hours: Math.floor(abs / 3_600_000), minutes: Math.floor((abs % 3_600_000) / 60_000), overdue: ms < 0 };
}

export const mapsUrl = (lat: number, lng: number) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
