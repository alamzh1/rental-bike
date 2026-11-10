import { randomBytes } from 'node:crypto';
import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type Bike, type Booking, type HandoverAct, type Payment, type User } from '@prisma/client';
import {
  DEDUCTION_PHOTOS_MAX,
  HANDOVER_PHOTOS_MAX,
  HANDOVER_PHOTOS_MIN,
  HOLDING_BOOKING_STATUSES,
  fromLocationDateTime,
  lateFee,
  toLocationDate,
  type ActPhotoUploadResponse,
  type BikePatchRequest,
  type CashResponse,
  type DocumentDto,
  type HandoverResponse,
  type ManagerAct,
  type ManagerBike,
  type ManagerBookingCard,
  type ManagerBookingDetail,
  type ManagerTodayResponse,
  type NoShowResponse,
  type ReturnResponse,
} from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../jobs/clock';
import { badRequest, notFound } from '../auth/api-errors';
import { inScope, loadStaffScope, scopeLocationId, scopeWhere, type StaffScope } from '../auth/staff-scope';
import { BookingsService, BookingEvents, refundedTotal, WALK_IN_PREFIX, writeAudit, type Actor } from '../bookings';
import { apiError, assertBikeCanStop } from '../bookings/errors';
import { IncidentsService } from '../bookings/incidents.service';
import { DocumentsService, STORAGE, toDocumentDto, type Storage } from '../documents';
import {
  actExists,
  bikeNotAvailable,
  deductionTooLarge,
  int,
  isOverlap,
  mileageLower,
  obj,
  photoKeys,
  text,
  photoNotUploaded,
  wrongLocation,
} from './manager.helpers';

// Режим менеджера: выдачи и возвраты на сегодня, поиск по QR (код брони), фотоакт, возврат с доплатой и удержаниями,
// наличные, «Не пришёл», ремонт байка. Менеджер видит только свою точку; администратор — все.

const DAY_MS = 86_400_000;
const CODE_RE = /BK-\d{5,}/i;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const CASH_KINDS = ['RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE'] as const;
const HOLDING = [...HOLDING_BOOKING_STATUSES] as Booking['status'][];
const DEFAULT_TZ = 'Asia/Ho_Chi_Minh';
const MAX_CASH = 1_000_000_000;

type Full = Booking & {
  user: Pick<User, 'id' | 'firstName' | 'lastName' | 'phone' | 'telegramId'>;
  bike: Bike & { model: { name: string } };
  model: { name: string };
  location: { timezone: string };
  payments: Payment[];
  handoverActs: (HandoverAct & { bike: { plate: string } })[];
  incidents: { id: string; source: 'CLIENT' | 'STAFF' | 'SYSTEM'; comment: string | null; createdAt: Date; proposedBike: { plate: string; model: { name: string } } | null }[];
};

const FULL = {
  user: { select: { id: true, firstName: true, lastName: true, phone: true, telegramId: true } },
  bike: { include: { model: { select: { name: true } } } },
  model: { select: { name: true } },
  location: { select: { timezone: true } },
  payments: { orderBy: { createdAt: 'asc' } },
  handoverActs: { include: { bike: { select: { plate: true } } } },
  incidents: { where: { status: 'OPEN' }, take: 1, select: { id: true, source: true, comment: true, createdAt: true, proposedBike: { select: { plate: true, model: { select: { name: true } } } } } },
} satisfies Prisma.BookingInclude;

const clientName = (u: Pick<User, 'firstName' | 'lastName'>): string | null => [u.firstName, u.lastName].filter(Boolean).join(' ') || null;

/** Внесено за аренду и депозит (без доплат и возвратов). */
const paidBase = (ps: Payment[]): number =>
  ps.filter((p) => p.status === 'PAID' && (p.kind === 'RENT' || p.kind === 'DEPOSIT' || p.kind === 'PREPAYMENT')).reduce((s, p) => s + (p.receivedAmount ?? p.amount), 0);
