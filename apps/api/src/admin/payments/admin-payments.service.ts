import { HttpStatus, Injectable } from '@nestjs/common';
import type { BookingStatus, Prisma } from '@prisma/client';
import type { AdminDeductionRow, AdminListOf, AdminPaymentList, AdminReconciliation, AdminReconciliationRow, AdminRubTransferRow, PaymentDto } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentsService, toPaymentDto } from '../../payments/payments.service';
import { onlinePayable } from '../../bookings/booking.mapper';
import { paidTotal } from '../../bookings/refund';
import { apiError } from '../../bookings/errors';
import { badRequest, notFound } from '../../auth/api-errors';
import { parseInstant } from '../../catalog/query';
import { inScope, scopeWhere, staffScope } from '../../auth/staff-scope';
import { displayName, type AdminUser } from '../auth';
import { actorOf, asBody, int, oneOf, optStr, pageOf } from '../fleet/input';

// Платежи: все транзакции, сверка ожидаемого и полученного по броням, возвраты (PaymentsService.recordRefund/completeRefund →
// событие refunded → NotificationsService пишет клиенту), удержания из депозита (DepositDeduction, пишет менеджер при возврате).

const PAGE_SIZE = 50;
const DAY = 86_400_000;
const KINDS = ['RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE', 'REFUND'] as const;
const STATUSES = ['PENDING', 'PAID', 'FAILED', 'EXPIRED', 'CANCELLED'] as const;
const INCOMING = new Set(['RENT', 'DEPOSIT', 'PREPAYMENT', 'SURCHARGE']);
const CANCELLED = new Set<BookingStatus>(['CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM']);
/** Брони, по которым деньги должны были прийти полностью (выдана, завершена, проблема). */
const FULLY_DUE = new Set<BookingStatus>(['ISSUED', 'COMPLETED', 'PROBLEM']);

const refundDuplicate = () => apiError(HttpStatus.CONFLICT, 'REFUND_DUPLICATE', 'A refund of this amount is already recorded for the booking');
const refundExceeds = (max: number) => apiError(HttpStatus.BAD_REQUEST, 'REFUND_EXCEEDS_PAID', `Refund exceeds the amount received (available ${max})`);

type ReconSource = Prisma.BookingGetPayload<{
  include: { payments: true; deductions: { select: { amount: true } }; user: { select: { firstName: true; lastName: true; username: true; telegramId: true } } };
}>;

/** Сверка одной брони (чистая функция — ожидаемое по статусу и способу оплаты). */
export function reconcile(b: ReconSource): AdminReconciliationRow {
  const received = paidTotal(b.payments);
  const refunds = b.payments.filter((p) => p.kind === 'REFUND');
  const refunded = refunds.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const pending = refunds.filter((p) => p.status === 'PENDING');
  const refundPending = pending.reduce((s, p) => s + p.amount, 0);
  const deducted = b.deductions.reduce((s, d) => s + d.amount, 0);
  let expected: number;
  if (CANCELLED.has(b.status)) expected = Math.max(0, received - (b.refundAmount ?? 0)); // удерживается по правилам отмены
  // Завершена: депозит за вычетом удержаний уходит обратно, остаться должно остальное
  else if (FULLY_DUE.has(b.status)) expected = b.totalAmount + b.depositAmount + b.lateFeeAmount - (b.status === 'COMPLETED' ? (b.refundAmount ?? 0) : 0);
  else expected = onlinePayable(b); // CONFIRMED / PENDING_PAYMENT: то, что платится до выдачи (наличные — предоплата)
  // Недоплата — пришло меньше ожидаемого; возврат, сделанный намеренно, недоплатой не считается
  const net = received - refunded;
  const difference = received < expected ? received - expected : Math.max(0, net - expected);
  const state: AdminReconciliationRow['state'] = refundPending > 0 ? 'REFUND_DUE' : difference < 0 ? 'UNDERPAID' : difference > 0 && !CANCELLED.has(b.status) ? 'OVERPAID' : 'OK';
  const lastIn = [...b.payments].filter((p) => INCOMING.has(p.kind) && p.status === 'PAID').sort((x, y) => y.createdAt.getTime() - x.createdAt.getTime())[0];
  return {
    bookingId: b.id,
    code: b.code,
    status: b.status,
    paymentMethod: b.paymentMethod,
    clientName: displayName(b.user),
    startAt: b.startAt.toISOString(),
    expected,
    received,
    refunded,
    refundPending,
    deducted,
    difference,
    state,
    paymentId: lastIn?.id ?? null,
    pendingRefundId: pending[0]?.id ?? null,
  };
}

