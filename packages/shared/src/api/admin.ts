// Типы API модуля `admin`: вход в веб-админку, роли и разделы, дашборд, брони, шахматка, журнал (таск 10).
// Разделы fleet, prices, locations, texts, payments, settings, banner наполняет таск 11 — их роли заданы здесь же.
import type { BookingStatus, I18nText, PaymentMethod, Role } from '../types.js';
import type { Booking } from './bookings.js';
import type { DocumentDto } from './documents.js';
import type { PaymentDto } from './payments.js';
import type { QuoteExtraRequest } from './pricing.js';

// ---------- Роли и разделы ----------

export type StaffRole = Extract<Role, 'MANAGER' | 'OWNER' | 'ADMIN'>;

/** Разделы интерфейса админки (маршрут `/<section>`). */
export const ADMIN_SECTIONS = ['dashboard', 'owners', 'bookings', 'chess', 'tracking', 'fleet', 'acts', 'finance', 'prices', 'locations', 'payments', 'documents', 'texts', 'settings', 'banner', 'audit'] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

/** Менеджер: брони, шахматка и парк своей точки — без цен, настроек, платежей, текстов и журнала (история 84). */
const MANAGER_SECTIONS: ReadonlySet<AdminSection> = new Set(['dashboard', 'bookings', 'chess', 'tracking', 'fleet']);

/** Владелец точки: всё о своей точке, включая финансы и цены. Общие настройки, тексты, баннер и журнал — у администратора. */
const OWNER_SECTIONS: ReadonlySet<AdminSection> = new Set([...MANAGER_SECTIONS, 'acts', 'finance', 'prices', 'locations', 'payments']);

export function canOpenSection(role: Role, section: AdminSection): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'OWNER') return OWNER_SECTIONS.has(section);
  return role === 'MANAGER' && MANAGER_SECTIONS.has(section);
}

/** Суммы и закупочные цены видят владелец своей точки и администратор, менеджер — нет. */
export function canSeeMoney(role: Role): boolean {
  return role === 'ADMIN' || role === 'OWNER';
}

/**
 * Первый сегмент пути `/api/admin/<segment>/…`, открытый менеджеру. Всё, чего нет в списке, — только ADMIN
 * (запрет по умолчанию: новый эндпоинт без записи здесь менеджеру недоступен). `auth` — вход, открыт всем.
 */
export const ADMIN_API_MANAGER_SEGMENTS = ['dashboard', 'bookings', 'chess', 'tracking', 'models', 'bikes', 'brands'] as const;

/** То же для владельца точки; что именно он видит внутри сегмента, сужает staffScope. */
export const ADMIN_API_OWNER_SEGMENTS = [...ADMIN_API_MANAGER_SEGMENTS, 'acts', 'finance', 'tariffs', 'seasons', 'extras', 'locations', 'payments'] as const;

export function canCallAdminApi(role: Role, segment: string): boolean {
  if (role === 'ADMIN') return true;
  if (role === 'OWNER') return (ADMIN_API_OWNER_SEGMENTS as readonly string[]).includes(segment);
  return role === 'MANAGER' && (ADMIN_API_MANAGER_SEGMENTS as readonly string[]).includes(segment);
}

// ---------- Вход ----------

/** POST /admin/auth/telegram — поля Telegram Login Widget как есть (подпись hash проверяет сервер). */
export interface TelegramLoginRequest {
  id: number | string;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number | string;
  hash: string;
}

/** POST /admin/auth/dev — только NODE_ENV=development|test и DEV_AUTH=1. */
export interface AdminDevLoginRequest {
  role: 'manager' | 'owner' | 'admin';
}

/** POST /admin/auth/link — вход через бота: ссылка для бота и секрет, по которому браузер заберёт сессию. */
export interface AdminLoginLink {
  url: string;
  secret: string;
  expiresAt: string;
}

/** POST /admin/auth/link/status `{ secret }`: `confirmed` ставит cookie сессии. */
export type AdminLoginLinkStatus = { status: 'pending' | 'expired' | 'denied' } | ({ status: 'confirmed' } & AdminSessionResponse);

/** GET /admin/auth/config — для страницы входа, без авторизации. */
export interface AdminAuthConfig {
  /** Имя бота для Login Widget; null — бот не настроен */
  botUsername: string | null;
  devAuth: boolean;
}

