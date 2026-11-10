export type Lang = 'ru' | 'en' | 'vi';
export const LANGS: readonly Lang[] = ['ru', 'en', 'vi'];

export type Currency = 'VND' | 'RUB' | 'USD';

export type BookingStatus =
  | 'PENDING_PAYMENT'
  | 'CONFIRMED'
  | 'ISSUED'
  | 'COMPLETED'
  | 'CANCELLED_BY_CLIENT'
  | 'CANCELLED_BY_SYSTEM'
  | 'PROBLEM';

export type PaymentMethod = 'VIETQR' | 'CASH' | 'RUB_TRANSFER';

export type Role = 'CLIENT' | 'MANAGER' | 'OWNER' | 'ADMIN';

/** Контент из БД на трёх языках; EN обязателен, остальные — по мере перевода. */
export type I18nText = { ru?: string; en: string; vi?: string };
