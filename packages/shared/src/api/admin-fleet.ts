// Типы API разделов админки таска 11: парк, цены, точки, тексты, платежи, настройки, баннер; публичные настройки.
// Деньги — целые VND; даты сезонов — YYYY-MM-DD в tz точки; тексты из БД — I18nText.
import type { Currency, I18nText, Lang, PaymentMethod } from '../types.js';
import type { DocumentDto } from './documents.js';
import type { BookingStatus } from '../types.js';
import type { ModelPhoto } from './catalog.js';
import type { PaymentKind, PaymentStatus } from './payments.js';
import type { RatesResponse } from './rates.js';

/** Список раздела: `{ items, total }` (как ждёт dataProvider админки). */
export interface AdminListOf<T> {
  items: T[];
  total: number;
}

// ---------- Парк: бренды, модели, байки ----------

export const ADMIN_MODEL_CATEGORIES = ['SCOOTER', 'MAXI_SCOOTER', 'SEMI_AUTO', 'MOTORCYCLE', 'ELECTRIC'] as const;
export const ADMIN_TRANSMISSIONS = ['AUTOMATIC', 'SEMI_AUTO', 'MANUAL', 'ELECTRIC'] as const;
export const BIKE_STATUSES = ['ACTIVE', 'REPAIR', 'RETIRED'] as const;
export type BikeStatus = (typeof BIKE_STATUSES)[number];
/** Ширины фото модели после конвертации (WebP + AVIF каждой ширины). */
export const MODEL_PHOTO_WIDTHS = [400, 800, 1200] as const;
/** Наибольший размер загружаемого изображения (фото модели, логотип, баннер), байт. */
export const ADMIN_IMAGE_MAX_BYTES = 15 * 1024 * 1024;

export interface AdminBrand {
  id: string;
  name: string;
  logoUrl: string | null;
  sortOrder: number;
}

export interface AdminTariff {
  minDays: number;
  /** null — без верхней границы */
  maxDays: number | null;
  pricePerDay: number;
}

export interface AdminModelPhoto extends ModelPhoto {
  /** Ключ фото (models/<slug>/<id>) — для удаления */
  key: string;
  demo: boolean;
}

/** Модель в админке. Для MANAGER поля `deposit` и `tariffs` отсутствуют (парк своей точки без цен). */
export interface AdminModel {
  id: string;
  locationId: string;
  locationName: I18nText;
  brandId: string;
  brandName: string;
  name: string;
  slug: string;
  category: (typeof ADMIN_MODEL_CATEGORIES)[number];
  transmission: (typeof ADMIN_TRANSMISSIONS)[number];
  engineCc: number | null;
  year: number | null;
  description: I18nText;
  photos: AdminModelPhoto[];
  fuelConsumption: number | null;
  tankLiters: number | null;
  maxSpeedKmh: number | null;
  seats: number;
  features: string[];
  included: I18nText[];
  conditions: I18nText | null;
  licenseRequired: 'A1' | 'A' | 'NONE';
  isActive: boolean;
  isDemo: boolean;
  bikeCount: number;
  deposit?: number;
  tariffs?: AdminTariff[];
}

/** POST/PATCH /admin/models (только ADMIN). Изменение владельцем снимает `isDemo`. */
export interface AdminModelInput {
  locationId?: string;
  brandId?: string;
  name?: string;
  category?: AdminModel['category'];
  transmission?: AdminModel['transmission'];
  engineCc?: number | null;
  year?: number | null;
  description?: I18nText;
  fuelConsumption?: number | null;
  tankLiters?: number | null;
  maxSpeedKmh?: number | null;
  seats?: number;
  features?: string[];
  included?: I18nText[];
  conditions?: I18nText | null;
  licenseRequired?: AdminModel['licenseRequired'];
  deposit?: number;
  isActive?: boolean;
}

export type BikeDocKind = 'registration' | 'insurance';

export interface AdminBike {
  id: string;
  modelId: string;
  modelName: string;
  locationId: string;
  plate: string;
  vin: string | null;
  mileageKm: number;
  status: BikeStatus;
  readyAt: string | null;
  /** Дата ТО, ISO */
  serviceDate: string | null;
  insuranceUntil: string | null;
  hasRegistrationDoc: boolean;
  hasInsuranceDoc: boolean;
  /** Цена покупки, VND; менеджеру не отдаётся */
  purchasePrice?: number | null;
  isDemo: boolean;
}

/** POST/PATCH /admin/bikes. MANAGER (своя точка) меняет только status, readyAt, mileageKm, serviceDate. */
export interface AdminBikeInput {
  purchasePrice?: number | null;
  modelId?: string;
  plate?: string;
  vin?: string | null;
  mileageKm?: number;
  status?: BikeStatus;
  readyAt?: string | null;
  serviceDate?: string | null;
  insuranceUntil?: string | null;
}

/** POST /admin/bikes/{id}/documents/{kind} → подписанная ссылка на загрузку в приватное хранилище (PUT). */
export interface BikeDocUpload {
  /** Передать в POST …/confirm после загрузки */
  key: string;
  uploadUrl: string;
  headers: Record<string, string>;
  expiresAt: string;
}

