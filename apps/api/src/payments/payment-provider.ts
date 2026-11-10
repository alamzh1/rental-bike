import type { PaymentProviderName } from '@rental/shared';

// Адаптер платёжного сервиса (VietQR). Выбор — по переменным: заданы PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY → payOS, иначе тестовый.

export interface PaymentRequest {
  paymentId: string;
  bookingId: string;
  bookingCode: string;
  /** Уникальный целочисленный номер заказа у провайдера */
  orderCode: number;
  amount: number;
  /** Назначение перевода — код брони */
  description: string;
  expiresAt: Date;
}

export interface CreatedPayment {
  externalId: string;
  qrPayload: string;
  deeplink?: string | null;
  expiresAt: Date;
}

export interface WebhookRequest {
  body: unknown;
  headers: Record<string, string | string[] | undefined>;
}

export interface WebhookEvent {
  externalId: string;
  /** Фактически пришедшая сумма, VND */
  amount: number;
  /** false — событие не об успешной оплате (игнорируется) */
  paid: boolean;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  createPayment(req: PaymentRequest): Promise<CreatedPayment>;
  /** null — подпись неверна. */
  verifyWebhook(req: WebhookRequest): WebhookEvent | null;
}

/** DI-токен: `@Inject(PAYMENT_PROVIDER) provider: PaymentProvider`. */
export const PAYMENT_PROVIDER = Symbol('PAYMENT_PROVIDER');
