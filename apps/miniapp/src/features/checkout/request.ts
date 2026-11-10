import type { CreateBookingRequest, PaymentMethod } from '@rental/shared';
import { parsePhone } from './phone';

export type BlockedReason = 'license' | 'documents' | 'consent' | 'phone' | 'address' | null;

export interface CheckoutState {
  modelId: string;
  range: { from: string; to: string };
  /** extraId → количество */
  extras: Record<string, number>;
  method: PaymentMethod;
  phone: string;
  agreed: boolean;
  delivery: boolean;
  address: string;
  pin?: { lat: number; lng: number };
}

/** Почему кнопка оплаты неактивна (показывается текстом под формой); null — можно платить. */
export function blockedReason(s: Pick<CheckoutState, 'agreed' | 'phone' | 'delivery' | 'address'> & { documentsReady: boolean; licenseOk: boolean }): BlockedReason {
  if (!s.licenseOk) return 'license';
  if (!s.documentsReady) return 'documents';
  if (!s.agreed) return 'consent';
  if (!parsePhone(s.phone).ok) return 'phone';
  if (s.delivery && !s.address.trim()) return 'address';
  return null;
}

/** Адрес доставки с координатами пина: менеджер видит и текст, и точку. */
export function deliveryAddress(address: string, pin?: { lat: number; lng: number }): string {
  const text = address.trim();
  return pin ? `${text} [${pin.lat.toFixed(5)}, ${pin.lng.toFixed(5)}]` : text;
}

export function buildBookingRequest(s: CheckoutState): CreateBookingRequest {
  const phone = parsePhone(s.phone);
  return {
    modelId: s.modelId,
    startAt: s.range.from,
    endAt: s.range.to,
    extras: Object.entries(s.extras)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ id, qty })),
    paymentMethod: s.method,
    ...(phone.ok ? { phone: phone.e164 } : {}),
    agreed: s.agreed,
    delivery: s.delivery,
    ...(s.delivery ? { deliveryAddress: deliveryAddress(s.address, s.pin) } : {}),
  };
}
