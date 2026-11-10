import { HttpException, HttpStatus } from '@nestjs/common';

// Ошибки API { code, message } с машинным кодом (errors.<code> в packages/i18n).
export const apiError = (status: HttpStatus, code: string, message: string) => new HttpException({ code, message }, status);

export const bikeTaken = () => apiError(HttpStatus.CONFLICT, 'BIKE_TAKEN', 'No free bike of this model for the period');
export const invalidTransition = (from: string, to: string) => apiError(HttpStatus.CONFLICT, 'INVALID_TRANSITION', `Transition ${from} → ${to} is not allowed`);
export const rateLimited = () => apiError(HttpStatus.TOO_MANY_REQUESTS, 'RATE_LIMITED', 'Too many requests, try again in a minute');

/** Байк у клиента нельзя отправить в ремонт или списать; списать нельзя и с предстоящей бронью: сначала её перенесите. */
export async function assertBikeCanStop(prisma: { booking: { count(args: { where: Record<string, unknown> }): Promise<number> } }, bikeId: string, to: 'REPAIR' | 'RETIRED'): Promise<void> {
  const statuses = to === 'RETIRED' ? ['PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM'] : ['ISSUED'];
  if (await prisma.booking.count({ where: { bikeId, status: { in: statuses } } })) throw apiError(HttpStatus.CONFLICT, 'BIKE_HAS_ACTIVE_BOOKING', 'Bike has an active booking');
}
