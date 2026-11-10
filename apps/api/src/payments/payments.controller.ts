import { Body, Controller, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import type { Booking, PayBookingResponse, WebhookAck } from '@rental/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { badRequest, forbidden } from '../auth/api-errors';
import { apiError } from '../bookings/errors';
import { RateLimiter } from '../bookings/rate-limit';
import { BookingsService } from '../bookings/bookings.service';
import { toBookingDto } from '../bookings/booking.mapper';
import { paidTotal } from '../bookings/refund';
import { PaymentsService } from './payments.service';
import { webhookIpAllowed } from './webhook-ip';

const testerIds = () => (process.env.TEST_PAY_TELEGRAM_IDS ?? '').split(',').map((v) => v.trim()).filter(Boolean);

@Controller()
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly bookings: BookingsService,
    private readonly limiter: RateLimiter,
  ) {}

  /** POST /bookings/{id}/pay → QR · 409 HOLD_EXPIRED / PAYMENT_NOT_AVAILABLE · 429 RATE_LIMITED */
  @Post('bookings/:id/pay')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  pay(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PayBookingResponse> {
    this.limiter.hit('payment', user.id);
    return this.payments.pay(user.id, id);
  }

  /** POST /bookings/{id}/pay/claim — «Я перевёл» для перевода в рублях. */
  @Post('bookings/:id/pay/claim')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  claim(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<PayBookingResponse> {
    this.limiter.hit('payment', user.id);
    return this.payments.claimRub(user.id, id);
  }

  /** Webhook payOS: IP из PAYOS_WEBHOOK_IPS (если задан), подпись — иначе 400 INVALID_SIGNATURE. Повтор — без второй оплаты. */
  @Post('webhooks/payos')
  @HttpCode(200)
  async webhook(@Req() req: Request, @Body() body: unknown): Promise<WebhookAck> {
    if (!webhookIpAllowed(req.ip ?? req.socket.remoteAddress)) throw forbidden('Webhook IP is not allowed');
    await this.payments.handleWebhook({ body, headers: req.headers });
    return { success: true };
  }

  /** Webhook счёта точки: подпись проверяется её ключом, принимаются только платежи, созданные на этом счёте. */
  @Post('webhooks/payos/:locationId')
  @HttpCode(200)
  async locationWebhook(@Req() req: Request, @Param('locationId') locationId: string, @Body() body: unknown): Promise<WebhookAck> {
    if (!webhookIpAllowed(req.ip ?? req.socket.remoteAddress)) throw forbidden('Webhook IP is not allowed');
    await this.payments.handleLocationWebhook(locationId, { body, headers: req.headers });
    return { success: true };
  }

  /** dev (тестовый провайдер): «Оплатить (тест)». В production и с payOS — 404. */
  @Post('dev/payments/:id/pay')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  async devPay(@CurrentUser() user: AuthUser, @Param('id') id: string, @Body() body: unknown): Promise<Booking> {
    const amount = (body as { amount?: unknown } | null)?.amount;
    if (amount !== undefined && (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 0)) throw badRequest('amount must be a non-negative integer');
    const restricted = process.env.RESTRICT_TEST_PAYMENTS === '1';
    if (restricted && user.role === 'CLIENT' && !testerIds().includes(user.telegramId)) throw apiError(HttpStatus.FORBIDDEN, 'TEST_PAYMENT_RESTRICTED', 'Test payments are for staff and listed testers');
    // Сумма вручную — для проверки недоплаты в разработке: в открытом запуске запись любой суммы испортила бы возвраты
    const { bookingId } = await this.payments.devPay(user.id, id, restricted ? undefined : (amount as number | undefined));
    const b = await this.bookings.getOwn(user.id, bookingId);
    return toBookingDto(b, paidTotal(b.payments), await this.bookings.cancelPreview(b));
  }
}
