import { Inject, Injectable } from '@nestjs/common';
import type { AdminSupervision, AdminSupervisionPoint, I18nText } from '@rental/shared';
import { Clock } from '../../jobs/clock';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../../payments/payment-provider';
import { PrismaService } from '../../prisma/prisma.service';
import { displayName, type AdminUser } from '../auth';
import { FinanceService } from '../finance/finance.service';

// Контроль владельцев: сводка по каждой точке для администратора платформы. На что смотреть — просрочки, случаи «байка нет»,
// несделанные возвраты, выдачи без фотоакта и когда владелец в последний раз работал в системе.

const DAY = 86_400_000;
const INCIDENT_DAYS = 30;

@Injectable()
export class SupervisionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly finance: FinanceService,
    @Inject(PAYMENT_PROVIDER) private readonly platform: PaymentProvider,
  ) {}

  private async point(user: AdminUser, l: { id: string; name: unknown; address: string; isActive: boolean; payosClientId: string | null }, now: Date): Promise<AdminSupervisionPoint> {
    const locationId = l.id;
    const [summary, staff, bikes, active, overdue, openIncidents, recentIncidents, refunds, withoutIssueAct, withoutReturnAct, last] = await Promise.all([
      this.finance.summary({ ...user, locationId: null }, { locationId }),
      this.prisma.user.findMany({ where: { locationId, role: { in: ['OWNER', 'MANAGER'] } }, select: { role: true, firstName: true, lastName: true, username: true, telegramId: true } }),
      this.prisma.bike.count({ where: { locationId, status: { not: 'RETIRED' } } }),
      this.prisma.booking.count({ where: { locationId, status: 'ISSUED' } }),
      this.prisma.booking.count({ where: { locationId, status: 'ISSUED', endAt: { lt: now } } }),
      this.prisma.bookingIncident.count({ where: { locationId, status: 'OPEN' } }),
      this.prisma.bookingIncident.count({ where: { locationId, createdAt: { gte: new Date(now.getTime() - INCIDENT_DAYS * DAY) } } }),
      this.prisma.payment.aggregate({ where: { kind: 'REFUND', status: 'PENDING', booking: { locationId } }, _sum: { amount: true } }),
      this.prisma.booking.count({ where: { locationId, actualStartAt: { not: null }, handoverActs: { none: { kind: 'ISSUE' } } } }),
      this.prisma.booking.count({ where: { locationId, status: 'COMPLETED', handoverActs: { none: { kind: 'RETURN' } } } }),
      this.prisma.auditLog.findFirst({ where: { actor: { locationId } }, orderBy: { createdAt: 'desc' }, select: { createdAt: true } }),
    ]);
    return {
      locationId,
      name: l.name as I18nText,
      address: l.address,
      isActive: l.isActive,
      owners: staff.filter((s) => s.role === 'OWNER').map(displayName),
      managers: staff.filter((s) => s.role === 'MANAGER').map(displayName),
      bikes,
      activeRentals: active,
      overdue,
      income: summary.income,
      expenses: summary.expenses,
      profit: summary.profit,
      outstanding: summary.outstanding,
      pendingRefunds: refunds._sum.amount ?? 0,
      openIncidents,
      recentIncidents,
      withoutPhotoAct: withoutIssueAct + withoutReturnAct,
      payosAccount: l.payosClientId ? 'own' : this.platform.name === 'payos' ? 'platform' : this.platform.name === 'test' ? 'test' : 'off',
      lastActivityAt: last?.createdAt.toISOString() ?? null,
    };
  }

  async overview(user: AdminUser): Promise<AdminSupervision> {
    const now = this.clock.now();
    const locations = await this.prisma.location.findMany({ orderBy: { createdAt: 'asc' }, select: { id: true, name: true, address: true, isActive: true, payosClientId: true } });
    const points = await Promise.all(locations.map((l) => this.point(user, l, now)));
    const incidents = await this.prisma.bookingIncident.findMany({
      where: { status: 'OPEN' },
      orderBy: { createdAt: 'asc' },
      take: 50,
      include: { booking: { select: { id: true, code: true, startAt: true, model: { select: { name: true } } } }, location: { select: { name: true } } },
    });
    return {
      incidentDays: INCIDENT_DAYS,
      points,
      openIncidents: incidents.map((i) => ({
        id: i.id,
        bookingId: i.bookingId,
        code: i.booking.code,
        modelName: i.booking.model.name,
        startAt: i.booking.startAt.toISOString(),
        pointName: i.location.name as I18nText,
        source: i.source,
        escalated: !!i.escalatedAt,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  }
}