const paidSurcharge = (ps: Payment[]): number => ps.filter((p) => p.status === 'PAID' && p.kind === 'SURCHARGE').reduce((s, p) => s + (p.receivedAmount ?? p.amount), 0);

@Injectable()
export class ManagerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly bookings: BookingsService,
    private readonly events: BookingEvents,
    private readonly documents: DocumentsService,
    private readonly incidents: IncidentsService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  // ---------- Доступ к точке ----------

  /** Администратор — все точки, менеджер — своя, менеджер без точки — ни одной (общее правило auth/staff-scope). */
  private scope(actor: Actor): Promise<StaffScope> {
    return loadStaffScope(this.prisma, actor);
  }

  /** Бронь по ID или коду (в том числе из текста QR); чужая точка → 403 WRONG_LOCATION. */
  private async findFull(actor: Actor, ref: string): Promise<Full> {
    const code = CODE_RE.exec(ref)?.[0].toUpperCase();
    const b = await this.prisma.booking.findFirst({ where: { OR: [{ id: ref }, ...(code ? [{ code }] : [])] }, include: FULL });
    if (!b) throw notFound('Booking not found');
    if (!inScope(await this.scope(actor), b.locationId)) throw wrongLocation();
    return b;
  }

  private fee(b: Full, at: Date): { amount: number; minutesLate: number } {
    return { amount: 0, minutesLate: Math.max(0, Math.ceil((at.getTime() - b.endAt.getTime()) / 60_000)) };
  }

  private async lateRules(b: Pick<Booking, 'quote' | 'rentAmount' | 'startAt' | 'endAt'>) {
    const row = await this.prisma.setting.findUnique({ where: { key: 'late' } });
    const raw = (row?.value ?? {}) as Record<string, unknown>;
    const n = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : d);
    const snap = (b.quote ?? {}) as { pricePerDay?: number };
    const dayPrice = typeof snap.pricePerDay === 'number' && snap.pricePerDay > 0 ? snap.pricePerDay : b.rentAmount;
    return { graceMinutes: n(raw.graceMinutes, 60), hourlyFee: n(raw.hourlyFee, 0), extraDayAfterHours: n(raw.extraDayAfterHours, 4), dayPrice };
  }

  private async lateFeeAt(b: Full, at: Date): Promise<{ amount: number; minutesLate: number }> {
    const rules = await this.lateRules(b);
    return { amount: lateFee(b.endAt, at, rules), minutesLate: this.fee(b, at).minutesLate };
  }

  private card(b: Full, now: Date): ManagerBookingCard {
    const cashDue = Math.max(0, b.totalAmount + b.depositAmount + b.lateFeeAmount - paidBase(b.payments) - paidSurcharge(b.payments));
    return {
      id: b.id,
      code: b.code,
      status: b.status,
      modelName: b.model.name,
      plate: b.bike.plate,
      clientName: clientName(b.user),
      phone: b.phone ?? b.user.phone,
      startAt: b.startAt.toISOString(),
      endAt: b.endAt.toISOString(),
      overdue: b.status === 'CONFIRMED' ? b.startAt < now : b.status === 'ISSUED' ? b.endAt < now : false,
      cashDue,
      incidentOpen: b.incidents.length > 0,
    };
  }

  private bikeDto(b: Bike & { model: { name: string } }): ManagerBike {
    return { id: b.id, plate: b.plate, modelName: b.model.name, mileageKm: b.mileageKm, status: b.status, readyAt: b.readyAt ? b.readyAt.toISOString() : null };
  }

  private actDto(a: HandoverAct & { bike: { plate: string } }): ManagerAct {
    return {
      id: a.id,
      kind: a.kind,
      plate: a.bike.plate,
      mileageKm: a.mileageKm,
      fuelLevel: a.fuelLevel,
      photoCount: a.photos.length,
      damages: a.damages,
      clientConfirmedAt: a.clientConfirmedAt ? a.clientConfirmedAt.toISOString() : null,
      createdAt: a.createdAt.toISOString(),
    };
  }

  // ---------- Чтение ----------

  /** GET /manager/today — выдачи (CONFIRMED) и возвраты (ISSUED) до конца сегодняшнего дня точки, просроченные — тоже. */
  async today(actor: Actor): Promise<ManagerTodayResponse> {
    const now = this.clock.now();
    const scope = await this.scope(actor);
    const loc = scopeLocationId(scope);
    const location = loc ? await this.prisma.location.findUnique({ where: { id: loc }, select: { timezone: true } }) : await this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' }, select: { timezone: true } });
    const timezone = location?.timezone ?? DEFAULT_TZ;
    const date = toLocationDate(now, timezone);
    const dayEnd = new Date(fromLocationDateTime(date, '00:00', timezone).getTime() + DAY_MS);
    const where = scopeWhere(scope);
    const [issues, returns] = await Promise.all([
      this.prisma.booking.findMany({ where: { ...where, status: 'CONFIRMED', startAt: { lt: dayEnd } }, include: FULL, orderBy: { startAt: 'asc' } }),
      this.prisma.booking.findMany({ where: { ...where, status: 'ISSUED', endAt: { lt: dayEnd } }, include: FULL, orderBy: { endAt: 'asc' } }),
    ]);
    return { date, timezone, issues: issues.map((b) => this.card(b, now)), returns: returns.map((b) => this.card(b, now)) };
  }

  async bikes(actor: Actor): Promise<ManagerBike[]> {
    const rows = await this.prisma.bike.findMany({ where: { ...scopeWhere(await this.scope(actor)), status: { not: 'RETIRED' } }, include: { model: { select: { name: true } } }, orderBy: { plate: 'asc' } });
    return rows.map((b) => this.bikeDto(b));
  }

  /** GET /manager/bookings/{code|id}. */
  async detail(actor: Actor, ref: string): Promise<ManagerBookingDetail> {
    const b = await this.findFull(actor, ref);
    const now = this.clock.now();
    const blockedUntil = b.blockedUntil ?? b.endAt;
    const [docs, candidates, deductions] = await Promise.all([
      this.prisma.document.findMany({ where: { userId: b.userId, deletedAt: null }, orderBy: { createdAt: 'desc' } }),
      this.prisma.bike.findMany({
        where: { modelId: b.modelId, locationId: b.locationId, OR: [{ status: 'ACTIVE' }, { id: b.bikeId }] },
        include: { model: { select: { name: true } }, bookings: { where: { id: { not: b.id }, status: { in: HOLDING }, startAt: { lt: blockedUntil }, blockedUntil: { gt: b.startAt } }, select: { id: true } } },
        orderBy: { plate: 'asc' },
      }),
      this.prisma.depositDeduction.findMany({ where: { bookingId: b.id }, orderBy: { createdAt: 'asc' } }),
    ]);
    const issueAct = b.handoverActs.find((a) => a.kind === 'ISSUE');
    const returnAct = b.handoverActs.find((a) => a.kind === 'RETURN');
    const incident = b.incidents[0];
    const replacements = incident ? await this.incidents.replacements(b.id) : [];
    const fee = b.status === 'COMPLETED' ? { amount: b.lateFeeAmount, minutesLate: b.actualEndAt ? this.fee(b, b.actualEndAt).minutesLate : 0 } : await this.lateFeeAt(b, now);
    return {
      card: this.card(b, now),
      paymentMethod: b.paymentMethod,
      rentAmount: b.rentAmount,
      totalAmount: b.totalAmount,
      depositAmount: b.depositAmount,
      paidAmount: paidBase(b.payments) + paidSurcharge(b.payments),
      lateFee: fee,
      client: { id: b.user.id, name: clientName(b.user), phone: b.phone ?? b.user.phone },
      documents: docs.map((d): DocumentDto => toDocumentDto(d)),
      bike: this.bikeDto(b.bike),
      freeBikes: candidates.filter((c) => c.bookings.length === 0).map((c) => this.bikeDto(c)),
      incident: incident
        ? { id: incident.id, source: incident.source, comment: incident.comment, createdAt: incident.createdAt.toISOString(), proposal: incident.proposedBike ? { plate: incident.proposedBike.plate, modelName: incident.proposedBike.model.name } : null }
        : null,
      replacements,
      issueAct: issueAct ? this.actDto(issueAct) : null,
      returnAct: returnAct ? this.actDto(returnAct) : null,
      deductions: deductions.map((d) => ({ id: d.id, amount: d.amount, reason: d.reason, photoCount: d.photos.length })),
    };
  }

  // ---------- Фото и документы ----------

  async photoUpload(actor: Actor, id: string, body: unknown): Promise<ActPhotoUploadResponse> {
    const b = await this.findFull(actor, id);
    const contentType = obj(body).contentType;
    if (typeof contentType !== 'string' || !IMAGE_TYPES.includes(contentType)) throw badRequest(`contentType must be one of ${IMAGE_TYPES.join(', ')}`);
    const key = `acts/${b.id}/${this.clock.now().getTime()}-${randomBytes(6).toString('hex')}`;
    const up = await this.storage.presignPut(key, contentType);
    return { key, uploadUrl: up.url, method: 'PUT', headers: up.headers, expiresAt: up.expiresAt.toISOString() };
  }

  /** Акт — доказательство состояния байка: ключи без настоящих файлов не принимаются. */
  private async assertUploaded(keys: string[]): Promise<void> {
    const found = await Promise.all(keys.map((k) => this.storage.exists(k)));
    if (found.includes(false)) throw photoNotUploaded();
  }

  // ---------- Байка нет на месте ----------

  /** `{ comment? }` */
  async reportMissing(actor: Actor, id: string, body: unknown): Promise<void> {
    const b = await this.findFull(actor, id);
    await this.incidents.reportByStaff(actor, b.id, text(obj(body).comment, 'comment', 1000));
  }

  /** `{ bikeId }` — предложить клиенту другую модель. */
  async proposeReplacement(actor: Actor, id: string, body: unknown): Promise<void> {
    const b = await this.findFull(actor, id);
    const bikeId = obj(body).bikeId;
    if (typeof bikeId !== 'string' || !bikeId) throw badRequest('bikeId is required');
    await this.incidents.propose(actor, b.id, bikeId);
  }

  async dismissMissing(actor: Actor, id: string): Promise<void> {
    const b = await this.findFull(actor, id);
    await this.incidents.dismiss(actor, b.id);
  }

  async cancelMissing(actor: Actor, id: string): Promise<void> {
    const b = await this.findFull(actor, id);
    await this.incidents.cancelByStaff(actor, b.id);
  }

  // ---------- Выдача ----------

  /** POST /manager/bookings/{id}/handover: акт выдачи; бронь станет «Выдана», когда клиент подтвердит акт. */
  async handover(actor: Actor, id: string, body: unknown): Promise<HandoverResponse> {
    const b = await this.findFull(actor, id);
    const x = obj(body);
    if (typeof x.bikeId !== 'string' || !x.bikeId) throw badRequest('bikeId is required');
    const mileageKm = int(x.mileageKm, 'mileageKm', 0, 2_000_000);
    const fuelLevel = int(x.fuelLevel, 'fuelLevel', 0, 100);
    const photos = photoKeys(x.photos, b.id, HANDOVER_PHOTOS_MIN, HANDOVER_PHOTOS_MAX);
    const damages = text(x.damages, 'damages', 1000);
    const bikeId = x.bikeId;
    await this.assertUploaded(photos);
    const afterCommit: (() => Promise<void>)[] = [];
    try {
      const act = await this.prisma.$transaction(async (tx) => {
        const locked = await this.bookings.lockBooking(tx, b.id);
        if (!locked) throw notFound('Booking not found');
        if (locked.status !== 'CONFIRMED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Booking is ${locked.status}`);
        const existing = await tx.handoverAct.findUnique({ where: { bookingId_kind: { bookingId: b.id, kind: 'ISSUE' } } });
        if (existing?.clientConfirmedAt) throw actExists();
        const bike = await tx.bike.findUnique({ where: { id: bikeId } });
        const ready = bike?.status === 'ACTIVE' || (bike?.status === 'REPAIR' && !!bike.readyAt && bike.readyAt <= b.startAt);
        if (!bike || bike.modelId !== b.modelId || bike.locationId !== b.locationId || !ready) throw bikeNotAvailable();
        // Ремонт закончился к выдаче: байк снова в строю
        if (bike.status === 'REPAIR') await tx.bike.update({ where: { id: bike.id }, data: { status: 'ACTIVE', readyAt: null } });
        if (bike.id !== b.bikeId) {
          await tx.booking.update({ where: { id: b.id }, data: { bikeId: bike.id } });
          await writeAudit(tx, actor, 'booking.bike', 'Booking', b.id, { from: b.bikeId, to: bike.id });
        }
        if (existing) await tx.handoverAct.delete({ where: { id: existing.id } });
        const created = await tx.handoverAct.create({ data: { bookingId: b.id, bikeId: bike.id, kind: 'ISSUE', mileageKm, fuelLevel, photos, damages, managerId: actor.id! } });
        // Акт создан: байк нашёлся. Другой номер — значит, случай решён заменой той же модели
        await tx.bookingIncident.updateMany({ where: { bookingId: b.id, status: 'OPEN' }, data: { status: 'RESOLVED', resolution: bike.id !== b.bikeId ? 'SAME_MODEL' : 'BIKE_PRESENT', resolvedAt: this.clock.now() } });
        await writeAudit(tx, actor, 'handover.issue', 'HandoverAct', created.id, { bookingId: b.id, bikeId: bike.id, mileageKm, fuelLevel, photos: photos.length });
        // Клиент «с улицы» не входит в приложение: акт подтверждён при выдаче менеджером
        if (b.user.telegramId.startsWith(WALK_IN_PREFIX)) {
          const now = this.clock.now();
          await tx.handoverAct.update({ where: { id: created.id }, data: { clientConfirmedAt: now } });
          afterCommit.push(await this.bookings.transitionInTx(tx, b.id, 'ISSUED', actor, { reason: 'handover walk-in', data: { actualStartAt: now } }, locked));
        }
        return created;
      });
      for (const run of afterCommit) await run();
      return { actId: act.id };
    } catch (e) {
      if (isOverlap(e)) throw bikeNotAvailable();
      throw e;
    }
  }

  // ---------- Возврат ----------

  /** POST /manager/bookings/{id}/return: акт приёма, доплата за опоздание, удержания из депозита, бронь → «Завершена». */
  async returnBike(actor: Actor, id: string, body: unknown): Promise<ReturnResponse> {
    const b = await this.findFull(actor, id);
    const x = obj(body);
    const mileageKm = int(x.mileageKm, 'mileageKm', 0, 2_000_000);
    const fuelLevel = int(x.fuelLevel, 'fuelLevel', 0, 100);
    const photos = photoKeys(x.photos, b.id, HANDOVER_PHOTOS_MIN, HANDOVER_PHOTOS_MAX);
    const damages = text(x.damages, 'damages', 1000);
    const rawDeductions = x.deductions === undefined ? [] : x.deductions;
    if (!Array.isArray(rawDeductions) || rawDeductions.length > 10) throw badRequest('deductions must be an array');
    const deductions = rawDeductions.map((d) => {
      const o = obj(d);
      return { amount: int(o.amount, 'deduction.amount', 1, MAX_CASH), reason: text(o.reason, 'deduction.reason', 500, true)!, photos: photoKeys(o.photos, b.id, 0, DEDUCTION_PHOTOS_MAX) };
    });
    const deductionsTotal = deductions.reduce((s, d) => s + d.amount, 0);
    await this.assertUploaded([...photos, ...deductions.flatMap((d) => d.photos)]);
    const issueAct = b.handoverActs.find((a) => a.kind === 'ISSUE');
    if (issueAct && mileageKm < issueAct.mileageKm) throw mileageLower();

    const now = this.clock.now();
    const fee = await this.lateFeeAt(b, now);
    let depositRefund = 0;
    let actId = '';
    const after = await this.prisma.$transaction(async (tx) => {
      const locked = await this.bookings.lockBooking(tx, b.id);
      if (!locked) throw notFound('Booking not found');
      if (locked.status !== 'ISSUED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Booking is ${locked.status}`);
      if (await tx.handoverAct.findUnique({ where: { bookingId_kind: { bookingId: b.id, kind: 'RETURN' } } })) throw actExists();
      const payments = await tx.payment.findMany({ where: { bookingId: b.id } });
      const depositHeld = Math.min(b.depositAmount, Math.max(0, paidBase(payments) - refundedTotal(payments) - b.totalAmount));
      if (deductionsTotal > depositHeld) throw deductionTooLarge();
      depositRefund = depositHeld - deductionsTotal;

      const done = await this.bookings.transitionInTx(tx, b.id, 'COMPLETED', actor, { reason: 'returned', data: { actualEndAt: now, lateFeeAmount: fee.amount, refundAmount: depositRefund } }, locked);
      const act = await tx.handoverAct.create({ data: { bookingId: b.id, bikeId: b.bikeId, kind: 'RETURN', mileageKm, fuelLevel, photos, damages, managerId: actor.id! } });
      actId = act.id;
      for (const d of deductions) await tx.depositDeduction.create({ data: { bookingId: b.id, actId: act.id, amount: d.amount, reason: d.reason, photos: d.photos, createdById: actor.id! } });
      await tx.bike.update({ where: { id: b.bikeId }, data: { mileageKm } });
      if (fee.amount > 0) await tx.payment.create({ data: { bookingId: b.id, kind: 'SURCHARGE', method: 'CASH', amount: fee.amount, status: 'PENDING', comment: `late ${fee.minutesLate} min`, createdById: actor.id } });
      if (depositRefund > 0) await tx.payment.create({ data: { bookingId: b.id, kind: 'REFUND', method: b.paymentMethod === 'RUB_TRANSFER' ? 'CASH' : b.paymentMethod, amount: depositRefund, status: 'PENDING', comment: 'deposit refund', createdById: actor.id } });
      await writeAudit(tx, actor, 'handover.return', 'HandoverAct', act.id, { bookingId: b.id, mileageKm, fuelLevel, photos: photos.length, lateFee: fee.amount, deductions: deductionsTotal, depositRefund });
      return done;
    });
    await after();
    if (deductionsTotal > 0) this.events.emit({ bookingId: b.id, name: 'deposit_deducted', params: { amountVnd: deductionsTotal } });
    if (depositRefund > 0) this.events.emit({ bookingId: b.id, name: 'refund_recorded', params: { amount: depositRefund, percent: b.depositAmount ? Math.round((depositRefund * 100) / b.depositAmount) : 100, kind: 'deposit' } });
    return { actId, lateFeeAmount: fee.amount, deductionsTotal, depositRefund };
  }

  // ---------- Наличные, неявка, ремонт ----------

  /** POST /manager/bookings/{id}/cash: платёж метода CASH; ожидающую доплату того же типа закрывает, иначе создаёт новый. */
  async cash(actor: Actor, id: string, body: unknown): Promise<CashResponse> {
    const b = await this.findFull(actor, id);
    const x = obj(body);
    const amount = int(x.amount, 'amount', 1, MAX_CASH);
    const kind = x.kind === undefined ? 'RENT' : (CASH_KINDS as readonly unknown[]).includes(x.kind) ? (x.kind as (typeof CASH_KINDS)[number]) : null;
    if (!kind) throw badRequest(`kind must be one of ${CASH_KINDS.join(', ')}`);
    const comment = text(x.comment, 'comment', 300);
    if (b.status !== 'CONFIRMED' && b.status !== 'ISSUED' && b.status !== 'COMPLETED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Booking is ${b.status}`);
    const now = this.clock.now();
    const payment = await this.prisma.$transaction(async (tx) => {
      // Блокировка и остаток: двойное нажатие не запишет те же наличные дважды
      const locked = await this.bookings.lockBooking(tx, b.id);
      if (!locked) throw notFound('Booking not found');
      // Пока ждали блокировку, бронь могли отменить: наличные по ней не записываются
      if (locked.status !== 'CONFIRMED' && locked.status !== 'ISSUED' && locked.status !== 'COMPLETED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Booking is ${locked.status}`);
      const current = await tx.payment.findMany({ where: { bookingId: b.id } });
      const due = b.totalAmount + b.depositAmount + b.lateFeeAmount - paidBase(current) - paidSurcharge(current);
      if (amount > due) throw apiError(HttpStatus.CONFLICT, 'CASH_EXCEEDS_DUE', `Only ${Math.max(0, due)} is due`);
      const pending = await tx.payment.findFirst({ where: { bookingId: b.id, kind, method: 'CASH', status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
      const paid = pending
        ? await tx.payment.update({ where: { id: pending.id }, data: { status: 'PAID', receivedAmount: amount, paidAt: now, comment: comment ?? pending.comment, createdById: actor.id } })
        : await tx.payment.create({ data: { bookingId: b.id, kind, method: 'CASH', amount, receivedAmount: amount, status: 'PAID', paidAt: now, comment, createdById: actor.id } });
      await writeAudit(tx, actor, 'payment.cash', 'Payment', paid.id, { bookingId: b.id, kind, amount });
      return paid;
    });
    const all = await this.prisma.payment.findMany({ where: { bookingId: b.id } });
    return { paymentId: payment.id, paidAmount: paidBase(all) + paidSurcharge(all) };
  }

  /** POST /manager/bookings/{id}/no-show: «Не пришёл» → отмена системой, причина «неявка». */
  async noShow(actor: Actor, id: string): Promise<NoShowResponse> {
    const b = await this.findFull(actor, id);
    return this.bookings.markNoShow(b.id, actor);
  }

  /** PATCH /manager/bikes/{id}: «Ремонт» с датой готовности исключает байк из доступности. */
  async patchBike(actor: Actor, id: string, body: unknown): Promise<ManagerBike> {
    const x = obj(body) as Partial<BikePatchRequest>;
    if (x.status !== 'ACTIVE' && x.status !== 'REPAIR') throw badRequest('status must be ACTIVE or REPAIR');
    let readyAt: Date | null = null;
    if (x.status === 'REPAIR' && x.readyAt !== undefined && x.readyAt !== null) {
      readyAt = new Date(x.readyAt);
      if (typeof x.readyAt !== 'string' || Number.isNaN(readyAt.getTime())) throw badRequest('readyAt must be an ISO date');
    }
    const scope = await this.scope(actor);
    const bike = await this.prisma.bike.findUnique({ where: { id }, include: { model: { select: { name: true } } } });
    if (!bike) throw notFound('Bike not found');
    if (!inScope(scope, bike.locationId)) throw wrongLocation();
    if (bike.status === 'RETIRED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', 'Bike is retired');
    if (x.status === 'REPAIR') await assertBikeCanStop(this.prisma, id, 'REPAIR');
    const updated = await this.prisma.$transaction(async (tx) => {
      const u = await tx.bike.update({ where: { id }, data: { status: x.status, readyAt }, include: { model: { select: { name: true } } } });
      await writeAudit(tx, actor, 'bike.status', 'Bike', id, { from: bike.status, to: x.status, readyAt: readyAt?.toISOString() ?? null });
      return u;
    });
    return this.bikeDto(updated);
  }
}
