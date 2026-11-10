import { HttpStatus, Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Prisma, type BookingStatus, type CancelReason, type LicenseCategory } from '@prisma/client';
import { bookingCode, canTransition, canTransitionBooking, HOLDING_BOOKING_STATUSES, licenseAllows, missingDocuments, rentalDays, type CancelPreview, type PaymentMethod, type QuoteExtraRequest } from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { PricingService } from '../pricing/pricing.service';
import { JobsService, JOB_HOLD_EXPIRY } from '../jobs/jobs.service';
import { Clock } from '../jobs/clock';
import { notFound } from '../auth/api-errors';
import { STORAGE, type Storage } from '../documents/storage/storage';
import { apiError, bikeTaken, invalidTransition } from './errors';
import { loadBookingRules, type BookingRules } from './rules';
import { loadRubOffer } from '../payments/rub-transfer';
import { isStaff, SYSTEM, writeAudit, type Actor } from './audit';
import { BookingEvents, type BookingEventName } from './booking-events';
import { BOOKING_INCLUDE, onlinePayable, type BookingWithRelations, type QuoteSnapshot } from './booking.mapper';
import { paidTotal, refundedTotal, refundFor } from './refund';

// Брони: создание с резервом байка (транзакция + FOR UPDATE SKIP LOCKED + exclusion constraint), машина статусов,
// удержание неоплаченных, отмена с возвратом, неявка. blocked_until не пишется: его ставит триггер БД.

export interface CreateBookingInput {
  modelId: string;
  startAt: Date;
  endAt: Date;
  extras: QuoteExtraRequest[];
  paymentMethod: PaymentMethod;
  phone: string | null;
  agreed: boolean;
  delivery: boolean;
  deliveryAddress: string | null;
  source: string | null;
  /**
   * Ручная бронь сотрудника «с улицы» (POST /admin/bookings): без проверки minLeadMinutes — выдача прямо сейчас;
   * начало не раньше STAFF_PAST_START_MINUTES назад. Клиентский POST /bookings этот флаг не выставляет.
   */
  staffWalkIn?: boolean;
}

/** Насколько в прошлом может начинаться ручная бронь сотрудника (оформление занимает несколько минут). */
export const STAFF_PAST_START_MINUTES = 15;

export interface TransitionOptions {
  reason?: string;
  cancelReason?: CancelReason;
  /** Дополнительные поля брони, меняемые вместе со статусом */
  data?: Prisma.BookingUpdateInput;
}

/** Действия после коммита транзакции (очереди, события). */
export type AfterCommit = () => Promise<void>;

type Tx = Prisma.TransactionClient;
type LockedBooking = {
  id: string;
  status: BookingStatus;
  start_at: Date;
  hold_expires_at: Date | null;
  total_amount: number;
  deposit_amount: number;
  payment_method: PaymentMethod;
  actual_start_at: Date | null;
};

/** telegramId клиента «с улицы»: в приложение не входит, акт выдачи подтверждает менеджер. */
export const WALK_IN_PREFIX = 'walkin:';

