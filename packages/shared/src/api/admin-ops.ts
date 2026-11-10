// Типы API разделов «Финансы» и «Мониторинг». Деньги — целые VND; даты периода — YYYY-MM-DD в tz точки.
import type { BikeStatus } from './admin-fleet.js';
import type { AdminBookingRow } from './admin.js';

// ---------- Финансы ----------

export const EXPENSE_CATEGORIES = ['MAINTENANCE', 'REPAIR', 'PARTS', 'FUEL', 'INSURANCE', 'PURCHASE', 'SALARY', 'RENT', 'MARKETING', 'OTHER'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface AdminExpense {
  id: string;
  date: string;
  category: ExpenseCategory;
  amount: number;
  comment: string | null;
  bikeId: string | null;
  bikePlate: string | null;
  locationId: string | null;
}

/** POST/PATCH /admin/finance/expenses */
export interface AdminExpenseInput {
  date?: string;
  category?: ExpenseCategory;
  amount?: number;
  comment?: string | null;
  bikeId?: string | null;
}

/** Доход по статьям: начисляется брони по дате начала, как выручка в сводке. */
export interface AdminIncomeBreakdown {
  /** Аренда за вычетом скидок */
  rent: number;
  extras: number;
  delivery: number;
  lateFees: number;
  /** Удержания из депозита */
  deductions: number;
  /** Удержано при отменах */
  cancellationFees: number;
  /** Возвраты сверх депозита, отрицательное число */
  refunds: number;
}

export interface AdminFinancePoint {
  /** YYYY-MM-DD или YYYY-MM */
  period: string;
  income: number;
  expenses: number;
  profit: number;
}

export interface AdminBikeFinance {
  bikeId: string;
  plate: string;
  modelName: string;
  status: BikeStatus;
  bookings: number;
  /** Суток в аренде за прошедшую часть периода */
  rentedDays: number;
  /** Доля времени в аренде за прошедшую часть периода, % */
  loadPercent: number;
  income: number;
  expenses: number;
  profit: number;
  purchasePrice: number | null;
  /** Прибыль за всё время */
  lifetimeProfit: number;
  /** Сколько цены покупки вернулось, %; null — цена не указана */
  paybackPercent: number | null;
}

/** GET /admin/finance/summary?from&to&locationId */
export interface AdminFinanceSummary {
  from: string;
  to: string;
  timezone: string;
  income: number;
  breakdown: AdminIncomeBreakdown;
  expenses: number;
  expensesByCategory: { category: ExpenseCategory; amount: number }[];
  profit: number;
  /** Прибыль к доходу, %; null — дохода нет */
  marginPercent: number | null;
  /** Начислено по броням периода, но ещё не получено от клиентов (с депозитом) */
  outstanding: number;
  granularity: 'day' | 'month';
  series: AdminFinancePoint[];
  bikes: AdminBikeFinance[];
}

// ---------- Мониторинг ----------

export const TRACKED_STATES = ['OVERDUE', 'RENTED', 'PROBLEM', 'RESERVED', 'FREE', 'REPAIR', 'RETIRED'] as const;
export type TrackedState = (typeof TRACKED_STATES)[number];

export const BIKE_ATTENTION = ['OVERDUE', 'ENDING_SOON', 'MOVING_UNRENTED', 'GPS_OFFLINE', 'INSURANCE_EXPIRED', 'INSURANCE_SOON', 'SERVICE_DUE'] as const;
export type BikeAttention = (typeof BIKE_ATTENTION)[number];

export interface TrackedBooking {
  id: string;
  code: string;
  clientName: string;
  phone: string | null;
  startAt: string;
  endAt: string;
}

export interface TrackedGps {
  /** Трекер подключён */
  connected: boolean;
  lat: number | null;
  lng: number | null;
  speedKmh: number | null;
  batteryPct: number | null;
  lastSeenAt: string | null;
  /** Сигнал свежее 30 минут */
  online: boolean;
}

export interface AdminTrackedBike {
  id: string;
  plate: string;
  modelName: string;
  locationId: string;
  status: BikeStatus;
  state: TrackedState;
  mileageKm: number;
  serviceDate: string | null;
  insuranceUntil: string | null;
  /** Байк у клиента */
  current: TrackedBooking | null;
  /** Ближайшая бронь */
  next: TrackedBooking | null;
  gps: TrackedGps;
  attention: BikeAttention[];
}

/** GET /admin/tracking */
export interface AdminTrackingList {
  items: AdminTrackedBike[];
  location: { lat: number; lng: number } | null;
}

export interface TrackPoint {
  lat: number;
  lng: number;
  speedKmh: number | null;
  at: string;
}

/** Как подключить трекер; только администратору. */
export interface AdminTrackerSetup {
  /** ID устройства в Traccar */
  deviceId: string | null;
  /** Адрес, на который устройство отправляет точки; содержит секрет */
  ingestUrl: string;
  /** На сервере задан GPS_FORWARD_SECRET: доступен приём от Traccar */
  forwardEnabled: boolean;
}

/** PUT /admin/tracking/:id/tracker */
export interface AdminTrackerInput {
  deviceId?: string | null;
}

/** GET /admin/tracking/:id?hours= */
export interface AdminTrackedBikeDetail {
  bike: AdminTrackedBike;
  /** Трек за выбранные часы, по времени */
  track: TrackPoint[];
  /** Последние брони байка */
  history: AdminBookingRow[];
  /** Только администратору: за всё время */
  finance: { income: number; expenses: number; profit: number; purchasePrice: number | null; paybackPercent: number | null } | null;
  /** Только администратору; null — трекер не подключён */
  tracker: AdminTrackerSetup | null;
}
