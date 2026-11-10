// Типы API модуля `manager`: режим менеджера (выдача, возврат, фотоакт, наличные, ремонт). Доступ — MANAGER/ADMIN.
import type { BookingStatus, PaymentMethod } from '../types.js';
import type { DocumentDto } from './documents.js';

/** Фото фотоакта: от 4 до 8 штук в приватном бакете. */
import type { IncidentReplacement } from './bookings.js';

export const HANDOVER_PHOTOS_MIN = 4;
export const HANDOVER_PHOTOS_MAX = 8;
/** Фото одного удержания из депозита. */
export const DEDUCTION_PHOTOS_MAX = 4;

/** Коды ошибок режима менеджера (errors.<code> в packages/i18n). */
export const MANAGER_ERROR_CODES = [
  'PHOTOS_COUNT', // 400: фото акта не 4–8
  'PHOTO_NOT_UPLOADED', // 400: файла фото нет в хранилище
  'WRONG_LOCATION', // 403: бронь другой точки
  'BIKE_HAS_ACTIVE_BOOKING', // 409: байк у клиента
  'CASH_EXCEEDS_DUE', // 409: наличных больше, чем осталось получить
  'BIKE_NOT_AVAILABLE', // 409: байк занят, в ремонте или другой модели
  'ACT_EXISTS', // 409: акт этого типа уже создан
  'DEDUCTION_TOO_LARGE', // 400: удержания больше депозита
  'MILEAGE_LOWER', // 400: пробег меньше, чем при выдаче
] as const;
export type ManagerErrorCode = (typeof MANAGER_ERROR_CODES)[number];

export type HandoverKind = 'ISSUE' | 'RETURN';
export type CashPaymentKind = 'RENT' | 'DEPOSIT' | 'PREPAYMENT' | 'SURCHARGE';

/** Строка списка «выдачи и возвраты на сегодня». */
export interface ManagerBookingCard {
  id: string;
  code: string;
  status: BookingStatus;
  modelName: string;
  plate: string;
  clientName: string | null;
  phone: string | null;
  startAt: string;
  endAt: string;
  /** Выдача не состоялась в срок или возврат просрочен */
  overdue: boolean;
  /** Сколько клиент ещё должен внести наличными, VND */
  cashDue: number;
  /** Открыт случай «байка нет на месте» */
  incidentOpen: boolean;
}

/** GET /manager/today — «сегодня» в часовом поясе точки. */
export interface ManagerTodayResponse {
  date: string;
  timezone: string;
  issues: ManagerBookingCard[];
  returns: ManagerBookingCard[];
}

export interface ManagerBike {
  id: string;
  plate: string;
  modelName: string;
  mileageKm: number;
  status: 'ACTIVE' | 'REPAIR' | 'RETIRED';
  readyAt: string | null;
}

export interface ManagerAct {
  id: string;
  kind: HandoverKind;
  plate: string;
  mileageKm: number;
  fuelLevel: number;
  photoCount: number;
  damages: string | null;
  clientConfirmedAt: string | null;
  createdAt: string;
}

export interface ManagerIncident {
  id: string;
  source: 'CLIENT' | 'STAFF' | 'SYSTEM';
  comment: string | null;
  createdAt: string;
  /** Предложено клиенту, ждём ответа */
  proposal: { plate: string; modelName: string } | null;
}

export interface ManagerDeduction {
  id: string;
  amount: number;
  reason: string;
  photoCount: number;
}

export interface LateFeePreview {
  amount: number;
  minutesLate: number;
}

/** GET /manager/bookings/{code|id}. */
export interface ManagerBookingDetail {
  card: ManagerBookingCard;
  paymentMethod: PaymentMethod;
  rentAmount: number;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  lateFee: LateFeePreview;
  client: { id: string; name: string | null; phone: string | null };
  documents: DocumentDto[];
  bike: ManagerBike;
  /** Свободные на период брони байки той же модели и точки (включая назначенный) */
  freeBikes: ManagerBike[];
  /** Открытый случай «байка нет на месте» */
  incident: ManagerIncident | null;
  /** Свободные байки других моделей этой точки — только при открытом случае */
  replacements: IncidentReplacement[];
  issueAct: ManagerAct | null;
  returnAct: ManagerAct | null;
  deductions: ManagerDeduction[];
}

/** POST /manager/bookings/{id}/photos → ссылка на загрузку фото в приватный бакет. */
export interface ActPhotoUploadRequest {
  contentType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';
}
export interface ActPhotoUploadResponse {
  key: string;
  uploadUrl: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

/** POST /manager/bookings/{id}/handover — создаёт акт; бронь становится «Выдана» после подтверждения клиентом. */
export interface HandoverRequest {
  bikeId: string;
  mileageKm: number;
  /** Топливо, 0–100 % */
  fuelLevel: number;
  photos: string[];
  damages?: string | null;
}
export interface HandoverResponse {
  actId: string;
}

export interface DeductionInput {
  amount: number;
  reason: string;
  photos?: string[];
}

/** POST /manager/bookings/{id}/return — приём байка и закрытие брони. */
export interface ReturnRequest {
  mileageKm: number;
  fuelLevel: number;
  photos: string[];
  damages?: string | null;
  deductions?: DeductionInput[];
}
export interface ReturnResponse {
  actId: string;
  lateFeeAmount: number;
  deductionsTotal: number;
  /** Депозит к возврату клиенту: депозит − удержания */
  depositRefund: number;
}

/** POST /manager/bookings/{id}/cash — приём наличных (Payment с методом CASH). */
export interface CashRequest {
  amount: number;
  kind?: CashPaymentKind;
  comment?: string | null;
}
export interface CashResponse {
  paymentId: string;
  paidAmount: number;
}

/** POST /manager/bookings/{id}/no-show. */
export interface NoShowResponse {
  refundAmount: number;
  refundPercent: number;
}

/** PATCH /manager/bikes/{id}: «Ремонт» исключает байк из доступности до readyAt. */
export interface BikePatchRequest {
  status: 'ACTIVE' | 'REPAIR';
  readyAt?: string | null;
}

/** GET /bookings/{id}/handover — акты и удержания для клиента (ссылки на фото живут ≤ 10 мин). */
export interface ClientHandoverAct {
  id: string;
  kind: HandoverKind;
  plate: string;
  mileageKm: number;
  fuelLevel: number;
  damages: string | null;
  photoUrls: string[];
  confirmedAt: string | null;
}
export interface ClientDeduction {
  id: string;
  amount: number;
  reason: string;
  photoUrls: string[];
}
export interface ClientHandoverResponse {
  acts: ClientHandoverAct[];
  deductions: ClientDeduction[];
  /** Депозит, возвращаемый после сдачи (null, пока байк не сдан) */
  depositRefund: number | null;
}
