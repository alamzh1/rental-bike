import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Prisma, type BookingStatus } from '@prisma/client';
import {
  BOOKING_STATUSES,
  canTransitionBooking,
  HOLDING_BOOKING_STATUSES,
  type AdminActArchive,
  type Booking,
  type AdminActPhotos,
  type AdminHandoverAct,
  type AdminBookingDetail,
  type AdminBookingList,
  type AdminBookingRow,
  type AdminConflictError,
  type DocumentUrlResponse,
  type PaymentMethod,
  canSeeMoney,
} from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WALK_IN_PREFIX, BookingsService } from '../../bookings/bookings.service';
import { writeAudit, type Actor } from '../../bookings/audit';
import { BOOKING_INCLUDE, toBookingDto } from '../../bookings/booking.mapper';
import { apiError } from '../../bookings/errors';
import { IncidentsService } from '../../bookings/incidents.service';
import { paidTotal } from '../../bookings/refund';
import { loadBookingRules } from '../../bookings/rules';
import { toPaymentDto } from '../../payments/payments.service';
import { DocumentsService, toDocumentDto } from '../../documents/documents.service';
import { STORAGE, type Storage } from '../../documents/storage/storage';
import { badRequest, notFound } from '../../auth/api-errors';
import { inScope, scopeWhere, staffScope } from '../../auth/staff-scope';
import { parseInstant } from '../../catalog/query';
import { displayName, type AdminUser } from '../auth';

// Брони в админке: список с фильтрами, карточка, смена статуса (через BookingsService), перенос на другой байк
// (проверка пересечения с буфером + exclusion constraint), ручная бронь «с улицы» тем же BookingsService.create.

const HOLDING = new Set<string>(HOLDING_BOOKING_STATUSES);
const E164 = /^\+[1-9]\d{6,14}$/;
const MAX_PAGE_SIZE = 100;
const PHOTO_TTL_SEC = 600;
/** Клиент «с улицы» — без Telegram: служебный telegramId по телефону */

const ROW_INCLUDE = {
  model: { select: { name: true } },
  bike: { select: { plate: true } },
  user: { select: { id: true, firstName: true, lastName: true, username: true, telegramId: true, phone: true } },
  payments: { select: { kind: true, status: true, amount: true, receivedAmount: true } },
} satisfies Prisma.BookingInclude;

type RowSource = Prisma.BookingGetPayload<{ include: typeof ROW_INCLUDE }>;

const ARCHIVE_PAGE = 20;

const DETAIL_INCLUDE = {
  ...BOOKING_INCLUDE,
  bike: { select: { plate: true } },
  user: { select: { id: true, firstName: true, lastName: true, username: true, telegramId: true, phone: true } },
  statusChanges: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { firstName: true, lastName: true, username: true, telegramId: true } } } },
  handoverActs: { orderBy: { createdAt: 'asc' }, include: { manager: { select: { firstName: true, lastName: true, username: true, telegramId: true } } } },
} satisfies Prisma.BookingInclude;

/** 409 с телом { code, message, conflict? } — клиент показывает причину и бронь-помеху. */
function conflict(body: AdminConflictError): never {
  throw new HttpException(body, HttpStatus.CONFLICT);
}

function isExclusionViolation(e: unknown): boolean {
  const text = e instanceof Error ? e.message : String(e);
  return /23P01|bookings_bike_no_overlap/.test(text);
}

export function toRow(b: RowSource): AdminBookingRow {
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    modelId: b.modelId,
    modelName: b.model.name,
    bikeId: b.bikeId,
    bikePlate: b.bike.plate,
    locationId: b.locationId,
    client: {
      id: b.user.id,
      name: displayName(b.user),
      username: b.user.username,
      phone: b.phone ?? b.user.phone,
      telegramId: b.user.telegramId,
      walkIn: b.user.telegramId.startsWith(WALK_IN_PREFIX),
    },
    paymentMethod: b.paymentMethod,
    totalAmount: b.totalAmount,
    depositAmount: b.depositAmount,
    paidAmount: paidTotal(b.payments),
    holdExpiresAt: b.status === 'PENDING_PAYMENT' && b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
    createdAt: b.createdAt.toISOString(),
  };
}

