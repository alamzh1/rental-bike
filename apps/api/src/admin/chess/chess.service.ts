import { Injectable } from '@nestjs/common';
import type { ChessResponse } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { Clock } from '../../jobs/clock';
import { badRequest } from '../../auth/api-errors';
import { scopeLocationId, scopeWhere, staffScope } from '../../auth/staff-scope';
import { parseInstant } from '../../catalog/query';
import { displayName, type AdminUser } from '../auth';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS = 62;
const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';

// Шахматка: байки строками, брони полосами (с буфером) в окне [from, to). Списанные байки — только если на них есть брони.
@Injectable()
export class ChessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
  ) {}

  async get(user: AdminUser, q: Record<string, unknown>): Promise<ChessResponse> {
    const now = this.clock.now();
    const from = q.from ? parseInstant(q.from, 'from') : new Date(now.getTime() - DAY_MS);
    const to = q.to ? parseInstant(q.to, 'to') : new Date(from.getTime() + 14 * DAY_MS);
    if (to.getTime() <= from.getTime()) throw badRequest('to must be after from');
    if (to.getTime() - from.getTime() > MAX_DAYS * DAY_MS) throw badRequest(`window must be at most ${MAX_DAYS} days`);
    const staff = staffScope(user);
    const requested = typeof q.locationId === 'string' && q.locationId ? q.locationId : undefined;
    const locationId = scopeLocationId(staff, requested);
    const scope = scopeWhere(staff, requested);

    const bookings = await this.prisma.booking.findMany({
      where: { ...scope, status: { notIn: ['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM'] }, startAt: { lt: to }, OR: [{ blockedUntil: { gt: from } }, { blockedUntil: null, endAt: { gt: from } }] },
      include: { user: { select: { firstName: true, lastName: true, username: true, telegramId: true } } },
      orderBy: { startAt: 'asc' },
    });
    const withBookings = [...new Set(bookings.map((b) => b.bikeId))];
    const bikes = await this.prisma.bike.findMany({
      where: { ...scope, OR: [{ status: { not: 'RETIRED' } }, { id: { in: withBookings } }] },
      include: { model: { select: { name: true } } },
      orderBy: [{ model: { name: 'asc' } }, { plate: 'asc' }],
    });
    const loc = locationId ? await this.prisma.location.findUnique({ where: { id: locationId }, select: { timezone: true } }) : await this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { timezone: true } });

    return {
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: loc?.timezone ?? DEFAULT_TZ,
      bikes: bikes.map((b) => ({ id: b.id, plate: b.plate, modelId: b.modelId, modelName: b.model.name, status: b.status, readyAt: b.readyAt ? b.readyAt.toISOString() : null, isDemo: b.isDemo })),
      bookings: bookings.map((b) => ({
        id: b.id,
        code: b.code,
        bikeId: b.bikeId,
        modelId: b.modelId,
        status: b.status,
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        blockedUntil: (b.blockedUntil ?? new Date(b.endAt.getTime() + b.bufferMinutes * 60_000)).toISOString(),
        clientName: displayName(b.user),
      })),
    };
  }
}