export interface AdminMe {
  id: string;
  telegramId: string;
  name: string;
  username: string | null;
  photoUrl: string | null;
  role: StaffRole;
  /** Точка сотрудника или выбранная администратором; null — все точки */
  locationId: string | null;
  /** Часовой пояс точки менеджера или первой точки — для дат в интерфейсе */
  timezone: string;
  sections: AdminSection[];
  /** В БД есть демо-данные (isDemo) — показывается плашка «Демо-данные — замените» */
  hasDemoData: boolean;
}

/** Ответ входа и GET /admin/auth/me. Сессия — cookie httpOnly `admin_session`, в теле токена нет. */
export interface AdminSessionResponse {
  me: AdminMe;
  expiresAt: string;
}

/**
 * POST /admin/auth/webapp — вход внутри Telegram по подписанному initData. Кроме cookie возвращает токен:
 * Telegram в браузере открывает админку во фрейме, где cookie SameSite=Lax не отправляется.
 */
export interface AdminWebAppSession extends AdminSessionResponse {
  token: string;
}

/** Мутирующие запросы админки обязаны нести этот заголовок (защита cookie-сессии от CSRF). */
export const ADMIN_REQUEST_HEADER = 'x-admin-request';

/** Администратор смотрит одну точку: все разделы админки сужаются до неё. Другим ролям заголовок ничего не даёт. */
export const ADMIN_LOCATION_HEADER = 'x-admin-location';

// ---------- Дашборд ----------

export interface AdminFunnelStep {
  name: 'open' | 'dates_selected' | 'model_viewed' | 'checkout_opened' | 'paid';
  count: number;
}

export interface AdminDashboard {
  /** Дата «сегодня» в часовом поясе точки, YYYY-MM-DD */
  date: string;
  timezone: string;
  issuesToday: number;
  returnsToday: number;
  /** Загрузка парка сегодня: доля байков (не списанных) с действующей бронью, % (0–100, целое) */
  fleetLoadPercent: number;
  fleetSize: number;
  busyBikes: number;
  /**
   * Выручка — сумма аренды, опций, доставки и доплат за опоздание по броням (кроме отменённых и «Ожидает оплаты»)
   * с началом в периоде: сегодня, текущая неделя (пн–вс), текущий месяц — в tz точки. null — менеджеру не показывается.
   */
  revenue: { day: number; week: number; month: number } | null;
  unpaid: { count: number; items: AdminBookingRow[] };
  /** Байк у клиента: срок возврата прошёл или наступит в ближайшие 24 ч */
  rentals: { overdue: AdminBookingRow[]; endingSoon: AdminBookingRow[] };
  /** Воронка за 30 дней: события AnalyticsEvent по шагам и источники открытий */
  funnel: { days: number; steps: AdminFunnelStep[]; sources: { source: string; count: number }[] };
}

// ---------- Брони ----------

export interface AdminBookingQuery {
  status?: BookingStatus | BookingStatus[];
  /** Пересечение периода брони с [from, to) — ISO */
  from?: string;
  to?: string;
  locationId?: string;
  /** Код брони, телефон, имя клиента */
  q?: string;
  page?: number;
  pageSize?: number;
}

export interface AdminClient {
  id: string;
  name: string;
  username: string | null;
  phone: string | null;
  telegramId: string;
  /** Клиент «с улицы», заведён вручную в админке */
  walkIn: boolean;
}

export interface AdminBookingRow {
  id: string;
  code: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  modelId: string;
  modelName: string;
  bikeId: string;
  bikePlate: string;
  locationId: string;
  client: AdminClient;
  paymentMethod: PaymentMethod;
  totalAmount: number;
  depositAmount: number;
  paidAmount: number;
  holdExpiresAt: string | null;
  createdAt: string;
}

