import { MAX_ACTIVE_BOOKINGS, MAX_UNPAID_BOOKINGS, type RefundRules } from '@rental/shared';
import type { PrismaService } from '../prisma/prisma.service';

// Правила броней из таблицы Setting (значения по умолчанию — interfaces.md).
export interface BookingRules {
  holdMinutes: number;
  bufferMinutes: number;
  minLeadMinutes: number;
  minRentDays: number;
  cancel: RefundRules;
  noShowHours: number;
  cashPrepayPercent: number;
  docRetentionDays: number;
  maxUnpaidBookings: number;
  maxActiveBookings: number;
  /** Клиент загружает паспорт и права до брони; клиента «с улицы» проверяет менеджер. */
  requireDocuments: boolean;
}

export const BOOKING_RULE_DEFAULTS: BookingRules = {
  holdMinutes: 15,
  bufferMinutes: 60,
  minLeadMinutes: 60,
  minRentDays: 1,
  cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 },
  noShowHours: 3,
  cashPrepayPercent: 0,
  docRetentionDays: 90,
  maxUnpaidBookings: MAX_UNPAID_BOOKINGS,
  maxActiveBookings: MAX_ACTIVE_BOOKINGS,
  requireDocuments: true,
};

const num = (v: unknown, fallback: number, max = Number.MAX_SAFE_INTEGER): number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= max ? v : fallback;

export async function loadBookingRules(prisma: Pick<PrismaService, 'setting'>): Promise<BookingRules> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.keys(BOOKING_RULE_DEFAULTS) } } });
  const raw = (key: keyof BookingRules): unknown => rows.find((r) => r.key === key)?.value;
  const d = BOOKING_RULE_DEFAULTS;
  const c = (raw('cancel') ?? {}) as Partial<RefundRules>;
  return {
    holdMinutes: num(raw('holdMinutes'), d.holdMinutes),
    bufferMinutes: num(raw('bufferMinutes'), d.bufferMinutes),
    minLeadMinutes: num(raw('minLeadMinutes'), d.minLeadMinutes),
    minRentDays: num(raw('minRentDays'), d.minRentDays),
    cancel: {
      fullHours: num(c.fullHours, d.cancel.fullHours),
      halfHours: num(c.halfHours, d.cancel.halfHours),
      halfPercent: num(c.halfPercent, d.cancel.halfPercent, 100),
    },
    noShowHours: num(raw('noShowHours'), d.noShowHours),
    cashPrepayPercent: num(raw('cashPrepayPercent'), d.cashPrepayPercent, 100),
    docRetentionDays: num(raw('docRetentionDays'), d.docRetentionDays),
    maxUnpaidBookings: num(raw('maxUnpaidBookings'), d.maxUnpaidBookings),
    maxActiveBookings: num(raw('maxActiveBookings'), d.maxActiveBookings),
    requireDocuments: raw('requireDocuments') !== false,
  };
}