// ---------- Цены ----------

/** GET /admin/tariffs: тарифы по длительности для каждой модели. PATCH /admin/tariffs/{modelId} `{ tariffs }`. */
export interface AdminModelTariffs {
  modelId: string;
  modelName: string;
  deposit: number;
  isDemo: boolean;
  tariffs: AdminTariff[];
}

export interface AdminSeason {
  id: string;
  locationId: string | null;
  name: I18nText;
  /** YYYY-MM-DD включительно */
  from: string;
  to: string;
  coefficient: number;
  isDemo: boolean;
}

export type AdminSeasonInput = Partial<Omit<AdminSeason, 'id' | 'isDemo'>>;

export interface AdminExtra {
  id: string;
  code: string;
  name: I18nText;
  price: number;
  per: 'DAY' | 'ONCE';
  maxQty: number;
  sortOrder: number;
  isActive: boolean;
  isDemo: boolean;
}

export type AdminExtraInput = Partial<Omit<AdminExtra, 'id' | 'isDemo'>>;

// ---------- Точки ----------

export interface AdminLocationManager {
  id: string;
  name: string;
  username: string | null;
  telegramId: string;
}

export interface AdminLocation {
  id: string;
  name: I18nText;
  address: string;
  lat: number;
  lng: number;
  /** HH:mm в tz точки */
  openTime: string;
  closeTime: string;
  timezone: string;
  isActive: boolean;
  isDemo: boolean;
  /** Контакт для клиентов этой точки; null — общий из настроек */
  contact: string | null;
  /** Арендодатель в договоре */
  legalName: string | null;
  managers: AdminLocationManager[];
  /** Владельцы точки: видят только её */
  owners: AdminLocationManager[];
  payos: AdminLocationPayos;
}

/** Куда идут онлайн-оплаты точки. Ключи никогда не возвращаются. */
export interface AdminLocationPayos {
  /** own — свой счёт точки; platform — общий счёт из .env; test — тестовая оплата; off — онлайн-оплаты нет */
  account: 'own' | 'platform' | 'test' | 'off';
  clientId: string | null;
  /** Когда payOS принял адрес webhook; null — ещё не принял */
  webhookConfirmedAt: string | null;
  /** Адрес webhook этой точки: его payOS вызывает при оплате */
  webhookUrl: string;
}

/** PUT /admin/locations/{id}/payos — ключи канала оплаты из my.payos.vn. */
export interface AdminLocationPayosInput {
  clientId: string;
  apiKey: string;
  checksumKey: string;
}

export type AdminLocationInput = Partial<Omit<AdminLocation, 'id' | 'isDemo' | 'managers' | 'owners' | 'payos'>>;

/** POST /admin/locations/{id}/managers — назначить менеджера по Telegram ID. */
export interface AdminAssignManager {
  telegramId: string;
}

// ---------- Тексты интерфейса ----------

export interface AdminTextRow {
  key: string;
  /** Значение из JSON packages/i18n */
  base: Record<Lang, string>;
  /** Правка из админки (I18nOverride) поверх JSON */
  override: Partial<Record<Lang, string>>;
}

export interface AdminTextList {
  items: AdminTextRow[];
  total: number;
}

/** PATCH /admin/texts: пустое `value` (или null) удаляет правку. */
export interface AdminTextPatch {
  lang: Lang;
  key: string;
  value: string | null;
}

// ---------- Платежи ----------

export interface AdminPaymentRow {
  id: string;
  rubAmount?: number | null;
  rubRate?: number | null;
  bookingId: string;
  bookingCode: string;
  clientName: string;
  kind: PaymentKind;
  method: PaymentMethod;
  provider: string | null;
  amount: number;
  receivedAmount: number | null;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  comment: string | null;
}

export interface AdminPaymentQuery {
  kind?: PaymentKind;
  status?: PaymentStatus;
  q?: string;
  page?: number;
}