const E164 = /^\+[1-9]\d{6,14}$/;
const MIN = 60_000;
const HOLDING = new Set<BookingStatus>(HOLDING_BOOKING_STATUSES as BookingStatus[]);
const TERMINAL = new Set<BookingStatus>(['COMPLETED', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM']);
export const JOB_SWEEP_HOLDS = 'bookings.sweep-holds';
export const JOB_SWEEP_NO_SHOWS = 'bookings.sweep-no-shows';

function isExclusionViolation(e: unknown): boolean {
  const text = e instanceof Error ? e.message : String(e);
  return /23P01|bookings_bike_no_overlap/.test(text);
}

@Injectable()
export class BookingsService implements OnModuleInit {
  private readonly log = new Logger('Bookings');

  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly jobs: JobsService,
    private readonly clock: Clock,
    private readonly events: BookingEvents,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  onModuleInit(): void {
    this.jobs.register(JOB_HOLD_EXPIRY, async (d) => {
      if (typeof d.bookingId === 'string') await this.expireHold(d.bookingId);
    });
    // Подстраховка на случай потерянной задачи: раз в минуту отменяем просроченные удержания, раз в 10 мин — неявки
    this.jobs.every(JOB_SWEEP_HOLDS, 60_000, async () => void (await this.expireOverdueHolds()));
    this.jobs.every(JOB_SWEEP_NO_SHOWS, 10 * 60_000, async () => void (await this.cancelNoShows()));
  }

  rules(): Promise<BookingRules> {
    return loadBookingRules(this.prisma);
  }

  // ---------- Создание ----------

  /** Бесплатно удержать весь парк нельзя: брони с наличными подтверждаются сразу, а неоплаченные держат байк всё удержание. */
  private async assertBookingRoom(userId: string, rules: BookingRules): Promise<void> {
    const [unpaid, active] = await Promise.all([
      this.prisma.booking.count({ where: { userId, status: 'PENDING_PAYMENT' } }),
      this.prisma.booking.count({ where: { userId, status: { in: ['PENDING_PAYMENT', 'CONFIRMED'] } } }),
    ]);
    if (unpaid >= rules.maxUnpaidBookings || active >= rules.maxActiveBookings) throw apiError(HttpStatus.CONFLICT, 'TOO_MANY_BOOKINGS', 'Too many active bookings');
  }

  /** Запись документа появляется до загрузки файла, поэтому считаются только файлы, которые реально лежат в хранилище. */
  private async assertDocuments(userId: string, licenseCategory: LicenseCategory | null): Promise<void> {
    const rows = await this.prisma.document.findMany({ where: { userId, deletedAt: null, status: { not: 'REJECTED' } }, select: { type: true, status: true, fileKey: true } });
    const stored = await Promise.all(rows.map(async (d) => ((await this.storage.exists(d.fileKey)) ? d : null)));
    if (missingDocuments(stored.filter((d) => d !== null), licenseCategory).length > 0) throw apiError(HttpStatus.CONFLICT, 'DOCUMENTS_REQUIRED', 'Upload photos of your documents before booking');
  }

  /** POST /bookings: проверка правил → расчёт shared.quote → транзакция с резервом свободного байка модели. Конфликт → 409 BIKE_TAKEN. */
  async create(userId: string, lang: 'ru' | 'en' | 'vi', input: CreateBookingInput): Promise<BookingWithRelations> {
    if (!input.agreed) throw apiError(HttpStatus.BAD_REQUEST, 'AGREEMENT_REQUIRED', 'Rental rules must be accepted');
    if (!(input.endAt.getTime() > input.startAt.getTime())) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'endAt must be after startAt');
    const now = this.clock.now();
    const rules = await this.rules();
    if (rentalDays(input.startAt, input.endAt) < rules.minRentDays) {
      throw apiError(HttpStatus.BAD_REQUEST, 'MIN_RENT_DAYS', `Minimum rental is ${rules.minRentDays} day(s)`);
    }
    const leadMinutes = input.staffWalkIn ? -STAFF_PAST_START_MINUTES : rules.minLeadMinutes;
    if (input.startAt.getTime() < now.getTime() + leadMinutes * MIN) {
      throw apiError(HttpStatus.BAD_REQUEST, 'LEAD_TIME', input.staffWalkIn ? 'Pickup cannot be in the past' : `Pickup must be at least ${rules.minLeadMinutes} min from now`);
    }
    if (input.delivery && !input.deliveryAddress) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'deliveryAddress is required for delivery');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { phone: true, licenseCategory: true } });
    if (!user) throw notFound('User not found');
    if (!input.staffWalkIn) await this.assertBookingRoom(userId, rules);
    if (!input.staffWalkIn && rules.requireDocuments) await this.assertDocuments(userId, user.licenseCategory);
    if (input.phone !== null && !E164.test(input.phone)) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'phone must be E.164');
    const phone = input.phone ?? user.phone;
    if (!phone) throw apiError(HttpStatus.BAD_REQUEST, 'PHONE_REQUIRED', 'Phone is required');

    const model = await this.prisma.bikeModel.findFirst({ where: { id: input.modelId, isActive: true, location: { isActive: true } }, select: { id: true, locationId: true, engineCc: true, licenseRequired: true } });
    if (!model) throw notFound('Model not found');
    if (!input.staffWalkIn && !licenseAllows(model, user.licenseCategory)) throw apiError(HttpStatus.CONFLICT, 'LICENSE_REQUIRED', 'Without a licence only bikes up to 50 cc are available');
    if (input.paymentMethod === 'RUB_TRANSFER' && !(await loadRubOffer(this.prisma, now))) throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', 'Ruble transfer is not available');
    const q = await this.pricing.quoteFor(model.id, input.startAt, input.endAt, input.extras, { delivery: input.delivery });
    const extraRows = q.lines.some((l) => l.kind === 'EXTRA')
      ? await this.prisma.extra.findMany({ where: { id: { in: input.extras.map((e) => e.id) } }, select: { id: true, per: true } })
      : [];
    const qtyOf = new Map(input.extras.map((e) => [e.id, e.qty]));

    const cash = input.paymentMethod === 'CASH';
    // Перевод в рублях — только аренда: депозит менеджер принимает наличными при выдаче и так же возвращает
    const prepay = cash ? Math.round((q.total * rules.cashPrepayPercent) / 100) : input.paymentMethod === 'RUB_TRANSFER' ? q.total : q.total + q.deposit;
    // Клиент «с улицы» в приложение не войдёт и удержание не оплатит: менеджер принимает деньги при выдаче
    const status: BookingStatus = input.staffWalkIn || (cash && prepay === 0) ? 'CONFIRMED' : 'PENDING_PAYMENT';
    const holdExpiresAt = status === 'PENDING_PAYMENT' ? new Date(now.getTime() + rules.holdMinutes * MIN) : null;
    const snapshot: QuoteSnapshot = { ...q, onlinePayable: prepay };
    const blockedUntil = new Date(input.endAt.getTime() + rules.bufferMinutes * MIN);
    // Байк просрочен и не возвращён: срок вышел, но сейчас выдать его нельзя
    const notReturnedUntil = new Date(now.getTime() + rules.bufferMinutes * MIN);

    let created: { id: string };
    try {
      created = await this.prisma.$transaction(async (tx) => {
        const free = await tx.$queryRaw<{ id: string }[]>`
          SELECT b.id FROM bikes b
          WHERE b.model_id = ${model.id}
            AND (b.status = 'ACTIVE' OR (b.status = 'REPAIR' AND b.ready_at IS NOT NULL AND b.ready_at <= ${input.startAt}))
            AND NOT EXISTS (
              SELECT 1 FROM bookings k
              WHERE k.bike_id = b.id
                AND k.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM')
                AND k.start_at < ${blockedUntil}
                AND (k.blocked_until > ${input.startAt} OR (k.status = 'ISSUED' AND ${notReturnedUntil} > ${input.startAt}))
            )
          ORDER BY b.id
          LIMIT 1
          FOR UPDATE OF b SKIP LOCKED`;
        // Пусто могло быть только из-за чужой блокировки: другая бронь этого байка на другие даты — ждём её и проверяем снова
        const bikeId = free[0]?.id ?? (await tx.$queryRaw<{ id: string }[]>`
          SELECT b.id FROM bikes b
          WHERE b.model_id = ${model.id}
            AND (b.status = 'ACTIVE' OR (b.status = 'REPAIR' AND b.ready_at IS NOT NULL AND b.ready_at <= ${input.startAt}))
            AND NOT EXISTS (
              SELECT 1 FROM bookings k
              WHERE k.bike_id = b.id
                AND k.status IN ('PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM')
                AND k.start_at < ${blockedUntil}
                AND (k.blocked_until > ${input.startAt} OR (k.status = 'ISSUED' AND ${notReturnedUntil} > ${input.startAt}))
            )
          ORDER BY b.id
          LIMIT 1
          FOR UPDATE OF b`)[0]?.id;
        if (!bikeId) throw bikeTaken();
        const seqRows = await tx.$queryRaw<{ seq: number }[]>`SELECT nextval(pg_get_serial_sequence('bookings', 'seq'))::int AS seq`;
        const seq = seqRows[0]!.seq;
        await tx.user.update({ where: { id: userId }, data: { phone, lastPaymentMethod: input.paymentMethod } });
        return tx.booking.create({
          data: {
            seq,
            code: bookingCode(seq),
            userId,
            modelId: model.id,
            bikeId,
            locationId: model.locationId,
            startAt: input.startAt,
            endAt: input.endAt,
            bufferMinutes: rules.bufferMinutes,
            status,
            holdExpiresAt,
            paymentMethod: input.paymentMethod,
            deliveryMethod: input.delivery ? 'DELIVERY' : 'PICKUP',
            deliveryAddress: input.delivery ? input.deliveryAddress : null,
            phone,
            lang,
            agreedAt: now,
            rentAmount: q.rent,
            extrasAmount: q.extras,
            deliveryAmount: q.delivery,
            depositAmount: q.deposit,
            totalAmount: q.total,
            quote: snapshot as unknown as Prisma.InputJsonValue,
            source: input.source,
            extras: {
              create: q.lines
                .filter((l) => l.kind === 'EXTRA' && l.refId && l.amount > 0)
                .map((l) => ({
                  extraId: l.refId!,
                  qty: qtyOf.get(l.refId!) ?? 1,
                  unitPrice: l.unitPrice,
                  per: extraRows.find((r) => r.id === l.refId)?.per ?? 'ONCE',
                  amount: l.amount,
                })),
            },
            statusChanges: { create: { from: null, to: status, actorId: userId } },
          },
          select: { id: true },
        });
      });
    } catch (e) {
      if (isExclusionViolation(e)) throw bikeTaken();
      throw e;
    }

    if (holdExpiresAt) await this.jobs.scheduleHoldExpiry(created.id, holdExpiresAt);
    else await this.jobs.scheduleReminders(created.id, input.startAt);
    this.events.emit({ bookingId: created.id, name: status === 'CONFIRMED' ? 'confirmed' : 'created' });
    return this.load(created.id);
  }

  // ---------- Чтение ----------

  async load(id: string): Promise<BookingWithRelations> {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: BOOKING_INCLUDE });
    if (!b) throw notFound('Booking not found');
    return b;
  }

  /** Бронь владельца; чужая или несуществующая → 404 (история 52). */
  async getOwn(userId: string, id: string): Promise<BookingWithRelations> {
    const b = await this.prisma.booking.findFirst({ where: { id, userId }, include: BOOKING_INCLUDE });
    if (!b) throw notFound('Booking not found');
    return b;
  }

  listOwn(userId: string): Promise<BookingWithRelations[]> {
    return this.prisma.booking.findMany({ where: { userId }, include: BOOKING_INCLUDE, orderBy: { startAt: 'desc' }, take: 100 });
  }

  /** Сумма возврата, если клиент отменит сейчас; null — отмена клиентом недоступна. */
  async cancelPreview(b: BookingWithRelations, rules?: BookingRules): Promise<CancelPreview | null> {
    if (!canTransition(b.status, 'CANCELLED_BY_CLIENT')) return null;
    const r = rules ?? (await this.rules());
    const { percent, amount } = refundFor(b, paidTotal(b.payments) - refundedTotal(b.payments), this.clock.now(), r.cancel);
    return { refundPercent: percent, refundAmount: amount };
  }

  // ---------- Машина статусов ----------

  /** Переход статуса в транзакции с блокировкой строки брони. Недопустимый → 409 INVALID_TRANSITION. */
  async transition(id: string, to: BookingStatus, actor: Actor, opts: TransitionOptions = {}): Promise<BookingWithRelations> {
    const after = await this.prisma.$transaction((tx) => this.transitionInTx(tx, id, to, actor, opts));
    await after();
    return this.load(id);
  }

  async lockBooking(tx: Tx, id: string): Promise<LockedBooking | null> {
    const rows = await tx.$queryRaw<LockedBooking[]>`
      SELECT id, status::text AS status, start_at, hold_expires_at, total_amount, deposit_amount, payment_method::text AS payment_method, actual_start_at
      FROM bookings WHERE id = ${id} FOR UPDATE`;
    return rows[0] ?? null;
  }

  /** Переход внутри чужой транзакции (оплата): возвращает действия после коммита. */
  async transitionInTx(tx: Tx, id: string, to: BookingStatus, actor: Actor, opts: TransitionOptions = {}, locked?: LockedBooking): Promise<AfterCommit> {
    const row = locked ?? (await this.lockBooking(tx, id));
    if (!row) throw notFound('Booking not found');
    const from = row.status;
    if (!canTransitionBooking(from, to, !!row.actual_start_at)) throw invalidTransition(from, to);
    const now = this.clock.now();
    const cancelled = to === 'CANCELLED_BY_CLIENT' || to === 'CANCELLED_BY_SYSTEM';
    // Из «Проблемы» в «Подтверждена»: клиенту пишем, только если подтверждения ещё не было (недоплата решена)
    const firstConfirm = to === 'CONFIRMED' && (await tx.bookingStatusChange.count({ where: { bookingId: id, to: 'CONFIRMED' } })) === 0;
    await tx.booking.update({
      where: { id },
      data: {
        ...opts.data,
        status: to,
        ...(to !== 'PENDING_PAYMENT' ? { holdExpiresAt: null } : {}),
        ...(cancelled ? { cancelledAt: now, cancelReason: opts.cancelReason ?? (to === 'CANCELLED_BY_CLIENT' ? 'CLIENT' : 'ADMIN') } : {}),
      },
    });
    await tx.bookingStatusChange.create({ data: { bookingId: id, from, to, actorId: actor.id, reason: opts.reason ?? opts.cancelReason ?? null } });
    if (cancelled) await tx.bookingIncident.updateMany({ where: { bookingId: id, status: 'OPEN' }, data: { status: 'RESOLVED', resolution: 'CANCELLED', resolvedAt: now } });
    if (cancelled) await tx.payment.updateMany({ where: { bookingId: id, status: 'PENDING', kind: { not: 'REFUND' } }, data: { status: 'CANCELLED' } });
    if (isStaff(actor)) await writeAudit(tx, actor, 'booking.status', 'Booking', id, { from, to, reason: opts.reason ?? null });

    return async () => {
      if (TERMINAL.has(to) || !HOLDING.has(to)) await this.jobs.cancelForBooking(id);
      else if (to !== 'PENDING_PAYMENT') await this.jobs.cancel(`hold-${id}`);
      if (to === 'CONFIRMED' && (from === 'PENDING_PAYMENT' || from === 'PROBLEM')) await this.jobs.scheduleReminders(id, row.start_at);
      const name: BookingEventName =
        firstConfirm ? 'confirmed' : to === 'CANCELLED_BY_CLIENT' ? 'cancelled' : opts.cancelReason === 'NOT_PAID' ? 'expired' : opts.cancelReason === 'NO_SHOW' ? 'no_show' : 'status_changed';
      this.events.emit({ bookingId: id, name, params: { from, to, reason: opts.reason ?? null } });
    };
  }

  // ---------- Отмена ----------

  /** Отмена с возвратом по правилам (cancel = { fullHours, halfHours, halfPercent }); при возврате > 0 — запись Payment REFUND (PENDING). */
  async cancel(id: string, actor: Actor, cancelReason: CancelReason = 'CLIENT'): Promise<{ refundAmount: number; refundPercent: number }> {
    const to: BookingStatus = cancelReason === 'CLIENT' ? 'CANCELLED_BY_CLIENT' : 'CANCELLED_BY_SYSTEM';
    const rules = await this.rules();
    let result = { refundAmount: 0, refundPercent: 0 };
    const after = await this.prisma.$transaction(async (tx) => {
      const row = await this.lockBooking(tx, id);
      if (!row) throw notFound('Booking not found');
      if (!canTransitionBooking(row.status, to, !!row.actual_start_at)) throw invalidTransition(row.status, to);
      // Клиент сообщил, что байка нет: «не пришёл» или отмена по правилам лишили бы его полного возврата
      if (cancelReason !== 'BIKE_MISSING' && actor.role !== 'CLIENT' && (await tx.bookingIncident.count({ where: { bookingId: id, status: 'OPEN', clientReportedAt: { not: null } } })) > 0) {
        throw apiError(HttpStatus.CONFLICT, 'INCIDENT_OPEN', 'Resolve the missing bike report first');
      }
      const payments = await tx.payment.findMany({ where: { bookingId: id } });
      // Байка не оказалось: вина точки, правила отмены не действуют — клиенту возвращается всё внесённое
      const net = paidTotal(payments) - refundedTotal(payments);
      const { percent, amount } = cancelReason === 'BIKE_MISSING' ? { percent: 100, amount: Math.max(0, net) } : refundFor({ startAt: row.start_at, totalAmount: row.total_amount, depositAmount: row.deposit_amount }, net, this.clock.now(), rules.cancel);
      result = { refundAmount: amount, refundPercent: percent };
      const done = await this.transitionInTx(tx, id, to, actor, { cancelReason, data: { refundAmount: amount } }, row);
      if (amount > 0) {
        await tx.payment.create({
          data: { bookingId: id, kind: 'REFUND', method: row.payment_method, amount, status: 'PENDING', comment: `refund ${percent}%`, createdById: actor.id },
        });
      }
      return async () => {
        await done();
        if (amount > 0) this.events.emit({ bookingId: id, name: 'refund_recorded', params: { amount, percent } });
      };
    });
    await after();
    return result;
  }

  async cancelOwn(userId: string, id: string): Promise<{ refundAmount: number; refundPercent: number }> {
    await this.getOwn(userId, id);
    return this.cancel(id, { id: userId, role: 'CLIENT' }, 'CLIENT');
  }

  /** «Не пришёл» — отметка менеджера (история 69). */
  markNoShow(id: string, actor: Actor): Promise<{ refundAmount: number; refundPercent: number }> {
    return this.cancel(id, actor, 'NO_SHOW');
  }

  /** «Сообщить о проблеме» клиентом: Подтверждена / Выдана → Проблема. */
  async reportProblem(userId: string, id: string, comment: string | null): Promise<BookingWithRelations> {
    const own = await this.getOwn(userId, id);
    if (own.status !== 'CONFIRMED' && own.status !== 'ISSUED') throw invalidTransition(own.status, 'PROBLEM');
    const after = await this.prisma.$transaction(async (tx) => {
      const done = await this.transitionInTx(tx, id, 'PROBLEM', { id: userId, role: 'CLIENT' }, { reason: comment ? `client: ${comment.slice(0, 500)}` : 'client' });
      return async () => {
        await done();
        this.events.emit({ bookingId: id, name: 'problem', params: { comment } });
      };
    });
    await after();
    return this.load(id);
  }

  // ---------- Очереди ----------

  /** Задача удержания: «Ожидает оплаты» с истёкшим удержанием → «Отменена системой» (не оплачено вовремя). */
  async expireHold(id: string): Promise<boolean> {
    const now = this.clock.now();
    try {
      const after = await this.prisma.$transaction(async (tx) => {
        const row = await this.lockBooking(tx, id);
        if (!row || row.status !== 'PENDING_PAYMENT' || !row.hold_expires_at || row.hold_expires_at.getTime() > now.getTime()) return null;
        const done = await this.transitionInTx(tx, id, 'CANCELLED_BY_SYSTEM', SYSTEM, { cancelReason: 'NOT_PAID' }, row);
        await tx.payment.updateMany({ where: { bookingId: id, status: 'CANCELLED', kind: { not: 'REFUND' } }, data: { status: 'EXPIRED' } });
        return done;
      });
      if (!after) return false;
      await after();
      return true;
    } catch (e) {
      this.log.error(`expireHold ${id}: ${(e as Error).message}`);
      throw e;
    }
  }

  async expireOverdueHolds(): Promise<number> {
    const rows = await this.prisma.booking.findMany({ where: { status: 'PENDING_PAYMENT', holdExpiresAt: { lte: this.clock.now() } }, select: { id: true }, take: 500 });
    let n = 0;
    for (const r of rows) if (await this.expireHold(r.id)) n++;
    return n;
  }

  /** Неявка: «Подтверждена» без акта выдачи (клиент пришёл, если акт есть) через noShowHours после времени выдачи → «Отменена системой» (неявка). */
  async cancelNoShows(): Promise<number> {
    const rules = await this.rules();
    const cutoff = new Date(this.clock.now().getTime() - rules.noShowHours * 3_600_000);
    const rows = await this.prisma.booking.findMany({ where: { status: 'CONFIRMED', startAt: { lte: cutoff }, handoverActs: { none: { kind: 'ISSUE' } }, incidents: { none: { status: 'OPEN', clientReportedAt: { not: null } } } }, select: { id: true }, take: 500 });
    let n = 0;
    for (const r of rows) {
      try {
        await this.cancel(r.id, SYSTEM, 'NO_SHOW');
        n++;
      } catch (e) {
        this.log.warn(`no-show ${r.id}: ${(e as Error).message}`);
      }
    }
    return n;
  }

  /** Сумма к оплате онлайн (VietQR: аренда + депозит; наличные: предоплата). */
  onlinePayable(b: Parameters<typeof onlinePayable>[0]): number {
    return onlinePayable(b);
  }
}
