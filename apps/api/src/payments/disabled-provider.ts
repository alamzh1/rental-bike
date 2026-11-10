import type { CreatedPayment, PaymentProvider, WebhookEvent } from './payment-provider';

// Оплата выключена: вне dev/test без PAYOS_*. QR не выдаётся, ни один webhook не принимается.
export class DisabledProvider implements PaymentProvider {
  readonly name = 'disabled' as const;

  async createPayment(): Promise<CreatedPayment> {
    throw new Error('Online payment is not configured (PAYOS_*)');
  }

  verifyWebhook(): WebhookEvent | null {
    return null;
  }
}
