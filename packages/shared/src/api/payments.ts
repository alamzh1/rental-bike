// Типы API модуля `payments`: VietQR (payOS или тестовый провайдер), webhook, возвраты.
import type { PaymentMethod } from '../types.js';

export type PaymentKind = 'RENT' | 'DEPOSIT' | 'PREPAYMENT' | 'SURCHARGE' | 'REFUND';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED' | 'CANCELLED';
/**
 * `test` — тестовый провайдер (только NODE_ENV=development|test, без аккаунтов); `payos` — включается переменными PAYOS_*;
 * `disabled` — вне dev без PAYOS_*: оплата недоступна (503 PAYMENT_NOT_AVAILABLE).
 */
export type PaymentProviderName = 'payos' | 'test' | 'disabled' | 'manual';

/** Коды ошибок оплаты: 400 INVALID_SIGNATURE (webhook), 403 FORBIDDEN (IP не из PAYOS_WEBHOOK_IPS), 409/503 PAYMENT_NOT_AVAILABLE. */
export const PAYMENT_ERROR_CODES = ['INVALID_SIGNATURE', 'PAYMENT_NOT_AVAILABLE', 'TEST_PAYMENT_RESTRICTED'] as const;
export type PaymentErrorCode = (typeof PAYMENT_ERROR_CODES)[number];

/** POST /bookings/{id}/pay → QR для оплаты. Повторный вызов до истечения отдаёт тот же платёж. */
export interface PayBookingResponse {
  paymentId: string;
  provider: PaymentProviderName;
  /** Строка VietQR (EMVCo) для отрисовки QR-кода */
  qrPayload: string;
  /** Ссылка «Открыть банк» / страница оплаты; null у тестового провайдера */
  deeplink: string | null;
  amount: number;
  /** Назначение перевода — код брони */
  description: string;
  expiresAt: string;
  /** Перевод в рублях: сумма зафиксирована до конца удержания */
  rub?: RubTransferDetails;
}

/** Реквизиты и сумма перевода в рублях; подтверждает администратор. */
export interface RubTransferDetails {
  amount: number;
  /** ₽ за 1 ₫ с наценкой */
  rate: number;
  phone: string;
  bank: string;
  recipient: string;
  /** Клиент сообщил о переводе; ждём администратора */
  claimedAt: string | null;
  /** Депозит, ₫: в перевод не входит, отдаётся наличными при выдаче */
  depositCash: number;
}

/** Рублёвая сумма округляется вверх: копейки в переводе только мешают. */
export function vndToRub(vnd: number, rubPerVnd: number): number {
  return Math.ceil(vnd * rubPerVnd);
}

export interface PaymentDto {
  id: string;
  bookingId: string;
  kind: PaymentKind;
  method: PaymentMethod;
  provider: string | null;
  amount: number;
  receivedAmount: number | null;
  status: PaymentStatus;
  paidAt: string | null;
  createdAt: string;
  comment: string | null;
  rubAmount?: number | null;
  rubRate?: number | null;
}

/** POST /dev/payments/{id}/pay (только dev, тестовый провайдер). `amount` — для проверки недоплаты/переплаты. */
export interface DevPayRequest {
  amount?: number;
}

/** Ответ на webhook payOS. */
export interface WebhookAck {
  success: true;
}
