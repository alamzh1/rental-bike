import { Body, Controller, Get, Header, HttpCode, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import type { Booking, BookingListResponse, CancelBookingResponse, PaymentMethod, QuoteExtraRequest } from '@rental/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { badRequest } from '../auth/api-errors';
import { parseInstant } from '../catalog/query';
import { IncidentsService } from './incidents.service';
import { BookingsService } from './bookings.service';
import { RateLimiter } from './rate-limit';
import { toBookingDto, type BookingWithRelations } from './booking.mapper';
import { paidTotal } from './refund';
import { bookingIcs } from './ics';

const METHODS: PaymentMethod[] = ['VIETQR', 'CASH', 'RUB_TRANSFER'];

function parseExtras(raw: unknown): QuoteExtraRequest[] {
  const list = raw ?? [];
  if (!Array.isArray(list) || list.length > 20) throw badRequest('extras must be an array');
  return list.map((e: unknown) => {
    const x = (e && typeof e === 'object' ? e : {}) as Record<string, unknown>;
    if (typeof x.id !== 'string' || typeof x.qty !== 'number') throw badRequest('extras: { id, qty }[]');
    return { id: x.id, qty: x.qty };
  });
}

const optString = (v: unknown, name: string, max = 500): string | null => {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' || v.length > max) throw badRequest(`${name} must be a string`);
  return v.trim();
};

/** Брони клиента Mini App. Доступ только к своим: чужой ID → 404. */
@Controller('bookings')
@UseGuards(JwtAuthGuard)
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly incidents: IncidentsService,
    private readonly limiter: RateLimiter,
  ) {}

  async dto(b: BookingWithRelations): Promise<Booking> {
    return toBookingDto(b, paidTotal(b.payments), await this.bookings.cancelPreview(b));
  }

  /** POST /bookings → Booking (PENDING_PAYMENT с удержанием или CONFIRMED для наличных) · 409 BIKE_TAKEN · 429 RATE_LIMITED */
  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<Booking> {
    this.limiter.hit('booking', user.id);
    const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
    if (typeof b.modelId !== 'string' || !b.modelId) throw badRequest('modelId is required');
    if (!METHODS.includes(b.paymentMethod as PaymentMethod)) throw badRequest('paymentMethod must be VIETQR, CASH or RUB_TRANSFER');
    if (b.delivery !== undefined && typeof b.delivery !== 'boolean') throw badRequest('delivery must be boolean');
    const booking = await this.bookings.create(user.id, user.lang, {
      modelId: b.modelId,
      startAt: parseInstant(b.startAt, 'startAt'),
      endAt: parseInstant(b.endAt, 'endAt'),
      extras: parseExtras(b.extras),
      paymentMethod: b.paymentMethod as PaymentMethod,
      phone: optString(b.phone, 'phone', 20),
      agreed: b.agreed === true,
      delivery: b.delivery === true,
      deliveryAddress: optString(b.deliveryAddress, 'deliveryAddress'),
      source: optString(b.source, 'source', 200),
    });
    return this.dto(booking);
  }

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<BookingListResponse> {
    const rows = await this.bookings.listOwn(user.id);
    const rules = await this.bookings.rules();
    return { items: await Promise.all(rows.map(async (b) => toBookingDto(b, paidTotal(b.payments), await this.bookings.cancelPreview(b, rules)))) };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Booking> {
    return this.dto(await this.bookings.getOwn(user.id, id));
  }

  /** POST /bookings/{id}/cancel → { refundAmount, refundPercent, booking } · 409 INVALID_TRANSITION */
  @Post(':id/cancel')
  @HttpCode(200)
  async cancel(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<CancelBookingResponse> {
    const r = await this.bookings.cancelOwn(user.id, id);
    return { ...r, booking: await this.dto(await this.bookings.load(id)) };
  }

  @Post(':id/problem')
  @HttpCode(200)
  async problem(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<Booking> {
    const comment = optString((body as Record<string, unknown> | null)?.comment, 'comment', 1000);
    return this.dto(await this.bookings.reportProblem(user.id, id, comment));
  }

  /** Клиент на точке, а байка нет. `{ comment? }` */
  @Post(':id/bike-missing')
  @HttpCode(200)
  async bikeMissing(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<Booking> {
    const comment = optString((body as Record<string, unknown> | null)?.comment, 'comment', 1000);
    await this.incidents.reportByClient(user.id, id, comment);
    return this.dto(await this.bookings.load(id));
  }

  /** Клиент согласен на предложенную замену. */
  @Post(':id/bike-missing/accept')
  @HttpCode(200)
  async acceptReplacement(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Booking> {
    await this.incidents.acceptByClient(user.id, id);
    return this.dto(await this.bookings.load(id));
  }

  /** Отмена с полным возвратом: замена не подошла или точка не ответила вовремя. */
  @Post(':id/bike-missing/cancel')
  @HttpCode(200)
  async cancelMissing(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<Booking> {
    await this.incidents.cancelByClient(user.id, id);
    return this.dto(await this.bookings.load(id));
  }

  @Get(':id/calendar.ics')
  @Header('Content-Type', 'text/calendar; charset=utf-8')
  async calendar(@CurrentUser() user: AuthUser, @Param('id') id: string, @Res() res: Response): Promise<void> {
    const b = await this.bookings.getOwn(user.id, id);
    res.setHeader('Content-Disposition', `attachment; filename="${b.code}.ics"`);
    res.send(
      bookingIcs({ id: b.id, code: b.code, modelName: b.model.name, startAt: b.startAt, endAt: b.endAt, address: b.location.address, lat: b.location.lat, lng: b.location.lng }),
    );
  }
}
