import { Injectable } from '@nestjs/common';
import type { BikeStatus, BookingStatus } from '@prisma/client';
import { fromLocationDateTime, HOLDING_BOOKING_STATUSES } from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { loadSettings } from '../pricing/settings';
import { badRequest, notFound } from '../auth/api-errors';

// Доступность модели: свободный байк = не списан, не в ремонте на начало периода и без держащей брони,
// пересекающейся с [from, to + буфер). Держат байк PENDING_PAYMENT / CONFIRMED / ISSUED / PROBLEM —
// тот же набор, что в exclusion constraint bookings_bike_no_overlap.

export interface ModelAvailability {
  freeCount: number;
  /** Самый ранний момент, с которого период той же длины помещается на какой-то байк; null — модель свободна или срок неизвестен */
  busyUntil: Date | null;
}

interface Interval {
  start: number;
  end: number;
}
interface BikeState {
  id: string;
  modelId: string;
  status: BikeStatus;
  readyAt: Date | null;
  busy: Interval[];
}

const HOLDING = [...HOLDING_BOOKING_STATUSES] as BookingStatus[];
const MIN = 60_000;
const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Конец ремонта: −∞ — исправен, +∞ — в ремонте без даты готовности. */
function repairUntil(b: BikeState): number {
  if (b.status !== 'REPAIR') return -Infinity;
  return b.readyAt ? b.readyAt.getTime() : Infinity;
}

function conflicts(b: BikeState, start: number, end: number): Interval[] {
  return b.busy.filter((i) => i.start < end && i.end > start);
}

/** Раньше всего, когда на байк помещается интервал длиной `len` (с буфером) не раньше `from`. */
function earliestStart(b: BikeState, from: number, len: number): number {
  let t = Math.max(from, repairUntil(b));
  for (let guard = 0; guard <= b.busy.length && Number.isFinite(t); guard++) {
    const hit = conflicts(b, t, t + len);
    if (hit.length === 0) return t;
    t = Math.max(...hit.map((i) => i.end));
  }
  return Number.isFinite(t) && conflicts(b, t, t + len).length === 0 ? t : Infinity;
}

/** Покрыт ли интервал [start, end) занятостью байка целиком. */
function fullyCovered(b: BikeState, start: number, end: number): boolean {
  let t = Math.max(start, repairUntil(b));
  if (t >= end) return true;
  for (const i of [...b.busy].sort((x, y) => x.start - y.start)) {
    if (i.start > t) break;
    if (i.end > t) t = i.end;
    if (t >= end) return true;
  }
  return t >= end;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  private async bikes(modelIds: string[], from: Date, until?: Date): Promise<BikeState[]> {
    const rows = await this.prisma.bike.findMany({
      where: { modelId: { in: modelIds }, status: { not: 'RETIRED' } },
      select: { id: true, modelId: true, status: true, readyAt: true },
    });
    if (rows.length === 0) return [];
    const bookings = await this.prisma.booking.findMany({
      where: {
        bikeId: { in: rows.map((r) => r.id) },
        status: { in: HOLDING },
        OR: [{ blockedUntil: { gt: from } }, { blockedUntil: null, endAt: { gt: from } }, { status: 'ISSUED' }],
        ...(until ? { startAt: { lt: until } } : {}),
      },
      select: { bikeId: true, status: true, startAt: true, endAt: true, blockedUntil: true, bufferMinutes: true },
    });
    return rows.map((r) => ({
      ...r,
      busy: bookings
        .filter((bk) => bk.bikeId === r.id)
        .map((bk) => {
          const end = (bk.blockedUntil ?? new Date(bk.endAt.getTime() + bk.bufferMinutes * MIN)).getTime();
          // Просроченный и не возвращённый байк занят и сейчас, хотя срок брони вышел
          return { start: bk.startAt.getTime(), end: bk.status === 'ISSUED' ? Math.max(end, Date.now() + bk.bufferMinutes * MIN) : end };
        })
        .sort((x, y) => x.start - y.start),
    }));
  }

  /** Доступность сразу для нескольких моделей на период [from, to) — для каталога (2 запроса). */
  async availabilityFor(modelIds: string[], from: Date, to: Date): Promise<Map<string, ModelAvailability>> {
    const { bufferMinutes } = await loadSettings(this.prisma, ['bufferMinutes']);
    const bikes = await this.bikes(modelIds, from);
    const start = from.getTime();
    const len = to.getTime() - start + bufferMinutes * MIN;
    const out = new Map<string, ModelAvailability>();
    for (const id of modelIds) {
      const own = bikes.filter((b) => b.modelId === id);
      const starts = own.map((b) => earliestStart(b, start, len));
      const freeCount = starts.filter((t) => t === start).length;
      const next = Math.min(Infinity, ...starts);
      out.set(id, { freeCount, busyUntil: freeCount > 0 || !Number.isFinite(next) ? null : new Date(next) });
    }
    return out;
  }

  /** Без дат: есть ли исправный байк сейчас (ACTIVE или ремонт закончен). */
  async hasServiceableBike(modelIds: string[], now = new Date()): Promise<Set<string>> {
    const rows = await this.prisma.bike.findMany({
      where: { modelId: { in: modelIds }, OR: [{ status: 'ACTIVE' }, { status: 'REPAIR', readyAt: { lte: now } }] },
      select: { modelId: true },
      distinct: ['modelId'],
    });
    return new Set(rows.map((r) => r.modelId));
  }

  async freeBikeCount(modelId: string, from: Date, to: Date): Promise<number> {
    return (await this.availabilityFor([modelId], from, to)).get(modelId)?.freeCount ?? 0;
  }

  async busyUntil(modelId: string, from: Date, to: Date = new Date(from.getTime() + 86_400_000)): Promise<Date | null> {
    return (await this.availabilityFor([modelId], from, to)).get(modelId)?.busyUntil ?? null;
  }

  /** Даты месяца (YYYY-MM-DD в tz точки), когда в часы работы точки нет ни одного свободного байка модели. */
  async busyDates(modelId: string, month: string): Promise<string[]> {
    const m = MONTH_RE.exec(month);
    if (!m) throw badRequest('month must be YYYY-MM');
    const model = await this.prisma.bikeModel.findFirst({ where: { id: modelId, isActive: true }, include: { location: true } });
    if (!model) throw notFound('Model not found');
    const { timezone, openTime, closeTime } = model.location;
    const year = Number(m[1]);
    const mon = Number(m[2]);
    const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const dates = Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);
    const windows = dates.map((d) => ({ date: d, start: fromLocationDateTime(d, openTime, timezone).getTime(), end: fromLocationDateTime(d, closeTime, timezone).getTime() }));
    const bikes = await this.bikes([modelId], new Date(windows[0]!.start), new Date(windows[windows.length - 1]!.end));
    return windows.filter((w) => bikes.every((b) => fullyCovered(b, w.start, w.end))).map((w) => w.date);
  }
}
