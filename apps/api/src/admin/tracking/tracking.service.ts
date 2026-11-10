import { randomBytes } from 'node:crypto';
import { HttpStatus, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { canSeeMoney, type AdminTrackedBike, type AdminTrackedBikeDetail, type AdminTrackerSetup, type AdminTrackingList, type TrackedBooking } from '@rental/shared';
import { notFound } from '../../auth/api-errors';
import { apiError } from '../../bookings/errors';
import { scopeWhere, staffScope } from '../../auth/staff-scope';
import { writeAudit } from '../../bookings/audit';
import { Clock } from '../../jobs/clock';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminUser } from '../auth';
import { AdminBookingsService, withoutMoney } from '../bookings/admin-bookings.service';
import { FinanceService } from '../finance/finance.service';
import { actorOf, asBody, optStr } from '../fleet/input';
import { bikeAttention, gpsOnline, trackedState } from './state';

const H = 3_600_000;
const MAX_TRACK_HOURS = 24 * 30;
const MAX_TRACK_POINTS = 5000;
const HISTORY = 10;

const BIKE_INCLUDE = { model: { select: { name: true } } } satisfies Prisma.BikeInclude;
const BOOKING_SELECT = {
  id: true, code: true, bikeId: true, status: true, startAt: true, endAt: true, phone: true,
  user: { select: { firstName: true, lastName: true, username: true, telegramId: true, phone: true } },
} satisfies Prisma.BookingSelect;
type BikeRow = Prisma.BikeGetPayload<{ include: typeof BIKE_INCLUDE }>;
type BookingRow = Prisma.BookingGetPayload<{ select: typeof BOOKING_SELECT }>;

function clientName(u: BookingRow['user']): string {
  return [u.firstName, u.lastName].filter(Boolean).join(' ') || (u.username ? `@${u.username}` : u.telegramId);
}

const toTracked = (b: BookingRow): TrackedBooking => ({
  id: b.id,
  code: b.code,
  clientName: clientName(b.user),
  phone: b.phone ?? b.user.phone,
  startAt: b.startAt.toISOString(),
  endAt: b.endAt.toISOString(),
});