export interface AdminBookingList {
  items: AdminBookingRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminStatusChange {
  id: string;
  from: BookingStatus | null;
  to: BookingStatus;
  actorName: string | null;
  reason: string | null;
  at: string;
}

export interface AdminHandoverAct {
  id: string;
  kind: 'ISSUE' | 'RETURN';
  mileageKm: number;
  fuelLevel: number;
  damages: string | null;
  photoCount: number;
  managerName: string | null;
  clientConfirmedAt: string | null;
  createdAt: string;
}

export interface AdminBookingDetail extends AdminBookingRow {
  booking: Booking;
  history: AdminStatusChange[];
  payments: PaymentDto[];
  documents: DocumentDto[];
  acts: AdminHandoverAct[];
  incidents: AdminIncident[];
  /** Допустимые переходы статуса из текущего (shared.canTransition) */
  nextStatuses: BookingStatus[];
}

/** PATCH /admin/bookings/{id}: перенос на другой байк той же модели и/или смена статуса. */
export interface AdminBookingPatch {
  bikeId?: string;
  status?: BookingStatus;
  reason?: string;
}

/** POST /admin/bookings — ручная бронь для клиента «с улицы»: те же проверки, что у брони из Mini App. */
export interface AdminManualBookingRequest {
  modelId: string;
  /** Конкретный байк (из шахматки); без него — любой свободный байк модели */
  bikeId?: string;
  startAt: string;
  endAt: string;
  extras?: QuoteExtraRequest[];
  paymentMethod: PaymentMethod;
  /** E.164 */
  phone: string;
  name?: string;
  lang?: 'ru' | 'en' | 'vi';
}

export interface AdminIncident {
  id: string;
  source: 'CLIENT' | 'STAFF' | 'SYSTEM';
  status: 'OPEN' | 'RESOLVED';
  resolution: 'SAME_MODEL' | 'BIKE_PRESENT' | 'REPLACED' | 'CANCELLED' | null;
  comment: string | null;
  escalated: boolean;
  createdAt: string;
  resolvedAt: string | null;
}

/** GET /admin/acts — архив фотоактов точки: до и после аренды, по брони. */
export interface AdminActArchiveRow {
  bookingId: string;
  code: string;
  status: BookingStatus;
  plate: string;
  modelName: string;
  clientName: string;
  startAt: string;
  endAt: string;
  before: AdminHandoverAct | null;
  after: AdminHandoverAct | null;
}

export interface AdminActArchive {
  items: AdminActArchiveRow[];
  total: number;
  page: number;
  pageSize: number;
}

/** GET /admin/supervision — контроль владельцев, только администратор платформы. */
export interface AdminSupervisionPoint {
  locationId: string;
  name: I18nText;
  address: string;
  isActive: boolean;
  owners: string[];
  managers: string[];
  bikes: number;
  activeRentals: number;
  overdue: number;
  /** Текущий месяц */
  income: number;
  expenses: number;
  profit: number;
  outstanding: number;
  /** Записано к возврату клиентам, но ещё не возвращено */
  pendingRefunds: number;
  openIncidents: number;
  recentIncidents: number;
  /** Выданные или завершённые брони без акта с фото */
  withoutPhotoAct: number;
  payosAccount: 'own' | 'platform' | 'test' | 'off';
  lastActivityAt: string | null;
}

export interface AdminSupervisionIncident {
  id: string;
  bookingId: string;
  code: string;
  modelName: string;
  startAt: string;
  pointName: I18nText;
  source: 'CLIENT' | 'STAFF' | 'SYSTEM';
  escalated: boolean;
  createdAt: string;
}

export interface AdminSupervision {
  incidentDays: number;
  points: AdminSupervisionPoint[];
  openIncidents: AdminSupervisionIncident[];
}

/** Временные ссылки на фото акта (≤ 600 с). */
export interface AdminActPhotos {
  photos: { url: string; expiresAt: string }[];
}

/** Тело 409 при переносе/ручной брони: причина и бронь, с которой конфликт. */
export interface AdminConflictError {
  code: 'BIKE_TAKEN' | 'BIKE_UNAVAILABLE' | 'BIKE_MODEL_MISMATCH' | 'BOOKING_CLOSED';
  message: string;
  conflict?: { bookingId: string; code: string; startAt: string; endAt: string };
}

// ---------- Шахматка ----------

export interface ChessBike {
  id: string;
  plate: string;
  modelId: string;
  modelName: string;
  status: 'ACTIVE' | 'REPAIR' | 'RETIRED';
  readyAt: string | null;
  isDemo: boolean;
}

export interface ChessBooking {
  id: string;
  code: string;
  bikeId: string;
  modelId: string;
  status: BookingStatus;
  startAt: string;
  endAt: string;
  /** Конец буфера (end + bufferMinutes) */
  blockedUntil: string;
  clientName: string;
}

export interface ChessResponse {
  from: string;
  to: string;
  timezone: string;
  bikes: ChessBike[];
  bookings: ChessBooking[];
}

// ---------- Журнал ----------

export interface AuditEntry {
  id: string;
  at: string;
  actor: { id: string; name: string; role: Role } | null;
  action: string;
  entity: string;
  entityId: string | null;
  diff: Record<string, unknown> | null;
}

export interface AuditQuery {
  entity?: string;
  entityId?: string;
  actorId?: string;
  page?: number;
}

export interface AuditList {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}
