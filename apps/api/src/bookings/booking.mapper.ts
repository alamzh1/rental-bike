import type { Bike, Booking as BookingRow, BookingExtra, BookingIncident, BikeModel, Location, Payment } from '@prisma/client';
import { INCIDENT_CLIENT_CANCEL_MINUTES, type Booking, type BookingIncidentDto, type CancelPreview, type Quote } from '@rental/shared';

export type BookingWithRelations = BookingRow & {
  model: Pick<BikeModel, 'name'>;
  location: Pick<Location, 'id' | 'address' | 'lat' | 'lng' | 'timezone' | 'contact'>;
  extras: BookingExtra[];
  payments: Payment[];
  incidents?: (BookingIncident & { proposedBike: (Pick<Bike, 'plate'> & { model: Pick<BikeModel, 'name'> }) | null })[];
};

export const BOOKING_INCLUDE = {
  model: { select: { name: true } },
  location: { select: { id: true, address: true, lat: true, lng: true, timezone: true, contact: true } },
  extras: true,
  payments: { orderBy: { createdAt: 'asc' } },
  incidents: { where: { status: 'OPEN' }, take: 1, include: { proposedBike: { select: { plate: true, model: { select: { name: true } } } } } },
} as const;

/** Снимок расчёта в Booking.quote: Quote + сумма к оплате онлайн на момент создания. */
export type QuoteSnapshot = Quote & { onlinePayable?: number };

export function onlinePayable(b: Pick<BookingRow, 'quote' | 'totalAmount' | 'depositAmount' | 'paymentMethod'>): number {
  const snap = b.quote as unknown as QuoteSnapshot | null;
  if (snap && typeof snap.onlinePayable === 'number') return snap.onlinePayable;
  return b.paymentMethod === 'CASH' ? 0 : b.totalAmount + b.depositAmount;
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** Что о случае знает клиент: случай, открытый сотрудниками, виден ему только с предложением замены. */
function incidentDto(b: BookingWithRelations): BookingIncidentDto | null {
  const i = b.incidents?.[0];
  if (!i || (!i.clientReportedAt && !i.proposedAt)) return null;
  const free = i.proposedAt ?? (i.disputed ? null : new Date(i.clientReportedAt!.getTime() + INCIDENT_CLIENT_CANCEL_MINUTES * 60_000));
  return {
    id: i.id,
    proposal: i.proposedBike && i.proposedRent !== null ? { modelName: i.proposedBike.model.name, plate: i.proposedBike.plate, refund: Math.max(0, b.rentAmount - i.proposedRent) } : null,
    cancelFreeAt: free?.toISOString() ?? null,
    disputed: i.disputed && !i.proposedAt,
  };
}

export function toBookingDto(b: BookingWithRelations, paidAmount: number, cancelPreview: CancelPreview | null): Booking {
  const { onlinePayable: _omit, ...quote } = (b.quote ?? {}) as unknown as QuoteSnapshot;
  return {
    id: b.id,
    code: b.code,
    status: b.status,
    cancelReason: b.cancelReason,
    modelId: b.modelId,
    modelName: b.model.name,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    holdExpiresAt: b.status === 'PENDING_PAYMENT' && b.holdExpiresAt ? b.holdExpiresAt.toISOString() : null,
    paymentMethod: b.paymentMethod,
    deliveryMethod: b.deliveryMethod,
    deliveryAddress: b.deliveryAddress,
    phone: b.phone,
    rentAmount: b.rentAmount,
    extrasAmount: b.extrasAmount,
    deliveryAmount: b.deliveryAmount,
    depositAmount: b.depositAmount,
    totalAmount: b.totalAmount,
    payable: onlinePayable(b),
    paidAmount,
    refundAmount: b.refundAmount,
    lateFeeAmount: b.lateFeeAmount,
    quote: quote as Quote,
    extras: b.extras.map((e) => ({ extraId: e.extraId, qty: e.qty, unitPrice: e.unitPrice, per: e.per, amount: e.amount })),
    location: { id: b.location.id, address: b.location.address, lat: b.location.lat, lng: b.location.lng, timezone: b.location.timezone, contact: b.location.contact, mapsUrl: mapsUrl(b.location.lat, b.location.lng) },
    cancelPreview,
    createdAt: b.createdAt.toISOString(),
    cancelledAt: b.cancelledAt ? b.cancelledAt.toISOString() : null,
    contractAcceptedAt: b.contractAcceptedAt ? b.contractAcceptedAt.toISOString() : null,
    incident: incidentDto(b),
  };
}