function parseStatuses(v: unknown): BookingStatus[] | undefined {
  if (v === undefined || v === '') return undefined;
  const list = (Array.isArray(v) ? v : String(v).split(',')).map((s) => String(s).trim()).filter(Boolean);
  for (const s of list) if (!(BOOKING_STATUSES as readonly string[]).includes(s)) throw badRequest(`Unknown status ${s}`);
  return list as BookingStatus[];
}

function parsePositive(v: unknown, name: string, fallback: number, max = Number.MAX_SAFE_INTEGER): number {
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1 || n > max) throw badRequest(`${name} must be an integer 1…${max}`);
  return n;
}

/** Менеджеру суммы в админке не показываются (история 84): наличные он ведёт в своём режиме Mini App. */
export function withoutMoney<T extends { totalAmount: number; depositAmount: number; paidAmount: number }>(row: T): T {
  return { ...row, totalAmount: 0, depositAmount: 0, paidAmount: 0 };
}

/** Вся бронь без сумм: кроме итогов деньги есть в расчёте, опциях и предложении замены. */
function bookingWithoutMoney(b: Booking): Booking {
  return {
    ...b,
    rentAmount: 0,
    extrasAmount: 0,
    deliveryAmount: 0,
    depositAmount: 0,
    totalAmount: 0,
    lateFeeAmount: 0,
    refundAmount: null,
    paidAmount: 0,
    payable: 0,
    quote: { days: b.quote.days, pricePerDay: 0, rent: 0, extras: 0, delivery: 0, total: 0, deposit: 0, payable: 0, lines: [] },
    extras: b.extras.map((e) => ({ ...e, unitPrice: 0, amount: 0 })),
    incident: b.incident?.proposal ? { ...b.incident, proposal: { ...b.incident.proposal, refund: 0 } } : b.incident,
  };
}

/** Причина недоплаты содержит суммы: «UNDERPAID: expected X, received Y». */
const reasonWithoutMoney = (reason: string | null) => reason?.split(':')[0] ?? null;

