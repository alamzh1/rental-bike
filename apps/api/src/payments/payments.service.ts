import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { Payment, Prisma } from '@prisma/client';
import { vndToRub, type PayBookingResponse, type PaymentDto } from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AnalyticsService } from '../analytics/analytics.service';
import { Clock } from '../jobs/clock';
import { sendAlert } from '../jobs/alerts';
import { notFound } from '../auth/api-errors';
import { BookingsService } from '../bookings/bookings.service';
import { BookingEvents } from '../bookings/booking-events';
import { apiError } from '../bookings/errors';
import { SYSTEM, writeAudit, type Actor } from '../bookings/audit';
import { PAYMENT_PROVIDER, type PaymentProvider, type WebhookRequest } from './payment-provider';
import { TestProvider, testProviderAllowed } from './test-provider';
import { LocationAccounts } from './location-accounts';
import { loadRubOffer, type RubOffer } from './rub-transfer';

// Платежи: QR для брони, webhook (идемпотентно по externalId), сверка суммы, возвраты.

export type MarkPaidResult = 'paid' | 'duplicate' | 'mismatch' | 'late' | 'unknown';

export function toPaymentDto(p: Payment): PaymentDto {
  return {
    id: p.id,
    bookingId: p.bookingId,
    kind: p.kind,
    method: p.method,
    provider: p.provider,
    amount: p.amount,
    receivedAmount: p.receivedAmount,
    status: p.status,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    comment: p.comment,
    rubAmount: p.rubAmount,
    rubRate: p.rubRate,
  };
}

export function devPaymentsEnabled(provider: PaymentProvider): boolean {
  return provider.name === 'test' && testProviderAllowed();
}

const MAX_ORDER_ATTEMPTS = 1000;
/** Администратор сверяет перевод вручную: после «Я перевёл» байк держится столько, в том числе ночью. */
export const RUB_CLAIM_HOLD_MS = 6 * 3_600_000;