export function ingestUrl(token: string): string {
  return `${(process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '')}/api/gps/${token}`;
}

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly bookings: AdminBookingsService,
    private readonly finance: FinanceService,
  ) {}

  private scope(user: AdminUser, requested?: unknown) {
    return scopeWhere(staffScope(user), typeof requested === 'string' ? requested : undefined);
  }

  private async toRows(bikes: BikeRow[]): Promise<AdminTrackedBike[]> {
    const now = this.clock.now();
    const ids = bikes.map((b) => b.id);
    const [current, upcoming] = await Promise.all([
      this.prisma.booking.findMany({ where: { bikeId: { in: ids }, status: { in: ['ISSUED', 'PROBLEM'] } }, select: BOOKING_SELECT, orderBy: { endAt: 'asc' } }),
      this.prisma.booking.findMany({ where: { bikeId: { in: ids }, status: { in: ['CONFIRMED', 'PENDING_PAYMENT'] } }, select: BOOKING_SELECT, orderBy: { startAt: 'asc' } }),
    ]);
    const first = (rows: BookingRow[]) => {
      const m = new Map<string, BookingRow>();
      for (const r of rows) if (!m.has(r.bikeId)) m.set(r.bikeId, r);
      return m;
    };
    // ISSUED важнее PROBLEM: байк физически у клиента
    const byCurrent = first([...current.filter((r) => r.status === 'ISSUED'), ...current.filter((r) => r.status !== 'ISSUED')]);
    const byNext = first(upcoming);
    return bikes.map((b) => {
      const cur = byCurrent.get(b.id) ?? null;
      const next = byNext.get(b.id) ?? null;
      const hasTracker = !!b.trackerToken;
      const input = {
        status: b.status,
        current: cur ? { status: cur.status, endAt: cur.endAt } : null,
        next: next ? { startAt: next.startAt } : null,
        serviceDate: b.serviceDate,
        insuranceUntil: b.insuranceUntil,
        hasTracker,
        lastSeenAt: b.lastSeenAt,
        lastSpeedKmh: b.lastSpeedKmh,
      };
      return {
        id: b.id,
        plate: b.plate,
        modelName: b.model.name,
        locationId: b.locationId,
        status: b.status,
        state: trackedState(input, now),
        mileageKm: b.mileageKm,
        serviceDate: b.serviceDate?.toISOString() ?? null,
        insuranceUntil: b.insuranceUntil?.toISOString() ?? null,
        current: cur ? toTracked(cur) : null,
        next: next ? toTracked(next) : null,
        gps: {
          connected: hasTracker,
          lat: b.lastLat,
          lng: b.lastLng,
          speedKmh: b.lastSpeedKmh,
          batteryPct: b.lastBatteryPct,
          lastSeenAt: b.lastSeenAt?.toISOString() ?? null,
          online: hasTracker && gpsOnline(b.lastSeenAt, now),
        },
        attention: bikeAttention(input, now),
      };
    });
  }

  async list(user: AdminUser, q: Record<string, unknown>): Promise<AdminTrackingList> {
    const where = this.scope(user, q.locationId);
    const [bikes, location] = await Promise.all([
      this.prisma.bike.findMany({ where, include: BIKE_INCLUDE, orderBy: { plate: 'asc' } }),
      this.prisma.location.findFirst({ where: { ...(where.locationId ? { id: where.locationId } : {}), isActive: true }, orderBy: { createdAt: 'asc' }, select: { lat: true, lng: true } }),
    ]);
    return { items: await this.toRows(bikes), location };
  }

  private async visible(user: AdminUser, id: string): Promise<BikeRow> {
    const bike = await this.prisma.bike.findFirst({ where: { id, ...this.scope(user) }, include: BIKE_INCLUDE });
    if (!bike) throw notFound('Bike not found');
    return bike;
  }

  private setup(b: { trackerToken: string | null; trackerDeviceId: string | null }): AdminTrackerSetup | null {
    if (!b.trackerToken) return null;
    return { deviceId: b.trackerDeviceId, ingestUrl: ingestUrl(b.trackerToken), forwardEnabled: !!process.env.GPS_FORWARD_SECRET };
  }

  async detail(user: AdminUser, id: string, q: Record<string, unknown>): Promise<AdminTrackedBikeDetail> {
    const bike = await this.visible(user, id);
    const hours = Math.min(MAX_TRACK_HOURS, Math.max(1, Number(q.hours) || 24));
    const since = new Date(this.clock.now().getTime() - hours * H);
    const admin = canSeeMoney(user.role);
    const [[row], recent, history, finance] = await Promise.all([
      this.toRows([bike]),
      // последние точки: при редком лимите важнее свежий хвост трека
      this.prisma.bikePosition.findMany({ where: { bikeId: id, recordedAt: { gte: since } }, orderBy: { recordedAt: 'desc' }, take: MAX_TRACK_POINTS }),
      this.bookings.rows({ bikeId: id }, { startAt: 'desc' }, HISTORY),
      admin ? this.finance.bikeLifetime(id, bike.purchasePrice) : Promise.resolve(null),
    ]);
    return {
      bike: row!,
      track: recent.reverse().map((p) => ({ lat: p.lat, lng: p.lng, speedKmh: p.speedKmh, at: p.recordedAt.toISOString() })),
      history: admin ? history : history.map(withoutMoney),
      finance,
      tracker: admin ? this.setup(bike) : null,
    };
  }

  /** Подключить трекер или изменить ID устройства. Секрет создаётся один раз; новый — через отключение. */
  async connect(user: AdminUser, id: string, body: unknown): Promise<AdminTrackerSetup> {
    const bike = await this.visible(user, id);
    const deviceId = optStr(asBody(body).deviceId, 'deviceId', 64);
    try {
      const saved = await this.prisma.bike.update({ where: { id }, data: { trackerDeviceId: deviceId, trackerToken: bike.trackerToken ?? `gps_${randomBytes(24).toString('base64url')}` } });
      await writeAudit(this.prisma, actorOf(user), bike.trackerToken ? 'tracker.update' : 'tracker.connect', 'Bike', id, { deviceId });
      return this.setup(saved)!;
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw apiError(HttpStatus.CONFLICT, 'TRACKER_TAKEN', 'Tracker is used by another bike');
      throw e;
    }
  }

  /** Отключить трекер: старый адрес перестаёт работать, текущая позиция стирается, трек доживает до очистки. */
  async disconnect(user: AdminUser, id: string): Promise<void> {
    await this.visible(user, id);
    await this.prisma.bike.update({ where: { id }, data: { trackerDeviceId: null, trackerToken: null, lastLat: null, lastLng: null, lastSpeedKmh: null, lastBatteryPct: null, lastSeenAt: null, motionAlertAt: null } });
    await writeAudit(this.prisma, actorOf(user), 'tracker.disconnect', 'Bike', id);
  }
}
