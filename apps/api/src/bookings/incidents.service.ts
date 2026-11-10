import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Prisma, type BookingIncident } from '@prisma/client';
import { HOLDING_BOOKING_STATUSES, INCIDENT_CLIENT_CANCEL_MINUTES, INCIDENT_REPORT_BEFORE_START_HOURS, type IncidentReplacement, NO_LICENSE_MAX_CC } from '@rental/shared';
import { notFound } from '../auth/api-errors';
import { JobsService } from '../jobs/jobs.service';
import { Clock } from '../jobs/clock';
import { PricingService } from '../pricing/pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM, writeAudit, type Actor } from './audit';
import { BookingEvents } from './booking-events';
import { BookingsService, WALK_IN_PREFIX } from './bookings.service';
import { apiError } from './errors';
import { paidTotal, refundedTotal } from './refund';

// Байка нет на месте: клиент или сотрудник открывает случай; точка выдаёт другой байк той же модели, предлагает другую модель
// или отменяет с полным возвратом. Ошибка точки: клиент не доплачивает за замену, а дешевле — получает разницу.
// Нет ответа за INCIDENT_CLIENT_CANCEL_MINUTES → сообщение администратору, клиент может отменить сам.

export const JOB_INCIDENT_ESCALATE = 'incident.escalate';
const HOLDING = [...HOLDING_BOOKING_STATUSES];
const H = 3_600_000;
const MIN = 60_000;
const NEXT_BOOKING_WINDOW_H = 24;

const notAvailable = () => apiError(HttpStatus.CONFLICT, 'INCIDENT_NOT_AVAILABLE', 'Only a confirmed booking before handover');
const notOpen = () => apiError(HttpStatus.CONFLICT, 'INCIDENT_NOT_OPEN', 'No open incident for this booking');
const replacementGone = () => apiError(HttpStatus.CONFLICT, 'REPLACEMENT_UNAVAILABLE', 'This bike is no longer free');
const isOverlap = (e: unknown): boolean => /23P01|bookings_bike_no_overlap/.test(`${(e as { message?: string })?.message ?? ''} ${JSON.stringify((e as { meta?: unknown })?.meta ?? '')}`);