@Injectable()
export class PaymentsService {
  private readonly log = new Logger('Payments');

  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly events: BookingEvents,
    private readonly analytics: AnalyticsService,
    private readonly clock: Clock,
    @Inject(PAYMENT_PROVIDER) readonly provider: PaymentProvider,
    private readonly moduleRef: ModuleRef,
    private readonly accounts: LocationAccounts,
  ) {}

  private response(p: Payment, code: string, provider: PaymentProvider): PayBookingResponse {
    const raw = (p.raw ?? {}) as { deeplink?: string | null };
    return {
      paymentId: p.id,
      provider: provider.name,
      qrPayload: p.qrPayload ?? '',
      deeplink: raw.deeplink ?? null,
      amount: p.amount,
      description: code,
      expiresAt: (p.expiresAt ?? this.clock.now()).toISOString(),
    };
  }

  /** На чей счёт создан платёж: id точки или null — общий счёт. Записывается при создании QR. */
  private accountOf(p: Pick<Payment, 'raw'>): string | null {
    const account = (p.raw as { account?: unknown } | null)?.account;
    return typeof account === 'string' ? account : null;
  }

  /** POST /bookings/{id}/pay: QR на сумму к оплате онлайн; до истечения удержания повторный вызов отдаёт тот же платёж. */
  async pay(userId: string, bookingId: string): Promise<PayBookingResponse> {
    const b = await this.bookings.getOwn(userId, bookingId);
    const now = this.clock.now();
    if (b.status !== 'PENDING_PAYMENT') throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', `Booking is ${b.status}`);
    if (!b.holdExpiresAt || b.holdExpiresAt.getTime() <= now.getTime()) throw apiError(HttpStatus.CONFLICT, 'HOLD_EXPIRED', 'Hold has expired');
    const amount = this.bookings.onlinePayable(b);
    if (amount <= 0) throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', 'Nothing to pay online');
    if (b.paymentMethod === 'RUB_TRANSFER') return this.payRub(b, amount);
    const account = await this.accounts.forLocation(b.locationId);
    const provider = account.provider;
    if (provider.name === 'disabled') throw apiError(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENT_NOT_AVAILABLE', 'Online payment is not configured');
    const kind = b.paymentMethod === 'CASH' ? 'PREPAYMENT' : 'RENT';

    const existing = b.payments.find(
      (p) => p.status === 'PENDING' && p.kind === kind && p.amount === amount && p.provider === provider.name && this.accountOf(p) === account.locationId && p.externalId && p.expiresAt && p.expiresAt.getTime() > now.getTime(),
    );
    if (existing) return this.response(existing, b.code, provider);

    // orderCode уникален для всех видов платежей брони; 999 попыток за удержание — явный сбой, а не повтор кода
    const attempt = b.payments.length + 1;
    if (attempt >= MAX_ORDER_ATTEMPTS) throw apiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many payment attempts');
    const draft = await this.prisma.payment.create({
      data: { bookingId: b.id, kind, method: 'VIETQR', provider: provider.name, amount, status: 'PENDING', expiresAt: b.holdExpiresAt, comment: b.code },
    });
    try {
      const created = await provider.createPayment({
        paymentId: draft.id,
        bookingId: b.id,
        bookingCode: b.code,
        orderCode: b.seq * MAX_ORDER_ATTEMPTS + attempt,
        amount,
        description: b.code,
        expiresAt: b.holdExpiresAt,
      });
      await this.prisma.payment.updateMany({ where: { bookingId: b.id, status: 'PENDING', kind, id: { not: draft.id } }, data: { status: 'CANCELLED' } });
      const p = await this.prisma.payment.update({
        where: { id: draft.id },
        data: { externalId: created.externalId, qrPayload: created.qrPayload, expiresAt: created.expiresAt, raw: { deeplink: created.deeplink ?? null, account: account.locationId } },
      });
      return this.response(p, b.code, provider);
    } catch (e) {
      await this.prisma.payment.update({ where: { id: draft.id }, data: { status: 'FAILED' } });
      // История 87: ошибка оплаты — алерт в чат администратора (sendAlert пишет и в лог).
      await sendAlert(this.moduleRef, this.log, `Payment provider error ${b.code} (${provider.name}): ${(e as Error).message}`);
      throw apiError(HttpStatus.BAD_GATEWAY, 'PAYMENT_PROVIDER_ERROR', 'Payment provider is unavailable');
    }
  }

  /** Реквизиты и сумма в рублях: курс фиксируется в платеже, повторный вызов отдаёт ту же сумму. */
  private async payRub(b: Awaited<ReturnType<BookingsService['getOwn']>>, amount: number): Promise<PayBookingResponse> {
    const offer = await loadRubOffer(this.prisma, this.clock.now());
    if (!offer) throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', 'Ruble transfer is not available');
    const existing = b.payments.find((p) => p.status === 'PENDING' && p.method === 'RUB_TRANSFER' && p.amount === amount);
    const p = existing ?? (await this.prisma.payment.create({
      data: { bookingId: b.id, kind: 'RENT', method: 'RUB_TRANSFER', provider: 'manual', amount, status: 'PENDING', expiresAt: b.holdExpiresAt, comment: b.code, externalId: `rub:${b.id}:${b.payments.length + 1}`, rubAmount: vndToRub(amount, offer.rubPerVnd), rubRate: offer.rubPerVnd },
    }));
    return this.rubResponse(p, b.code, offer, b.holdExpiresAt, b.depositAmount);
  }

  private rubResponse(p: Payment, code: string, offer: RubOffer, hold: Date | null, depositCash: number): PayBookingResponse {
    return {
      paymentId: p.id,
      provider: 'manual',
      qrPayload: '',
      deeplink: null,
      amount: p.amount,
      description: code,
      expiresAt: (hold ?? this.clock.now()).toISOString(),
      rub: { amount: p.rubAmount ?? 0, rate: p.rubRate ?? 0, phone: offer.phone, bank: offer.bank, recipient: offer.recipient, claimedAt: p.claimedAt ? p.claimedAt.toISOString() : null, depositCash },
    };
  }

  /** «Я перевёл»: удержание продлевается, администратор получает сообщение. Деньги считаются полученными только после его подтверждения. */
  async claimRub(userId: string, bookingId: string): Promise<PayBookingResponse> {
    const own = await this.bookings.getOwn(userId, bookingId);
    const offer = await loadRubOffer(this.prisma, this.clock.now());
    if (own.paymentMethod !== 'RUB_TRANSFER' || !offer) throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', 'Ruble transfer is not available');
    let notify = false;
    const r = await this.prisma.$transaction(async (tx) => {
      const b = await this.bookings.lockBooking(tx, bookingId);
      const now = this.clock.now();
      if (!b || b.status !== 'PENDING_PAYMENT') throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', `Booking is ${b?.status}`);
      if (!b.hold_expires_at || b.hold_expires_at.getTime() <= now.getTime()) throw apiError(HttpStatus.CONFLICT, 'HOLD_EXPIRED', 'Hold has expired');
      const p = await tx.payment.findFirst({ where: { bookingId, method: 'RUB_TRANSFER', status: 'PENDING' }, orderBy: { createdAt: 'desc' } });
      if (!p) throw apiError(HttpStatus.CONFLICT, 'PAYMENT_NOT_AVAILABLE', 'Open the payment first');
      if (p.claimedAt) return { payment: p, hold: b.hold_expires_at };
      const hold = new Date(now.getTime() + RUB_CLAIM_HOLD_MS);
      await tx.booking.update({ where: { id: bookingId }, data: { holdExpiresAt: hold } });
      notify = true;
      return { payment: await tx.payment.update({ where: { id: p.id }, data: { claimedAt: now } }), hold };
    });
    if (notify) this.events.emit({ bookingId, name: 'rub_transfer_claimed', params: { rub: r.payment.rubAmount ?? 0 } });
    return this.rubResponse(r.payment, own.code, offer, r.hold, own.depositAmount);
  }

  /** Администратор нашёл перевод: дальше как обычная оплата, в том числе возврат, если бронь уже отменена. */
  async confirmRub(paymentId: string, actor: Actor): Promise<MarkPaidResult> {
    const p = await this.prisma.payment.findFirst({ where: { id: paymentId, method: 'RUB_TRANSFER', claimedAt: { not: null }, status: { not: 'PAID' } } });
    if (!p || !p.externalId) throw notFound('Transfer not found');
    await writeAudit(this.prisma, actor, 'payment.rub_confirmed', 'Payment', p.id, { bookingId: p.bookingId, amount: p.amount, rub: p.rubAmount, rate: p.rubRate });
    return this.markPaid(p.externalId, p.amount, { confirmedBy: actor.id, rub: p.rubAmount, rate: p.rubRate });
  }

  /** Перевод не найден: клиент получает обычное удержание, чтобы проверить перевод или выбрать другой способ. */
  async rejectRub(paymentId: string, actor: Actor): Promise<void> {
    const found = await this.prisma.payment.findFirst({ where: { id: paymentId, method: 'RUB_TRANSFER', claimedAt: { not: null }, status: { not: 'PAID' } } });
    if (!found) throw notFound('Transfer not found');
    const { holdMinutes } = await this.bookings.rules();
    await this.prisma.$transaction(async (tx) => {
      const b = await this.bookings.lockBooking(tx, found.bookingId);
      await tx.payment.update({ where: { id: found.id }, data: { claimedAt: null } });
      if (b?.status === 'PENDING_PAYMENT') await tx.booking.update({ where: { id: found.bookingId }, data: { holdExpiresAt: new Date(this.clock.now().getTime() + holdMinutes * 60_000) } });
      await writeAudit(tx, actor, 'payment.rub_not_found', 'Payment', found.id, { bookingId: found.bookingId, rub: found.rubAmount });
    });
    this.events.emit({ bookingId: found.bookingId, name: 'rub_transfer_not_found' });
  }

  /**
   * Оплата по внешнему ID — идемпотентно: повторный вызов не создаёт второй оплаты.
   * Сумма совпала → «Подтверждена»; недоплата или переплата → «Проблема» (уведомление менеджеру через BookingEvents).
   */
  async markPaid(externalId: string, amount: number, raw: unknown = null): Promise<MarkPaidResult> {
    const found = await this.prisma.payment.findUnique({ where: { externalId }, select: { id: true, bookingId: true } });
    if (!found) return 'unknown';
    const now = this.clock.now();
    let result: MarkPaidResult = 'paid';
    const after = await this.prisma.$transaction(async (tx) => {
      // Порядок блокировок: бронь → платёж (как в отмене и удержании) — без взаимных блокировок
      const booking = await this.bookings.lockBooking(tx, found.bookingId);
      const rows = await tx.$queryRaw<{ id: string; status: string; amount: number }[]>`
        SELECT id, status::text AS status, amount FROM payments WHERE id = ${found.id} FOR UPDATE`;
      const p = rows[0];
      if (!booking || !p) return null;
      if (p.status === 'PAID') {
        result = 'duplicate';
        return null;
      }
      await tx.payment.update({ where: { id: p.id }, data: { status: 'PAID', receivedAmount: amount, paidAt: now, raw: { ...(raw && typeof raw === 'object' ? raw : {}), received: amount } as Prisma.InputJsonValue } });

      if (booking.status !== 'PENDING_PAYMENT') {
        result = 'late';
        await writeAudit(tx, SYSTEM, 'payment.late', 'Payment', p.id, { bookingStatus: booking.status, amount });
        // Деньги за отменённую бронь надо вернуть: запись «к возврату» видна в сверке
        if (booking.status === 'CANCELLED_BY_CLIENT' || booking.status === 'CANCELLED_BY_SYSTEM') {
          const current = await tx.booking.findUniqueOrThrow({ where: { id: booking.id }, select: { refundAmount: true, paymentMethod: true } });
          await tx.booking.update({ where: { id: booking.id }, data: { refundAmount: (current.refundAmount ?? 0) + amount } });
          await tx.payment.create({ data: { bookingId: booking.id, kind: 'REFUND', method: current.paymentMethod, amount, status: 'PENDING', comment: 'payment after cancel' } });
        }
        return async () => this.events.emit({ bookingId: booking.id, name: 'payment_after_cancel', params: { amount, status: booking.status } });
      }
      if (amount !== p.amount) {
        result = 'mismatch';
        const reason = amount < p.amount ? 'UNDERPAID' : 'OVERPAID';
        const done = await this.bookings.transitionInTx(tx, booking.id, 'PROBLEM', SYSTEM, { reason: `${reason}: expected ${p.amount}, received ${amount}` }, booking);
        return async () => {
          await done();
          this.events.emit({ bookingId: booking.id, name: 'payment_mismatch', params: { reason, expected: p.amount, received: amount } });
        };
      }
      const done = await this.bookings.transitionInTx(tx, booking.id, 'CONFIRMED', SYSTEM, { reason: 'paid' }, booking);
      await tx.payment.updateMany({ where: { bookingId: booking.id, status: 'PENDING', kind: { not: 'REFUND' }, id: { not: p.id } }, data: { status: 'CANCELLED' } });
      return done;
    });
    if (after) await after();
    if (result === 'paid' || result === 'mismatch') {
      const owner = await this.prisma.booking.findUnique({ where: { id: found.bookingId }, select: { userId: true } });
      await this.analytics.track(owner?.userId ?? null, 'paid', { bookingId: found.bookingId, amount, result }).catch(() => undefined);
    }
    return result;
  }

  /** Webhook: подпись неверна → 400 INVALID_SIGNATURE; неизвестный заказ (проверочный webhook payOS) — подтверждается без действий. */
  async handleWebhook(req: WebhookRequest): Promise<MarkPaidResult | 'ignored'> {
    return this.acceptEvent(this.provider, null, req);
  }

  /** Webhook счёта точки. Точка без своих ключей подписи не проверит — такой запрос отклоняется. */
  async handleLocationWebhook(locationId: string, req: WebhookRequest): Promise<MarkPaidResult | 'ignored'> {
    const account = await this.accounts.forLocation(locationId);
    if (account.locationId !== locationId) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_SIGNATURE', 'Invalid webhook signature');
    return this.acceptEvent(account.provider, locationId, req);
  }

  /**
   * Подпись счёта подтверждает только платежи этого счёта: владелец знает свой ключ подписи и иначе мог бы
   * «оплатить» бронь другой точки, подставив чужой номер заказа.
   */
  private async acceptEvent(provider: PaymentProvider, account: string | null, req: WebhookRequest): Promise<MarkPaidResult | 'ignored'> {
    const event = provider.verifyWebhook(req);
    if (!event) throw apiError(HttpStatus.BAD_REQUEST, 'INVALID_SIGNATURE', 'Invalid webhook signature');
    if (!event.paid) return 'ignored';
    const payment = await this.prisma.payment.findUnique({ where: { externalId: event.externalId }, select: { raw: true } });
    if (payment && this.accountOf(payment) !== account) {
      this.log.warn(`Webhook счёта ${account ?? 'platform'} для чужого платежа ${event.externalId} отклонён`);
      return 'ignored';
    }
    return this.markPaid(event.externalId, event.amount, event.raw);
  }

  /** dev: «Оплатить (тест)» — тестовый провайдер присылает webhook на сумму платежа (или `amount` для проверки недоплаты). */
  async devPay(userId: string, paymentId: string, amount?: number): Promise<{ result: MarkPaidResult | 'ignored'; bookingId: string }> {
    if (!devPaymentsEnabled(this.provider) || !(this.provider instanceof TestProvider)) throw notFound();
    const p = await this.prisma.payment.findFirst({ where: { id: paymentId, booking: { userId } } });
    if (!p || !p.externalId) throw notFound('Payment not found');
    const result = await this.handleWebhook({ body: this.provider.simulate(p.externalId, amount ?? p.amount), headers: {} });
    return { result, bookingId: p.bookingId };
  }

  // ---------- Возвраты ----------

  /**
   * Ручная запись возврата (администратор): Payment REFUND, сразу PAID. Всё под блокировкой брони, как отмена и приём байка:
   * `check` видит актуальные платежи, и параллельные возвраты не превысят оплату.
   */
  async recordRefund(bookingId: string, amount: number, actor: Actor, comment: string | null = null, check?: (payments: Payment[]) => void): Promise<Payment> {
    if (!Number.isInteger(amount) || amount <= 0) throw apiError(HttpStatus.BAD_REQUEST, 'VALIDATION', 'amount must be a positive integer');
    const p = await this.prisma.$transaction(async (tx) => {
      if (!(await this.bookings.lockBooking(tx, bookingId))) throw notFound('Booking not found');
      const b = await tx.booking.findUniqueOrThrow({ where: { id: bookingId }, select: { paymentMethod: true } });
      check?.(await tx.payment.findMany({ where: { bookingId } }));
      const created = await tx.payment.create({
        data: { bookingId, kind: 'REFUND', method: b.paymentMethod, amount, status: 'PAID', paidAt: this.clock.now(), comment, createdById: actor.id },
      });
      await writeAudit(tx, actor, 'payment.refund', 'Payment', created.id, { bookingId, amount, comment });
      return created;
    });
    this.events.emit({ bookingId, name: 'refunded', params: { amount } });
    return p;
  }

  /** Отметка «возврат выполнен» по записи, созданной при отмене (VietQR — вручную). Повторная отметка клиенту не пишет. */
  async completeRefund(paymentId: string, actor: Actor, comment: string | null = null, alreadyDone?: () => Error): Promise<Payment> {
    const found = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!found || found.kind !== 'REFUND') throw notFound('Refund not found');
    let changed = false;
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.bookings.lockBooking(tx, found.bookingId);
      const p = await tx.payment.findUniqueOrThrow({ where: { id: paymentId } });
      if (p.status === 'PAID') {
        if (alreadyDone) throw alreadyDone();
        return p;
      }
      if (p.status !== 'PENDING') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Refund is ${p.status}`);
      const u = await tx.payment.update({ where: { id: p.id }, data: { status: 'PAID', paidAt: this.clock.now(), comment: comment ?? p.comment, createdById: p.createdById ?? actor.id } });
      await writeAudit(tx, actor, 'payment.refund', 'Payment', p.id, { bookingId: p.bookingId, amount: p.amount, comment });
      changed = true;
      return u;
    });
    if (changed) this.events.emit({ bookingId: updated.bookingId, name: 'refunded', params: { amount: updated.amount } });
    return updated;
  }

  async listForBooking(bookingId: string): Promise<PaymentDto[]> {
    const rows = await this.prisma.payment.findMany({ where: { bookingId }, orderBy: { createdAt: 'asc' } });
    return rows.map(toPaymentDto);
  }
}
