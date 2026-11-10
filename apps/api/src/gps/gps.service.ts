import { timingSafeEqual } from 'node:crypto';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import type { Bike } from '@prisma/client';
import { badRequest, notFound } from '../auth/api-errors';
import { MOVING_KMH } from '../admin/tracking/state';
import { Clock, JobsService } from '../jobs';
import { NotificationsService } from '../notifications';
import { PrismaService } from '../prisma/prisma.service';
import { parseGpsPoint } from './parse';

const JOB_CLEANUP = 'gps.cleanup';
const DAY = 86_400_000;
const RETENTION_DAYS = 30;
const CLEANUP_EVERY_MS = DAY;
const MIN_INTERVAL_MS = 5_000;
const MAX_FUTURE_MS = 5 * 60_000;
const MOTION_ALERT_EVERY_MS = 60 * 60_000;

function sameSecret(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Приём точек от трекеров: обновляет позицию байка, пишет трек, предупреждает о движении без аренды. */
@Injectable()
export class GpsService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly jobs: JobsService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.jobs.every(JOB_CLEANUP, CLEANUP_EVERY_MS, () => this.cleanup());
  }

  async byToken(token: string, query: Record<string, unknown>, body: unknown): Promise<void> {
    const bike = await this.prisma.bike.findUnique({ where: { trackerToken: token } });
    if (!bike) throw notFound('Unknown tracker');
    await this.ingest(bike, query, body);
  }

  /** Приём от Traccar Server: один секрет на сервер, байк определяется по ID устройства. */
  async byDevice(secret: unknown, deviceId: unknown, query: Record<string, unknown>, body: unknown): Promise<void> {
    const expected = process.env.GPS_FORWARD_SECRET;
    if (!expected || typeof secret !== 'string' || !sameSecret(secret, expected) || typeof deviceId !== 'string' || !deviceId) throw notFound('Unknown tracker');
    const bike = await this.prisma.bike.findUnique({ where: { trackerDeviceId: deviceId } });
    if (!bike?.trackerToken) throw notFound('Unknown tracker');
    await this.ingest(bike, query, body);
  }

  private async ingest(bike: Bike, query: Record<string, unknown>, body: unknown): Promise<void> {
    const point = parseGpsPoint(query, body);
    if (!point) throw badRequest('lat and lon are required');
    const now = this.clock.now();
    const at = point.at ?? now;
    if (at.getTime() > now.getTime() + MAX_FUTURE_MS) throw badRequest('timestamp is in the future');
    const last = bike.lastSeenAt?.getTime() ?? 0;
    if (last && Math.abs(at.getTime() - last) < MIN_INTERVAL_MS) return;
    await this.prisma.bikePosition.create({ data: { bikeId: bike.id, lat: point.lat, lng: point.lng, speedKmh: point.speedKmh, recordedAt: at } });
    if (at.getTime() <= last) return; // догнавшая старая точка: только в трек
    await this.prisma.bike.update({ where: { id: bike.id }, data: { lastLat: point.lat, lastLng: point.lng, lastSpeedKmh: point.speedKmh, lastSeenAt: at, ...(point.batteryPct !== null ? { lastBatteryPct: point.batteryPct } : {}) } });
    if ((point.speedKmh ?? 0) >= MOVING_KMH) await this.alertIfUnrented(bike, now);
  }

  private async alertIfUnrented(bike: Bike, now: Date): Promise<void> {
    if (bike.status === 'RETIRED') return;
    if (bike.motionAlertAt && now.getTime() - bike.motionAlertAt.getTime() < MOTION_ALERT_EVERY_MS) return;
    const rented = await this.prisma.booking.count({ where: { bikeId: bike.id, status: 'ISSUED' } });
    if (rented) return;
    await this.prisma.bike.update({ where: { id: bike.id }, data: { motionAlertAt: now } });
    await this.notifications.bikeMoving(bike.id);
  }

  async cleanup(): Promise<void> {
    await this.prisma.bikePosition.deleteMany({ where: { recordedAt: { lt: new Date(this.clock.now().getTime() - RETENTION_DAYS * DAY) } } });
  }
}
