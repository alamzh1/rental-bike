import { HttpStatus, Controller, Get, HttpCode, Inject, Param, Post, UseGuards } from '@nestjs/common';
import type { Booking, ClientHandoverResponse } from '@rental/shared';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthUser } from '../auth/auth.types';
import { notFound } from '../auth/api-errors';
import { PrismaService } from '../prisma/prisma.service';
import { Clock } from '../jobs/clock';
import { BookingsService, toBookingDto, paidTotal } from '../bookings';
import { apiError } from '../bookings/errors';
import { STORAGE, type Storage } from '../documents';

/**
 * Акты выдачи и возврата для клиента-владельца брони (чужая бронь → 404).
 * Подтверждение акта выдачи переводит бронь «Подтверждена» → «Выдана».
 */
@Controller('bookings/:id/handover')
@UseGuards(JwtAuthGuard)
export class HandoverClientController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly bookings: BookingsService,
    @Inject(STORAGE) private readonly storage: Storage,
  ) {}

  private async urls(keys: string[]): Promise<string[]> {
    return Promise.all(keys.map(async (k) => (await this.storage.presignGet(k)).url));
  }

  /** GET /bookings/{id}/handover → акты, удержания (с фото) и депозит к возврату. */
  @Get()
  async list(@CurrentUser() user: AuthUser, @Param('id') id: string): Promise<ClientHandoverResponse> {
    const b = await this.prisma.booking.findFirst({ where: { id, userId: user.id }, include: { handoverActs: { include: { bike: { select: { plate: true } } }, orderBy: { createdAt: 'asc' } }, deductions: { orderBy: { createdAt: 'asc' } } } });
    if (!b) throw notFound('Booking not found');
    const acts = await Promise.all(
      b.handoverActs.map(async (a) => ({
        id: a.id,
        kind: a.kind,
        plate: a.bike.plate,
        mileageKm: a.mileageKm,
        fuelLevel: a.fuelLevel,
        damages: a.damages,
        photoUrls: await this.urls(a.photos),
        confirmedAt: a.clientConfirmedAt ? a.clientConfirmedAt.toISOString() : null,
      })),
    );
    const deductions = await Promise.all(b.deductions.map(async (d) => ({ id: d.id, amount: d.amount, reason: d.reason, photoUrls: await this.urls(d.photos) })));
    return { acts, deductions, depositRefund: b.status === 'COMPLETED' ? (b.refundAmount ?? 0) : null };
  }

  /** POST /bookings/{id}/handover/{actId}/confirm — клиент подтверждает акт; акт выдачи → бронь «Выдана». Повтор безвреден. */
  @Post(':actId/confirm')
  @HttpCode(200)
  async confirm(@CurrentUser() user: AuthUser, @Param('id') id: string, @Param('actId') actId: string): Promise<Booking> {
    const own = await this.prisma.booking.findFirst({ where: { id, userId: user.id }, select: { id: true } });
    const act = own ? await this.prisma.handoverAct.findFirst({ where: { id: actId, bookingId: id } }) : null;
    if (!own || !act) throw notFound('Handover act not found');
    const now = this.clock.now();
    const actor = { id: user.id, role: user.role } as const;
    const after = await this.prisma.$transaction(async (tx) => {
      const locked = await this.bookings.lockBooking(tx, id);
      if (!locked) throw notFound('Booking not found');
      const fresh = await tx.handoverAct.findUniqueOrThrow({ where: { id: actId } });
      if (fresh.clientConfirmedAt) return null;
      let done: (() => Promise<void>) | null = null;
      if (fresh.kind === 'ISSUE') {
        if (locked.status !== 'CONFIRMED') throw apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Booking is ${locked.status}`);
        done = await this.bookings.transitionInTx(tx, id, 'ISSUED', actor, { reason: 'handover confirmed', data: { actualStartAt: now } }, locked);
      }
      await tx.handoverAct.update({ where: { id: actId }, data: { clientConfirmedAt: now } });
      return done;
    });
    if (after) await after();
    const b = await this.bookings.load(id);
    return toBookingDto(b, paidTotal(b.payments), await this.bookings.cancelPreview(b));
  }
}