@Injectable()
export class AdminBookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly bookings: BookingsService,
    private readonly documents: DocumentsService,
    @Inject(STORAGE) private readonly storage: Storage,
    private readonly incidents: IncidentsService,
  ) {}

  /** Менеджер видит только брони своей точки, менеджер без точки — ни одной. */
  private scope(user: AdminUser): Prisma.BookingWhereInput {
    return scopeWhere(staffScope(user));
  }

  async rows(where: Prisma.BookingWhereInput, orderBy: Prisma.BookingOrderByWithRelationInput, take: number, skip = 0): Promise<AdminBookingRow[]> {
    const list = await this.prisma.booking.findMany({ where, include: ROW_INCLUDE, orderBy: [orderBy, { id: 'asc' }], take, skip });
    return list.map(toRow);
  }

  async list(user: AdminUser, q: Record<string, unknown>): Promise<AdminBookingList> {
    const statuses = parseStatuses(q.status);
    const from = q.from !== undefined && q.from !== '' ? parseInstant(q.from, 'from') : null;
    const to = q.to !== undefined && q.to !== '' ? parseInstant(q.to, 'to') : null;
    const page = parsePositive(q.page, 'page', 1);
    const pageSize = parsePositive(q.pageSize, 'pageSize', 25, MAX_PAGE_SIZE);
    const text = typeof q.q === 'string' ? q.q.trim().slice(0, 100) : '';
    const where: Prisma.BookingWhereInput = {
      ...(typeof q.locationId === 'string' && q.locationId ? { locationId: q.locationId } : {}),
      ...this.scope(user),
      ...(statuses ? { status: { in: statuses } } : {}),
      ...(from ? { endAt: { gt: from } } : {}),
      ...(to ? { startAt: { lt: to } } : {}),
      ...(text
        ? {
            OR: [
              { code: { contains: text, mode: 'insensitive' } },
              { phone: { contains: text } },
              { user: { OR: [{ firstName: { contains: text, mode: 'insensitive' } }, { lastName: { contains: text, mode: 'insensitive' } }, { username: { contains: text, mode: 'insensitive' } }] } },
            ],
          }
        : {}),
    };
    const [total, items] = await Promise.all([this.prisma.booking.count({ where }), this.rows(where, { startAt: 'desc' }, pageSize, (page - 1) * pageSize)]);
    return { items: canSeeMoney(user.role) ? items : items.map(withoutMoney), total, page, pageSize };
  }

  async detail(user: AdminUser, id: string): Promise<AdminBookingDetail> {
    const b = await this.prisma.booking.findFirst({ where: { id, ...this.scope(user) }, include: DETAIL_INCLUDE });
    if (!b) throw notFound('Booking not found');
    const docs = await this.prisma.document.findMany({ where: { userId: b.userId, deletedAt: null }, orderBy: { createdAt: 'desc' } });
    const incidents = await this.prisma.bookingIncident.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'desc' } });
    const paid = paidTotal(b.payments);
    const admin = canSeeMoney(user.role);
    const booking = toBookingDto(b, paid, null);
    return {
      ...(admin ? toRow(b) : withoutMoney(toRow(b))),
      booking: admin ? booking : bookingWithoutMoney(booking),
      history: b.statusChanges.map((c) => ({ id: c.id, from: c.from, to: c.to, actorName: c.actor ? displayName(c.actor) : null, reason: admin ? c.reason : reasonWithoutMoney(c.reason), at: c.createdAt.toISOString() })),
      payments: admin ? b.payments.map(toPaymentDto) : [],
      documents: docs.map(toDocumentDto),
      acts: b.handoverActs.map((a) => ({
        id: a.id,
        kind: a.kind,
        mileageKm: a.mileageKm,
        fuelLevel: a.fuelLevel,
        damages: a.damages,
        photoCount: a.photos.length,
        managerName: displayName(a.manager),
        clientConfirmedAt: a.clientConfirmedAt ? a.clientConfirmedAt.toISOString() : null,
        createdAt: a.createdAt.toISOString(),
      })),
      // Выдача и завершение — только через акт с фото: иначе нет доказательства состояния байка
      nextStatuses: BOOKING_STATUSES.filter((s) => s !== 'COMPLETED' && (s !== 'ISSUED' || !!b.actualStartAt) && canTransitionBooking(b.status, s, !!b.actualStartAt)),
      incidents: incidents.map((i) => ({ id: i.id, source: i.source, status: i.status, resolution: i.resolution, comment: i.comment, escalated: !!i.escalatedAt, createdAt: i.createdAt.toISOString(), resolvedAt: i.resolvedAt?.toISOString() ?? null })),
    };
  }

  private async assertVisible(user: AdminUser, id: string): Promise<void> {
    if (!(await this.prisma.booking.count({ where: { id, ...this.scope(user) } }))) throw notFound('Booking not found');
  }

  /** PATCH /admin/bookings/{id}: { bikeId?, status?, reason? } — сначала перенос, затем статус. */
  async patch(user: AdminUser, id: string, body: unknown): Promise<AdminBookingDetail> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (b.bikeId === undefined && b.status === undefined) throw badRequest('bikeId or status is required');
    if (b.bikeId !== undefined && (typeof b.bikeId !== 'string' || !b.bikeId)) throw badRequest('bikeId must be a string');
    const status = b.status === undefined ? undefined : parseStatuses(b.status)?.[0];
    if (b.status !== undefined && (!status || Array.isArray(b.status))) throw badRequest('status must be a single status');
    const reason = typeof b.reason === 'string' && b.reason.trim() ? b.reason.trim().slice(0, 500) : undefined;
    await this.assertVisible(user, id);
    const actor: Actor = { id: user.id, role: user.role };

    if (typeof b.bikeId === 'string') await this.moveBike(actor, id, b.bikeId);
    if (status) {
      // Завершение — только через акт приёма (менеджер в Mini App): там считаются опоздание, удержания и возврат депозита
      if (status === 'COMPLETED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', 'Booking is completed through the return act');
      const issued = await this.prisma.booking.findUniqueOrThrow({ where: { id }, select: { actualStartAt: true } });
      if (status === 'ISSUED' && !issued.actualStartAt) throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', 'Booking is issued through the handover act');
      if (status === 'CANCELLED_BY_SYSTEM') await this.bookings.cancel(id, actor, 'ADMIN');
      else if (status === 'CANCELLED_BY_CLIENT') await this.bookings.cancel(id, actor, 'CLIENT');
      else await this.bookings.transition(id, status, actor, reason ? { reason } : {});
    }
    return this.detail(user, id);
  }

  /** Бронь, пересекающаяся с [startAt, blockedUntil) на байке (те же статусы, что держат exclusion constraint). */
  private findOverlap(db: Prisma.TransactionClient | PrismaService, bikeId: string, startAt: Date, blockedUntil: Date, exceptId?: string) {
    return db.booking.findFirst({
      where: { bikeId, status: { in: [...HOLDING] as BookingStatus[] }, startAt: { lt: blockedUntil }, blockedUntil: { gt: startAt }, ...(exceptId ? { id: { not: exceptId } } : {}) },
      select: { id: true, code: true, startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    });
  }

  /** Байк годится для брони модели на период: та же модель, не списан, не в ремонте (или готов к началу), свободен. */
  private async assertBikeFree(db: Prisma.TransactionClient | PrismaService, bikeId: string, modelId: string, startAt: Date, blockedUntil: Date, exceptId?: string): Promise<void> {
    const bike = await db.bike.findUnique({ where: { id: bikeId }, select: { modelId: true, status: true, readyAt: true, plate: true } });
    if (!bike) throw notFound('Bike not found');
    if (bike.modelId !== modelId) conflict({ code: 'BIKE_MODEL_MISMATCH', message: `Bike ${bike.plate} is a different model` });
    const repairing = bike.status === 'REPAIR' && !(bike.readyAt && bike.readyAt.getTime() <= startAt.getTime());
    if (bike.status === 'RETIRED' || repairing) conflict({ code: 'BIKE_UNAVAILABLE', message: `Bike ${bike.plate} is ${bike.status === 'RETIRED' ? 'retired' : 'in repair'}` });
    const hit = await this.findOverlap(db, bikeId, startAt, blockedUntil, exceptId);
    if (hit) {
      conflict({
        code: 'BIKE_TAKEN',
        message: `Bike ${bike.plate} is booked by ${hit.code} (including buffer)`,
        conflict: { bookingId: hit.id, code: hit.code, startAt: hit.startAt.toISOString(), endAt: hit.endAt.toISOString() },
      });
    }
  }

  /** Перенос брони на другой байк той же модели. Конфликт → 409 с причиной; гонку ловит exclusion constraint. */
  async moveBike(actor: Actor, id: string, bikeId: string): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM bookings WHERE id = ${id} FOR UPDATE`;
        const b = await tx.booking.findUnique({ where: { id }, select: { id: true, bikeId: true, modelId: true, status: true, startAt: true, endAt: true, blockedUntil: true, bufferMinutes: true } });
        if (!b) throw notFound('Booking not found');
        if (!HOLDING.has(b.status)) conflict({ code: 'BOOKING_CLOSED', message: `Booking in status ${b.status} cannot be moved` });
        if (b.bikeId === bikeId) return;
        const blockedUntil = b.blockedUntil ?? new Date(b.endAt.getTime() + b.bufferMinutes * 60_000);
        await this.assertBikeFree(tx, bikeId, b.modelId, b.startAt, blockedUntil, b.id);
        await tx.booking.update({ where: { id }, data: { bikeId } });
        await writeAudit(tx, actor, 'booking.bike', 'Booking', id, { from: b.bikeId, to: bikeId });
      });
    } catch (e) {
      if (isExclusionViolation(e)) conflict({ code: 'BIKE_TAKEN', message: 'Bike is booked for this period' });
      throw e;
    }
  }

  /** POST /admin/bookings — ручная бронь «с улицы»: те же правила и резерв, что POST /bookings (BookingsService.create). */
  async createManual(user: AdminUser, body: unknown): Promise<AdminBookingDetail> {
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (typeof b.modelId !== 'string' || !b.modelId) throw badRequest('modelId is required');
    // Клиент «с улицы» не входит в приложение и QR оплатить не сможет: деньги принимает менеджер
    if (b.paymentMethod !== 'CASH') throw badRequest('paymentMethod must be CASH');
    if (typeof b.phone !== 'string' || !E164.test(b.phone)) throw badRequest('phone must be E.164');
    if (b.bikeId !== undefined && (typeof b.bikeId !== 'string' || !b.bikeId)) throw badRequest('bikeId must be a string');
    const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : '';
    const lang = b.lang === 'ru' || b.lang === 'vi' || b.lang === 'en' ? b.lang : 'en';
    const startAt = parseInstant(b.startAt, 'startAt');
    const endAt = parseInstant(b.endAt, 'endAt');
    const extras = Array.isArray(b.extras) ? b.extras.map((x) => ({ id: String((x as { id?: unknown }).id ?? ''), qty: Number((x as { qty?: unknown }).qty ?? 0) })) : [];

    const model = await this.prisma.bikeModel.findFirst({ where: { id: b.modelId, isActive: true }, select: { id: true, locationId: true } });
    if (!model || !inScope(staffScope(user), model.locationId)) throw notFound('Model not found');
    const actor: Actor = { id: user.id, role: user.role };
    const bikeId = typeof b.bikeId === 'string' ? b.bikeId : null;
    if (bikeId && endAt.getTime() > startAt.getTime()) {
      const { bufferMinutes } = await loadBookingRules(this.prisma);
      await this.assertBikeFree(this.prisma, bikeId, model.id, startAt, new Date(endAt.getTime() + bufferMinutes * 60_000));
    }

    const phone = b.phone;
    const telegramId = `${WALK_IN_PREFIX}${phone}`;
    const client = await this.prisma.user.upsert({
      where: { telegramId },
      create: { telegramId, firstName: name || null, phone, lang, currency: 'VND', pdConsentAt: new Date() },
      update: name ? { firstName: name, lastName: null } : {},
    });
    const created = await this.bookings.create(client.id, lang, {
      modelId: model.id,
      startAt,
      endAt,
      extras,
      paymentMethod: b.paymentMethod as PaymentMethod,
      phone,
      agreed: true,
      delivery: false,
      deliveryAddress: null,
      source: 'admin',
      staffWalkIn: true,
    });
    if (bikeId && created.bikeId !== bikeId) {
      try {
        await this.moveBike(actor, created.id, bikeId);
      } catch (e) {
        // Байк заняли между проверкой и созданием: бронь не остаётся на другом байке молча
        await this.bookings.cancel(created.id, actor, 'ADMIN').catch(() => undefined);
        throw e;
      }
    }
    await writeAudit(this.prisma, actor, 'booking.manual', 'Booking', created.id, { clientId: client.id, phone, bikeId: bikeId ?? created.bikeId, startAt: startAt.toISOString(), endAt: endAt.toISOString() });
    return this.detail(user, created.id);
  }

  /** Временная ссылка на документ клиента брони (≤ 600 с, выдача пишется в журнал DocumentsService). */
  async documentUrl(user: AdminUser, id: string, documentId: string): Promise<DocumentUrlResponse> {
    const b = await this.prisma.booking.findFirst({ where: { id, ...this.scope(user) }, select: { userId: true } });
    if (!b) throw notFound('Booking not found');
    if (!(await this.prisma.document.count({ where: { id: documentId, userId: b.userId, deletedAt: null } }))) throw notFound('Document not found');
    return this.documents.signedUrl({ id: user.id, role: user.role }, documentId);
  }

  /** Временные ссылки на фото акта выдачи/возврата. */
  /** Открытый случай «байка нет»: сотрудник решает его и из админки. */
  async dismissIncident(user: AdminUser, id: string): Promise<AdminBookingDetail> {
    await this.assertVisible(user, id);
    await this.incidents.dismiss({ id: user.id, role: user.role }, id);
    return this.detail(user, id);
  }

  async cancelIncident(user: AdminUser, id: string): Promise<AdminBookingDetail> {
    await this.assertVisible(user, id);
    await this.incidents.cancelByStaff({ id: user.id, role: user.role }, id);
    return this.detail(user, id);
  }

  /** Архив фотоактов: брони с актами, до и после аренды рядом. Поиск по коду брони и номеру байка. */
  async actArchive(user: AdminUser, q: Record<string, unknown>): Promise<AdminActArchive> {
    const page = Math.max(1, Number(q.page) || 1);
    const text = typeof q.q === 'string' ? q.q.trim().slice(0, 40) : '';
    const where: Prisma.BookingWhereInput = {
      ...this.scope(user),
      handoverActs: { some: {} },
      ...(text ? { OR: [{ code: { contains: text, mode: 'insensitive' } }, { bike: { plate: { contains: text, mode: 'insensitive' } } }] } : {}),
    };
    const [total, rows] = await Promise.all([
      this.prisma.booking.count({ where }),
      this.prisma.booking.findMany({
        where,
        orderBy: [{ startAt: 'desc' }, { id: 'asc' }],
        take: ARCHIVE_PAGE,
        skip: (page - 1) * ARCHIVE_PAGE,
        include: {
          model: { select: { name: true } },
          bike: { select: { plate: true } },
          user: { select: { firstName: true, lastName: true, username: true, telegramId: true } },
          handoverActs: { include: { manager: { select: { firstName: true, lastName: true, username: true, telegramId: true } } } },
        },
      }),
    ]);
    const act = (a: (typeof rows)[number]['handoverActs'][number] | undefined): AdminHandoverAct | null =>
      a
        ? { id: a.id, kind: a.kind, mileageKm: a.mileageKm, fuelLevel: a.fuelLevel, damages: a.damages, photoCount: a.photos.length, managerName: displayName(a.manager), clientConfirmedAt: a.clientConfirmedAt?.toISOString() ?? null, createdAt: a.createdAt.toISOString() }
        : null;
    return {
      items: rows.map((b) => ({
        bookingId: b.id,
        code: b.code,
        status: b.status,
        plate: b.bike.plate,
        modelName: b.model.name,
        clientName: displayName(b.user),
        startAt: b.startAt.toISOString(),
        endAt: b.endAt.toISOString(),
        before: act(b.handoverActs.find((a) => a.kind === 'ISSUE')),
        after: act(b.handoverActs.find((a) => a.kind === 'RETURN')),
      })),
      total,
      page,
      pageSize: ARCHIVE_PAGE,
    };
  }

  async actPhotos(user: AdminUser, id: string, actId: string): Promise<AdminActPhotos> {
    await this.assertVisible(user, id);
    const act = await this.prisma.handoverAct.findFirst({ where: { id: actId, bookingId: id }, select: { photos: true } });
    if (!act) throw notFound('Act not found');
    const photos = await Promise.all(act.photos.map((key) => this.storage.presignGet(key, PHOTO_TTL_SEC)));
    await writeAudit(this.prisma, { id: user.id, role: user.role }, 'act.photos.read', 'HandoverAct', actId, { bookingId: id });
    return { photos: photos.map((p) => ({ url: p.url, expiresAt: p.expiresAt.toISOString() })) };
  }
}
