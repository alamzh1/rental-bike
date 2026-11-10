import { Injectable } from '@nestjs/common';
import type { BookingStatus, Prisma } from '@prisma/client';
import { canSeeMoney, fromLocationDateTime, toLocationDate, type AdminDashboard, type AdminFunnelStep } from '@rental/shared';
import { addDays, formatISO, parseISO } from 'date-fns';
import { PrismaService } from '../../prisma/prisma.service';
import { Clock } from '../../jobs/clock';
import type { AdminUser } from '../auth';
import { scopeLocationId, scopeWhere, staffScope } from '../../auth/staff-scope';
import { AdminBookingsService, withoutMoney } from '../bookings/admin-bookings.service';

const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const FUNNEL: AdminFunnelStep['name'][] = ['open', 'dates_selected', 'model_viewed', 'checkout_opened', 'paid'];
const FUNNEL_DAYS = 30;
/** Брони, которые держат байк и приносят выручку (без отменённых и неоплаченных) */
const EARNING: BookingStatus[] = ['CONFIRMED', 'ISSUED', 'COMPLETED', 'PROBLEM'];
/** Байк занят сегодня */
const OCCUPYING: BookingStatus[] = ['CONFIRMED', 'ISSUED', 'PROBLEM'];
const DAY_MS = 24 * 60 * 60 * 1000;

const ymd = (d: Date) => formatISO(d, { representation: 'date' });

/** Начало календарного дня YYYY-MM-DD в tz точки (UTC-момент). */
const dayStart = (date: string, tz: string) => fromLocationDateTime(date, '00:00', tz);

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly bookings: AdminBookingsService,
  ) {}

  async get(user: AdminUser, locationParam?: string): Promise<AdminDashboard> {
    const staff = staffScope(user);
    const locationId = scopeLocationId(staff, locationParam);
    const loc = locationId
      ? await this.prisma.location.findUnique({ where: { id: locationId }, select: { timezone: true } })
      : await this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { timezone: true } });
    const tz = loc?.timezone ?? DEFAULT_TZ;
    const now = this.clock.now();
    const today = toLocationDate(now, tz);
    const d = parseISO(today); // календарная дата без времени — только для арифметики дней
    const todayFrom = dayStart(today, tz);
    const todayTo = dayStart(ymd(addDays(d, 1)), tz);
    const weekday = (d.getDay() + 6) % 7; // пн = 0
    const weekFrom = dayStart(ymd(addDays(d, -weekday)), tz);
    const weekTo = dayStart(ymd(addDays(d, 7 - weekday)), tz);
    const monthFrom = dayStart(`${today.slice(0, 7)}-01`, tz);
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const monthTo = dayStart(ymd(next), tz);

    const scope: Prisma.BookingWhereInput = scopeWhere(staff, locationParam);
    const bikeScope: Prisma.BikeWhereInput = scopeWhere(staff, locationParam);

    const [issuesToday, returnsToday, fleetSize, busy, unpaidCount, unpaidRows, overdue, endingSoon] = await Promise.all([
      this.prisma.booking.count({ where: { ...scope, status: { in: ['PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM'] }, startAt: { gte: todayFrom, lt: todayTo } } }),
      this.prisma.booking.count({ where: { ...scope, status: { in: ['CONFIRMED', 'ISSUED', 'PROBLEM', 'COMPLETED'] }, endAt: { gte: todayFrom, lt: todayTo } } }),
      this.prisma.bike.count({ where: { ...bikeScope, status: { not: 'RETIRED' } } }),
      this.prisma.booking.findMany({
        where: { ...scope, status: { in: OCCUPYING }, startAt: { lt: todayTo }, endAt: { gt: todayFrom }, bike: { status: { not: 'RETIRED' } } },
        select: { bikeId: true },
        distinct: ['bikeId'],
      }),
      this.prisma.booking.count({ where: { ...scope, status: 'PENDING_PAYMENT' } }),
      this.bookings.rows({ ...scope, status: 'PENDING_PAYMENT' }, { startAt: 'asc' }, 10),
      this.bookings.rows({ ...scope, status: 'ISSUED', endAt: { lt: now } }, { endAt: 'asc' }, 50),
      this.bookings.rows({ ...scope, status: 'ISSUED', endAt: { gte: now, lt: new Date(now.getTime() + DAY_MS) } }, { endAt: 'asc' }, 50),
    ]);

    const revenue =
      canSeeMoney(user.role)
        ? {
            day: await this.revenue(scope, todayFrom, todayTo),
            week: await this.revenue(scope, weekFrom, weekTo),
            month: await this.revenue(scope, monthFrom, monthTo),
          }
        : null;

    const since = new Date(now.getTime() - FUNNEL_DAYS * DAY_MS);
    const [steps, sources] = await Promise.all([
      this.prisma.analyticsEvent.groupBy({ by: ['name'], where: { name: { in: FUNNEL }, createdAt: { gte: since } }, _count: { _all: true } }),
      this.prisma.analyticsEvent.groupBy({ by: ['source'], where: { name: 'open', source: { not: null }, createdAt: { gte: since } }, _count: { _all: true } }),
    ]);
    const stepCount = new Map(steps.map((s) => [s.name, s._count._all]));

    return {
      date: today,
      timezone: tz,
      issuesToday,
      returnsToday,
      fleetSize,
      busyBikes: busy.length,
      fleetLoadPercent: fleetSize ? Math.round((busy.length * 100) / fleetSize) : 0,
      revenue,
      unpaid: { count: unpaidCount, items: canSeeMoney(user.role) ? unpaidRows : unpaidRows.map(withoutMoney) },
      rentals: { overdue: canSeeMoney(user.role) ? overdue : overdue.map(withoutMoney), endingSoon: canSeeMoney(user.role) ? endingSoon : endingSoon.map(withoutMoney) },
      funnel: {
        days: FUNNEL_DAYS,
        steps: FUNNEL.map((name) => ({ name, count: user.role === 'ADMIN' ? (stepCount.get(name) ?? 0) : 0 })),
        sources: (user.role === 'ADMIN' ? sources : [])
          .map((s) => ({ source: s.source as string, count: s._count._all }))
          .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source))
          .slice(0, 10),
      },
    };
  }

  /** Аренда + опции + доставка (totalAmount) + доплата за опоздание по броням с началом в [from, to). */
  private async revenue(scope: Prisma.BookingWhereInput, from: Date, to: Date): Promise<number> {
    const r = await this.prisma.booking.aggregate({
      where: { ...scope, status: { in: EARNING }, startAt: { gte: from, lt: to } },
      _sum: { totalAmount: true, lateFeeAmount: true },
    });
    return (r._sum.totalAmount ?? 0) + (r._sum.lateFeeAmount ?? 0);
  }
}
