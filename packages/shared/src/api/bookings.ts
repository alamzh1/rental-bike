// Типы API модуля `bookings`: создание брони с удержанием, список, карточка, отмена с возвратом, «Сообщить о проблеме».
import type { BookingStatus, PaymentMethod } from '../types.js';
import type { Quote } from '../pricing.js';
import type { QuoteExtraRequest } from './pricing.js';

/** Причина отмены: клиент, не оплачено вовремя (удержание 15 мин), неявка (noShowHours), администратор. */
export type CancelReason = 'CLIENT' | 'NOT_PAID' | 'NO_SHOW' | 'ADMIN' | 'BIKE_MISSING';
export type DeliveryMethod = 'PICKUP' | 'DELIVERY';

/**
 * Машинные коды ошибок брони (`ApiError.code`), текст — errors.<code> в packages/i18n.
 * 409 BIKE_TAKEN — свободного байка модели нет; 409 INVALID_TRANSITION — недопустимый переход статуса;
 * 400 MIN_RENT_DAYS / LEAD_TIME / AGREEMENT_REQUIRED / PHONE_REQUIRED; 409 HOLD_EXPIRED — удержание истекло;
 * 429 RATE_LIMITED — больше 10 созданий брони или платежа в минуту.
 */
export const BOOKING_ERROR_CODES = [
  'BIKE_TAKEN',
  'INVALID_TRANSITION',
  'MIN_RENT_DAYS',
  'LEAD_TIME',
  'AGREEMENT_REQUIRED',
  'PHONE_REQUIRED',
  'HOLD_EXPIRED',
  'INCIDENT_NOT_AVAILABLE',
  'INCIDENT_NOT_OPEN',
  'TOO_MANY_BOOKINGS',
  'DOCUMENTS_REQUIRED',
  'LICENSE_REQUIRED',
  'INCIDENT_WAIT',
  'INCIDENT_OPEN',
  'BIKE_MISSING_TOO_EARLY',
  'BIKE_MISSING_CLOSED',
  'REPLACEMENT_UNAVAILABLE',
  'RATE_LIMITED',
] as const;
export type BookingErrorCode = (typeof BOOKING_ERROR_CODES)[number];

/** POST /bookings. Даты — ISO UTC. `phone` — E.164; без него берётся телефон профиля. `agreed` — согласие с правилами. */
export interface CreateBookingRequest {
  modelId: string;
  startAt: string;
  endAt: string;
  extras?: QuoteExtraRequest[];
  paymentMethod: PaymentMethod;
  phone?: string;
  agreed: boolean;
  delivery?: boolean;
  deliveryAddress?: string;
  /** deeplink / реклама для воронки */
  source?: string;
}

export interface BookingExtraLine {
  extraId: string;
  qty: number;
  unitPrice: number;
  per: 'DAY' | 'ONCE';
  amount: number;
}

export interface BookingLocation {
  id: string;
  address: string;
  lat: number;
  lng: number;
  timezone: string;
  /** Контакт этой точки; null — общий из настроек */
  contact: string | null;
  /** Ссылка Google Maps на адрес точки («Открыть в Картах») */
  mapsUrl: string;
}

/** Сумма возврата, если отменить сейчас (показывается до подтверждения отмены). null — отмена клиентом недоступна. */
export interface CancelPreview {
  refundPercent: number;
  refundAmount: number;
}

/** Бронь клиента. Деньги — VND; `payable` — к оплате онлайн сейчас (VietQR: аренда + депозит; наличные: предоплата или 0). */
export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  cancelReason: CancelReason | null;
  modelId: string;
  modelName: string;
  startAt: string;
  endAt: string;
  /** Конец удержания для «Ожидает оплаты» (таймер 15 мин) */
  holdExpiresAt: string | null;
  paymentMethod: PaymentMethod;
  deliveryMethod: DeliveryMethod;
  deliveryAddress: string | null;
  phone: string | null;
  rentAmount: number;
  extrasAmount: number;
  deliveryAmount: number;
  depositAmount: number;
  totalAmount: number;
  payable: number;
  paidAmount: number;
  refundAmount: number | null;
  lateFeeAmount: number;
  quote: Quote;
  extras: BookingExtraLine[];
  location: BookingLocation;
  cancelPreview: CancelPreview | null;
  createdAt: string;
  cancelledAt: string | null;
  /** Когда клиент подтвердил договор аренды в приложении; null — ещё не подтверждал. */
  contractAcceptedAt: string | null;
  /** Открытый случай «байка нет на месте», о котором клиент знает; null — такого нет */
  incident: BookingIncidentDto | null;
}

/** Неоплаченных броней у клиента одновременно: каждая держит байк, пока идёт удержание. */
export const MAX_UNPAID_BOOKINGS = 3;
/** Всего действующих броней, до выдачи байка: семья или компания укладываются, а весь парк один аккаунт не займёт. */
export const MAX_ACTIVE_BOOKINGS = 5;

/** Клиент может сообщить, что байка нет, не раньше чем за столько часов до выдачи. */
export const INCIDENT_REPORT_BEFORE_START_HOURS = 2;
/** Сколько точка может отвечать, прежде чем сообщение уйдёт администратору, а клиент сможет отменить сам. */
export const INCIDENT_CLIENT_CANCEL_MINUTES = 15;

export interface BookingIncidentDto {
  id: string;
  /** Предложенная замена; null — точка ещё ищет */
  proposal: { modelName: string; plate: string; refund: number } | null;
  /** С этого момента клиент может отменить с полным возвратом сам; null — решает администратор */
  cancelFreeAt: string | null;
  /** Точка ответила «байк на месте», клиент настаивает: случай разбирает администратор */
  disputed: boolean;
}

/** Свободный байк другой модели этой точки для замены. */
export interface IncidentReplacement {
  bikeId: string;
  plate: string;
  modelName: string;
  /** Цена аренды этой модели за период брони */
  rentAmount: number;
  /** Сколько вернём клиенту, если замена дешевле. Дороже — без доплаты */
  refund: number;
}

export interface BookingListResponse {
  items: Booking[];
}

/** POST /bookings/{id}/cancel → сумма возврата по правилам отмены (cancel = { fullHours, halfHours, halfPercent }). */
export interface CancelBookingResponse {
  refundAmount: number;
  refundPercent: number;
  booking: Booking;
}

/** POST /bookings/{id}/problem */
export interface ReportProblemRequest {
  comment?: string;
}

/** POST /bookings/{id}/contract/accept */
export interface AcceptContractResponse {
  contractAcceptedAt: string;
}

/** POST /bookings/{id}/file-link — временная ссылка на договор или календарь (Telegram открывает файлы только по адресу). */
export interface BookingFileLinkResponse {
  url: string;
}