export interface AdminPaymentList {
  items: AdminPaymentRow[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 * Сверка по брони: ожидалось (аренда + опции + доставка + опоздание + депозит при оплате онлайн) против полученного.
 * `state`: UNDERPAID — получено меньше ожидаемого, OVERPAID — больше, OK — совпало, REFUND_DUE — отменена с оплатой без закрытого возврата.
 */
export interface AdminReconciliationRow {
  bookingId: string;
  code: string;
  status: BookingStatus;
  paymentMethod: PaymentMethod;
  clientName: string;
  startAt: string;
  expected: number;
  received: number;
  refunded: number;
  refundPending: number;
  deducted: number;
  /** received − expected: < 0 — недоплата */
  difference: number;
  state: 'OK' | 'UNDERPAID' | 'OVERPAID' | 'REFUND_DUE';
  /** Последний полученный платёж — к нему привязывается новый возврат */
  paymentId: string | null;
  /** Ожидающий возврат (REFUND PENDING) — закрывается тем же POST /admin/payments/{id}/refund */
  pendingRefundId: string | null;
}

/** GET /admin/payments/reconciliation?from&to&onlyMismatches=1 — брони с началом в [from, to). */
export interface AdminReconciliation {
  from: string;
  to: string;
  items: AdminReconciliationRow[];
  total: number;
  mismatches: number;
}

export interface AdminDeductionRow {
  id: string;
  bookingId: string;
  bookingCode: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string | null;
}

/**
 * POST /admin/payments/{id}/refund. `id` — платёж: ожидающий возврат (REFUND PENDING) закрывается;
 * входящий платёж — новый возврат по его брони на `amount`. Повтор той же суммы → 409 REFUND_DUPLICATE,
 * больше полученного → 400 REFUND_EXCEEDS_PAID. Клиент получает уведомление ботом.
 */
export interface AdminRefundRequest {
  amount?: number;
  comment?: string;
}

export const ADMIN_FLEET_ERROR_CODES = ['REFUND_DUPLICATE', 'REFUND_EXCEEDS_PAID', 'TARIFFS_INVALID', 'PLATE_TAKEN', 'IMAGE_INVALID', 'UNKNOWN_KEY', 'IN_USE'] as const;
export type AdminFleetErrorCode = (typeof ADMIN_FLEET_ERROR_CODES)[number];

// ---------- Настройки ----------

export interface AdminSettings {
  holdMinutes: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  minRentDays: number;
  cancel: { fullHours: number; halfHours: number; halfPercent: number };
  late: { graceMinutes: number; hourlyFee: number; extraDayAfterHours: number };
  depositMode: 'MONEY' | 'DOCUMENT';
  /** Единиц валюты за 1 VND */
  /** В запросе на сохранение auto: true возвращает автообновление */
  rates: { RUB: number; USD: number; auto?: boolean };
  /** Курс задан вручную: автообновление выключено */
  ratesManual: boolean;
  docRetentionDays: number;
  noShowHours: number;
  cashPrepayPercent: number;
  /** Реквизиты для перевода в рублях; null — способ выключен */
  rubTransfer: RubTransferSettings | null;
  /** VND; null — доставки нет */
  deliveryFee: number | null;
  defaultCurrencyByLang: Record<Lang, Currency>;
  managerContact: string | null;
  contractTemplate: I18nText | null;
  rulesText: I18nText | null;
  /** Ограничения по пробегу и поездкам между провинциями — в «Условиях» карточки модели */
  restrictionsText: I18nText | null;
  privacyText: I18nText | null;
  faq: I18nText | null;
}

export interface RubTransferSettings {
  /** Телефон для СБП */
  phone: string;
  bank: string;
  recipient: string;
  /** Наценка к курсу, %: покрывает разницу при обмене */
  markupPercent: number;
}

export type AdminSettingKey = Exclude<keyof AdminSettings, 'ratesManual'>;

/** GET /admin/settings: значения (с умолчаниями) и ключи, которые ещё демо или не заданы владельцем. */
export interface AdminSettingsResponse {
  values: AdminSettings;
  demo: AdminSettingKey[];
}

/** PATCH /admin/settings: любые ключи; сохранённое читается правилами сразу, без перезапуска. */
export type AdminSettingsPatch = Partial<AdminSettings>;

/** GET /settings/public — без авторизации, для Mini App. */
export interface PublicSettings {
  faq: I18nText | null;
  rulesText: I18nText | null;
  privacyText: I18nText | null;
  managerContact: string | null;
  deliveryFee: number | null;
  cashPrepayPercent: number;
  defaultCurrencyByLang: Record<Lang, Currency>;
  rates: RatesResponse;
  /** Перевод в рублях доступен: ₽ за 1 ₫ с наценкой. Реквизиты клиент получает только для своей брони */
  rubTransfer: { rubPerVnd: number } | null;
}

// ---------- Баннер ----------

export interface AdminBanner {
  id: string;
  title: I18nText;
  text: I18nText | null;
  imageUrl: string | null;
  link: string | null;
  isActive: boolean;
  isDemo: boolean;
}

/** GET /admin/banner; PATCH /admin/banner; POST /admin/banner/image (тело — image/*, → WebP 1200). */
export interface AdminBannerResponse {
  banner: AdminBanner | null;
}

/** PATCH /admin/banner — один баннер на главной. */
export interface AdminBannerInput {
  title: I18nText;
  text?: I18nText | null;
  link?: string | null;
  isActive?: boolean;
}

// ---------- Проверка документов ----------

export interface AdminDocumentRow extends DocumentDto {
  clientName: string;
  clientPhone: string | null;
  clientLicense: 'A1' | 'A' | 'NONE' | null;
  rejectReason: string | null;
  verifiedBy: string | null;
}

export interface AdminDocumentList {
  items: AdminDocumentRow[];
  total: number;
  /** Сколько всего ждут проверки */
  waiting: number;
  page: number;
  pageSize: number;
}

// ---------- Переводы в рублях ----------

export interface AdminRubTransferRow {
  paymentId: string;
  bookingId: string;
  bookingCode: string;
  bookingStatus: string;
  clientName: string;
  clientPhone: string | null;
  rubAmount: number;
  rubRate: number;
  amount: number;
  claimedAt: string;
}