@Injectable()
export class IncidentsService {
  private readonly log = new Logger('Incidents');

  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly pricing: PricingService,
    private readonly bookings: BookingsService,
    private readonly events: BookingEvents,
    private readonly jobs: JobsService,
  ) {}

  openFor(bookingId: string): Promise<BookingIncident | null> {
    return this.prisma.bookingIncident.findFirst({ where: { bookingId, status: 'OPEN' } });
  }

  private async requireOpen(bookingId: string): Promise<BookingIncident> {
    const row = await this.openFor(bookingId);
    if (!row) throw notOpen();
    return row;
  }

  /** Случай на бронь один: повторный сигнал клиента лишь отмечает, что клиент уже на месте. */
  private async open(b: { id: string; locationId: string }, source: 'CLIENT' | 'STAFF' | 'SYSTEM', actor: Actor, comment: string | null): Promise<BookingIncident> {
    const now = this.clock.now();
    const client = source === 'CLIENT' ? { clientReportedAt: now } : {};
    const existing = await this.openFor(b.id);
    if (existing) {
      if (source !== 'CLIENT' || existing.clientReportedAt) return existing;
      const updated = await this.prisma.bookingIncident.update({ where: { id: existing.id }, data: { ...client, comment: comment ?? existing.comment } });
      await this.jobs.schedule(JOB_INCIDENT_ESCALATE, `incident-${existing.id}`, new Date(now.getTime() + INCIDENT_CLIENT_CANCEL_MINUTES * MIN), { incidentId: existing.id });
      this.events.emit({ bookingId: b.id, name: 'incident_opened', params: { source, comment } });
      return updated;
    }
    // Точка уже ответила «байк на месте»: повторная жалоба не запускает таймер возврата, спор решает администратор
    const disputed = source === 'CLIENT' && (await this.prisma.bookingIncident.count({ where: { bookingId: b.id, resolution: 'BIKE_PRESENT' } })) > 0;
    let row: BookingIncident;
    try {
      row = await this.prisma.bookingIncident.create({ data: { bookingId: b.id, locationId: b.locationId, source, comment, disputed, ...client } });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') return this.requireOpen(b.id);
      throw e;
    }
    await writeAudit(this.prisma, actor, 'incident.open', 'Booking', b.id, { source, comment });
    await this.jobs.schedule(JOB_INCIDENT_ESCALATE, `incident-${row.id}`, new Date(now.getTime() + INCIDENT_CLIENT_CANCEL_MINUTES * MIN), { incidentId: row.id });
    this.events.emit({ bookingId: b.id, name: 'incident_opened', params: { source, comment } });
    return row;
  }

  /** Клиент: «Байка нет на месте». Раньше, чем за пару часов до выдачи, это не случай, а вопрос к точке. */
  async reportByClient(userId: string, id: string, comment: string | null): Promise<void> {
    const b = await this.bookings.getOwn(userId, id);
    if (b.status !== 'CONFIRMED') throw notAvailable();
    if (this.clock.now().getTime() < b.startAt.getTime() - INCIDENT_REPORT_BEFORE_START_HOURS * H) throw apiError(HttpStatus.CONFLICT, 'BIKE_MISSING_TOO_EARLY', 'Too early to report');
    const act = await this.prisma.handoverAct.count({ where: { bookingId: id, kind: 'ISSUE' } });
    if (act > 0) throw notAvailable();
    const point = await this.prisma.location.findUniqueOrThrow({ where: { id: b.locationId }, select: { openTime: true, closeTime: true, timezone: true } });
    // Точка закрыта: отвечать некому, и таймер полного возврата сработал бы сам. Брони начинаются в часы работы
    const local = new Intl.DateTimeFormat('en-GB', { timeZone: point.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(this.clock.now());
    if (local < point.openTime || local >= point.closeTime) throw apiError(HttpStatus.CONFLICT, 'BIKE_MISSING_CLOSED', 'The location is closed now');
    await this.open(b, 'CLIENT', { id: userId, role: 'CLIENT' }, comment);
  }

  async reportByStaff(actor: Actor, id: string, comment: string | null): Promise<void> {
    const b = await this.prisma.booking.findUnique({ where: { id }, select: { id: true, locationId: true, status: true } });
    if (!b) throw notFound('Booking not found');
    if (b.status !== 'CONFIRMED') throw notAvailable();
    await this.open(b, 'STAFF', actor, comment);
  }

  /** Свободные на период брони байки других моделей этой точки, которые клиенту разрешено водить. */
  async replacements(bookingId: string): Promise<IncidentReplacement[]> {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { user: { select: { licenseCategory: true } } } });
    if (!b) return [];
    const blockedUntil = b.blockedUntil ?? b.endAt;
    const models = await this.prisma.bikeModel.findMany({
      where: { locationId: b.locationId, isActive: true, id: { not: b.modelId }, ...(b.user.licenseCategory === 'NONE' ? { OR: [{ licenseRequired: 'NONE' as const }, { engineCc: { lte: NO_LICENSE_MAX_CC } }] } : {}) },
      include: {
        tariffs: true,
        bikes: {
          where: { status: 'ACTIVE', bookings: { none: this.busyWhere(b.id, b.startAt, blockedUntil) } },
          select: { id: true, plate: true },
          orderBy: { plate: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
    const quotes = await this.pricing.rentQuotes(models, b.startAt, b.endAt);
    return models.flatMap((m) => {
      const q = quotes.get(m.id);
      return q ? m.bikes.map((x) => ({ bikeId: x.id, plate: x.plate, modelName: m.name, rentAmount: q.total, refund: Math.max(0, b.rentAmount - q.total) })) : [];
    });
  }

  /** Байк занят этим периодом или ещё не вернулся: просроченная аренда держит его сейчас, хотя её срок уже прошёл. */
  private busyWhere(exceptId: string, startAt: Date, blockedUntil: Date): Prisma.BookingWhereInput {
    return { id: { not: exceptId }, OR: [{ status: { in: HOLDING }, startAt: { lt: blockedUntil }, blockedUntil: { gt: startAt } }, { status: 'ISSUED', endAt: { lt: this.clock.now() } }] };
  }

  /** Предложить другую модель. Клиент «с улицы» в приложение не входит: его согласие подтверждает сотрудник на месте. */
  async propose(actor: Actor, id: string, bikeId: string): Promise<void> {
    const incident = await this.requireOpen(id);
    const option = (await this.replacements(id)).find((r) => r.bikeId === bikeId);
    if (!option) throw replacementGone();
    const now = this.clock.now();
    await this.prisma.bookingIncident.update({ where: { id: incident.id }, data: { proposedBikeId: bikeId, proposedRent: option.rentAmount, proposedAt: now } });
    await writeAudit(this.prisma, actor, 'incident.propose', 'Booking', id, { bikeId, plate: option.plate, rent: option.rentAmount });
    const owner = await this.prisma.booking.findUniqueOrThrow({ where: { id }, select: { user: { select: { telegramId: true } } } });
    if (owner.user.telegramId.startsWith(WALK_IN_PREFIX)) {
      await this.applyReplacement(id, actor);
      return;
    }
    this.events.emit({ bookingId: id, name: 'incident_proposed', params: { model: option.modelName, plate: option.plate, refund: option.refund } });
  }

  /** Клиент согласился: бронь переходит на другую модель. Дороже — без доплаты; дешевле — разница к возврату. */
  async acceptByClient(userId: string, id: string): Promise<void> {
    await this.bookings.getOwn(userId, id);
    await this.applyReplacement(id, { id: userId, role: 'CLIENT' });
  }

  private async applyReplacement(id: string, actor: Actor): Promise<void> {
    let refund = 0;
    let model = '';
    try {
      await this.prisma.$transaction(async (tx) => {
        const locked = await this.bookings.lockBooking(tx, id);
        if (!locked || locked.status !== 'CONFIRMED') throw notAvailable();
        const incident = await tx.bookingIncident.findFirst({ where: { bookingId: id, status: 'OPEN' } });
        if (!incident) throw notOpen();
        if (!incident.proposedBikeId || incident.proposedRent === null) throw replacementGone();
        const b = await tx.booking.findUniqueOrThrow({ where: { id }, include: { payments: true } });
        const bike = await tx.bike.findUnique({ where: { id: incident.proposedBikeId }, include: { model: { select: { name: true } } } });
        if (!bike || bike.status !== 'ACTIVE' || bike.locationId !== b.locationId) throw replacementGone();
        const rentAmount = Math.min(b.rentAmount, incident.proposedRent);
        const totalAmount = b.totalAmount - (b.rentAmount - rentAmount);
        refund = Math.max(0, paidTotal(b.payments) - refundedTotal(b.payments) - totalAmount - b.depositAmount);
        await tx.booking.update({ where: { id }, data: { bikeId: bike.id, modelId: bike.modelId, rentAmount, totalAmount, ...(refund > 0 ? { refundAmount: (b.refundAmount ?? 0) + refund } : {}) } });
        if (refund > 0) await tx.payment.create({ data: { bookingId: id, kind: 'REFUND', method: b.paymentMethod, amount: refund, status: 'PENDING', comment: 'replacement is cheaper', createdById: actor.id } });
        await tx.bookingIncident.update({ where: { id: incident.id }, data: { status: 'RESOLVED', resolution: 'REPLACED', resolvedAt: this.clock.now() } });
        await writeAudit(tx, actor, 'incident.replaced', 'Booking', id, { fromBike: b.bikeId, toBike: bike.id, rentAmount, refund });
        model = bike.model.name;
      });
    } catch (e) {
      if (isOverlap(e)) throw replacementGone();
      throw e;
    }
    this.events.emit({ bookingId: id, name: 'incident_resolved', params: { resolution: 'REPLACED', model, refund } });
    if (refund > 0) this.events.emit({ bookingId: id, name: 'refund_recorded', params: { amount: refund, percent: 100 } });
  }

  /** Сотрудник проверил: байк на месте. Случай закрыт, клиент может сообщить снова, если это не так. */
  async dismiss(actor: Actor, id: string): Promise<void> {
    const incident = await this.requireOpen(id);
    await this.prisma.bookingIncident.update({ where: { id: incident.id }, data: { status: 'RESOLVED', resolution: 'BIKE_PRESENT', resolvedAt: this.clock.now() } });
    await this.jobs.cancel(`incident-${incident.id}`);
    await writeAudit(this.prisma, actor, 'incident.dismiss', 'Booking', id);
    this.events.emit({ bookingId: id, name: 'incident_resolved', params: { resolution: 'BIKE_PRESENT' } });
  }

  /** Отмена с полным возвратом сотрудником. */
  async cancelByStaff(actor: Actor, id: string): Promise<void> {
    await this.cancelFull(actor, id, await this.requireOpen(id));
  }

  /** Отмена клиентом: сразу, если замена его не устроила; иначе после ожидания ответа точки. */
  async cancelByClient(userId: string, id: string): Promise<void> {
    await this.bookings.getOwn(userId, id);
    const incident = await this.requireOpen(id);
    const at = incident.proposedAt ?? (!incident.disputed && incident.clientReportedAt ? new Date(incident.clientReportedAt.getTime() + INCIDENT_CLIENT_CANCEL_MINUTES * MIN) : null);
    if (!at || this.clock.now().getTime() < at.getTime()) throw apiError(HttpStatus.CONFLICT, 'INCIDENT_WAIT', 'The location still has time to respond');
    await this.cancelFull({ id: userId, role: 'CLIENT' }, id, incident);
  }

  private async cancelFull(actor: Actor, id: string, incident: BookingIncident): Promise<void> {
    const { refundAmount } = await this.bookings.cancel(id, actor, 'BIKE_MISSING');
    await this.jobs.cancel(`incident-${incident.id}`);
    await writeAudit(this.prisma, actor, 'incident.cancelled', 'Booking', id, { refundAmount });
    this.events.emit({ bookingId: id, name: 'incident_resolved', params: { resolution: 'CANCELLED', refund: refundAmount } });
  }

  /**
   * Предыдущий клиент не вернул байк, а на нём есть следующая бронь: пока клиент не приехал, пробуем переставить её
   * на свободный байк той же модели. Свободного нет — сотрудники узнают заранее, а не от клиента на месте.
   */
  async handleOverdue(overdueBookingId: string): Promise<void> {
    const late = await this.prisma.booking.findUnique({ where: { id: overdueBookingId }, select: { bikeId: true, status: true } });
    if (!late || late.status !== 'ISSUED') return;
    const now = this.clock.now();
    const next = await this.prisma.booking.findMany({
      where: { bikeId: late.bikeId, status: 'CONFIRMED', startAt: { lt: new Date(now.getTime() + NEXT_BOOKING_WINDOW_H * H) } },
      orderBy: { startAt: 'asc' },
    });
    for (const b of next) {
      const blockedUntil = b.blockedUntil ?? b.endAt;
      const free = await this.prisma.bike.findFirst({
        where: { id: { not: late.bikeId }, modelId: b.modelId, locationId: b.locationId, status: 'ACTIVE', bookings: { none: this.busyWhere(b.id, b.startAt, blockedUntil) } },
        orderBy: { plate: 'asc' },
      });
      if (free) {
        try {
          await this.prisma.booking.update({ where: { id: b.id }, data: { bikeId: free.id } });
          await writeAudit(this.prisma, SYSTEM, 'booking.bike', 'Booking', b.id, { from: late.bikeId, to: free.id, reason: 'previous rental overdue' });
          this.events.emit({ bookingId: b.id, name: 'bike_reassigned', params: { plate: free.plate } });
          continue;
        } catch (e) {
          if (!isOverlap(e)) throw e;
          this.log.warn(`Байк ${free.plate} занят за время подбора замены для ${b.code}`);
        }
      }
      await this.open(b, 'SYSTEM', SYSTEM, null);
    }
  }
}