@Injectable()
export class AdminPaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
  ) {}

  async list(user: AdminUser, q: Record<string, unknown>): Promise<AdminPaymentList> {
    const page = pageOf(q.page);
    const text = typeof q.q === 'string' ? q.q.trim().slice(0, 50) : '';
    const where: Prisma.PaymentWhereInput = {
      ...(q.kind ? { kind: oneOf(q.kind, 'kind', KINDS) } : {}),
      ...(q.status ? { status: oneOf(q.status, 'status', STATUSES) } : {}),
      booking: { ...scopeWhere(staffScope(user)), ...(text ? { code: { contains: text, mode: 'insensitive' } } : {}) },
    };
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: { booking: { select: { code: true, user: { select: { firstName: true, lastName: true, username: true, telegramId: true } } } } },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        take: PAGE_SIZE,
        skip: (page - 1) * PAGE_SIZE,
      }),
    ]);
    return {
      items: rows.map((p) => ({ ...toPaymentDto(p), bookingCode: p.booking.code, clientName: displayName(p.booking.user) })),
      total,
      page,
      pageSize: PAGE_SIZE,
    };
  }

  async reconciliation(user: AdminUser, q: Record<string, unknown>): Promise<AdminReconciliation> {
    const now = Date.now();
    const from = q.from ? parseInstant(q.from, 'from') : new Date(now - 30 * DAY);
    const to = q.to ? parseInstant(q.to, 'to') : new Date(now + 30 * DAY);
    if (to.getTime() <= from.getTime()) throw badRequest('to must be after from');
    if (to.getTime() - from.getTime() > 400 * DAY) throw badRequest('Period is limited to 400 days');
    const rows = await this.prisma.booking.findMany({
      where: { ...scopeWhere(staffScope(user)), startAt: { gte: from, lt: to }, OR: [{ status: { notIn: ['PENDING_PAYMENT', 'CANCELLED_BY_CLIENT', 'CANCELLED_BY_SYSTEM'] } }, { payments: { some: { status: 'PAID' } } }] },
      include: { payments: true, deductions: { select: { amount: true } }, user: { select: { firstName: true, lastName: true, username: true, telegramId: true } } },
      orderBy: { startAt: 'desc' },
    });
    const all = rows.map(reconcile);
    const mismatches = all.filter((r) => r.state !== 'OK').length;
    const items = q.onlyMismatches === '1' || q.onlyMismatches === 'true' ? all.filter((r) => r.state !== 'OK') : all;
    return { from: from.toISOString(), to: to.toISOString(), items, total: items.length, mismatches };
  }

  async deductions(user: AdminUser): Promise<AdminListOf<AdminDeductionRow>> {
    const rows = await this.prisma.depositDeduction.findMany({
      where: { booking: scopeWhere(staffScope(user)) },
      include: { booking: { select: { code: true } }, createdBy: { select: { firstName: true, lastName: true, username: true, telegramId: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return {
      items: rows.map((d) => ({ id: d.id, bookingId: d.bookingId, bookingCode: d.booking.code, amount: d.amount, reason: d.reason, createdAt: d.createdAt.toISOString(), createdBy: displayName(d.createdBy) })),
      total: rows.length,
    };
  }

  /** Клиент сообщил о переводе, решения ещё нет. Отменённая за это время бронь остаётся в списке: деньги могли прийти. */
  async rubTransfers(): Promise<AdminListOf<AdminRubTransferRow>> {
    const rows = await this.prisma.payment.findMany({
      where: { method: 'RUB_TRANSFER', claimedAt: { not: null }, status: { not: 'PAID' } },
      include: { booking: { select: { code: true, status: true, phone: true, user: { select: { firstName: true, lastName: true, username: true, telegramId: true, phone: true } } } } },
      orderBy: { claimedAt: 'asc' },
      take: 200,
    });
    return {
      items: rows.map((p) => ({ paymentId: p.id, bookingId: p.bookingId, bookingCode: p.booking.code, bookingStatus: p.booking.status, clientName: displayName(p.booking.user), clientPhone: p.booking.phone ?? p.booking.user.phone, rubAmount: p.rubAmount ?? 0, rubRate: p.rubRate ?? 0, amount: p.amount, claimedAt: p.claimedAt!.toISOString() })),
      total: rows.length,
    };
  }

  confirmRub(user: AdminUser, id: string) {
    return this.payments.confirmRub(id, actorOf(user));
  }

  rejectRub(user: AdminUser, id: string) {
    return this.payments.rejectRub(id, actorOf(user));
  }

  /**
   * POST /admin/payments/{id}/refund. Ожидающий возврат → «выполнен»; входящий платёж → новый возврат по брони на amount.
   * Повтор той же суммы → 409 REFUND_DUPLICATE; больше полученного (за вычетом возвратов) → 400 REFUND_EXCEEDS_PAID.
   */
  async refund(user: AdminUser, id: string, body: unknown): Promise<PaymentDto> {
    const b = asBody(body);
    const comment = optStr(b.comment, 'comment', 500);
    const p = await this.prisma.payment.findUnique({ where: { id }, select: { id: true, bookingId: true, kind: true, status: true, booking: { select: { locationId: true } } } });
    if (!p || !inScope(staffScope(user), p.booking.locationId)) throw notFound('Payment not found');
    if (p.kind === 'REFUND') {
      // Повторный клик, в том числе параллельный, видит уже выполненный возврат под блокировкой
      return toPaymentDto(await this.payments.completeRefund(id, actorOf(user), comment, refundDuplicate));
    }
    if (p.status !== 'PAID') throw badRequest('Only a received payment can be refunded');
    const amount = int(b.amount, 'amount', 1, 1_000_000_000);
    // Проверка внутри блокировки брони: повторный клик и параллельная отмена видят уже записанный возврат
    return toPaymentDto(
      await this.payments.recordRefund(p.bookingId, amount, actorOf(user), comment, (all) => {
        const refunds = all.filter((x) => x.kind === 'REFUND' && (x.status === 'PAID' || x.status === 'PENDING'));
        if (refunds.some((x) => x.amount === amount)) throw refundDuplicate();
        const available = paidTotal(all) - refunds.reduce((s, x) => s + x.amount, 0);
        if (amount > available) throw refundExceeds(Math.max(0, available));
      }),
    );
  }
}
