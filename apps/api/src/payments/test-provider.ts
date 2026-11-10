import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { CreatedPayment, PaymentProvider, PaymentRequest, WebhookEvent, WebhookRequest } from './payment-provider';

// Тестовый провайдер (dev, без аккаунтов): QR-заглушка, оплата — POST /dev/payments/{id}/pay.
// Webhook подписывается тем же HMAC, что и `simulate` — ключ не секрет, работает только в dev.
export const TEST_PROVIDER_KEY = 'rental-test-provider';

/** Тестовый провайдер и /dev/payments — только при NODE_ENV=development|test. */
export function testProviderAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === 'development' || env.NODE_ENV === 'test';
}

export interface TestWebhookBody {
  externalId: string;
  amount: number;
  signature: string;
}

const sign = (externalId: string, amount: number) => createHmac('sha256', TEST_PROVIDER_KEY).update(`${externalId}|${amount}`).digest('hex');

export class TestProvider implements PaymentProvider {
  readonly name = 'test' as const;

  async createPayment(req: PaymentRequest): Promise<CreatedPayment> {
    const externalId = `test-${req.orderCode}-${randomBytes(4).toString('hex')}`;
    return { externalId, qrPayload: `TESTQR|${req.description}|${req.amount}|VND`, deeplink: null, expiresAt: req.expiresAt };
  }

  /** Тело webhook, как его прислал бы провайдер. */
  simulate(externalId: string, amount: number): TestWebhookBody {
    return { externalId, amount, signature: sign(externalId, amount) };
  }

  verifyWebhook(req: WebhookRequest): WebhookEvent | null {
    if (!testProviderAllowed()) return null;
    const b = (req.body ?? {}) as Partial<TestWebhookBody>;
    if (typeof b.externalId !== 'string' || typeof b.amount !== 'number' || typeof b.signature !== 'string') return null;
    const expected = Buffer.from(sign(b.externalId, b.amount));
    const given = Buffer.from(b.signature);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    return { externalId: b.externalId, amount: b.amount, paid: true, raw: req.body };
  }
}
