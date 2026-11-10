import { createHmac, timingSafeEqual } from 'node:crypto';
import type { CreatedPayment, PaymentProvider, PaymentRequest, WebhookEvent, WebhookRequest } from './payment-provider';

// payOS (VietQR): создание ссылки оплаты и проверка подписи webhook (HMAC-SHA256 ключом PAYOS_CHECKSUM_KEY).
// Документация: https://payos.vn/docs — подпись запроса: amount, cancelUrl, description, orderCode, returnUrl;
// подпись webhook: все поля `data`, отсортированные по имени, `key=value` через `&`.

export interface PayOsConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  apiUrl: string;
  returnUrl: string;
  cancelUrl: string;
}

export function payOsConfigFromEnv(env: NodeJS.ProcessEnv = process.env): PayOsConfig | null {
  const { PAYOS_CLIENT_ID, PAYOS_API_KEY, PAYOS_CHECKSUM_KEY } = env;
  if (!PAYOS_CLIENT_ID || !PAYOS_API_KEY || !PAYOS_CHECKSUM_KEY) return null;
  const back = env.MINIAPP_URL || env.API_PUBLIC_URL || 'http://localhost';
  return { clientId: PAYOS_CLIENT_ID, apiKey: PAYOS_API_KEY, checksumKey: PAYOS_CHECKSUM_KEY, apiUrl: env.PAYOS_API_URL || 'https://api-merchant.payos.vn', returnUrl: back, cancelUrl: back };
}

/** Каноническая строка для подписи данных webhook. */
export function payOsDataString(data: Record<string, unknown>): string {
  return Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k];
      const s = v === null || v === undefined || v === 'null' || v === 'undefined' ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
      return `${k}=${s}`;
    })
    .join('&');
}

const hmac = (key: string, s: string) => createHmac('sha256', key).update(s).digest('hex');

function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a.toLowerCase());
  const y = Buffer.from(b.toLowerCase());
  return x.length === y.length && timingSafeEqual(x, y);
}

type Fetch = typeof fetch;

export class PayOsProvider implements PaymentProvider {
  readonly name = 'payos' as const;

  constructor(
    private readonly cfg: PayOsConfig,
    private readonly http: Fetch = fetch,
  ) {}

  async createPayment(req: PaymentRequest): Promise<CreatedPayment> {
    const description = req.description.slice(0, 25);
    const { returnUrl, cancelUrl } = this.cfg;
    const signature = hmac(this.cfg.checksumKey, `amount=${req.amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${req.orderCode}&returnUrl=${returnUrl}`);
    const res = await this.http(`${this.cfg.apiUrl.replace(/\/$/, '')}/v2/payment-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': this.cfg.clientId, 'x-api-key': this.cfg.apiKey },
      body: JSON.stringify({
        orderCode: req.orderCode,
        amount: req.amount,
        description,
        returnUrl,
        cancelUrl,
        expiredAt: Math.floor(req.expiresAt.getTime() / 1000),
        signature,
      }),
    });
    const json = (await res.json().catch(() => null)) as { code?: string; desc?: string; data?: { qrCode?: string; checkoutUrl?: string } | null } | null;
    if (!res.ok || json?.code !== '00' || !json.data?.qrCode) throw new Error(`payOS: ${res.status} ${json?.code ?? ''} ${json?.desc ?? ''}`.trim());
    return { externalId: String(req.orderCode), qrPayload: json.data.qrCode, deeplink: json.data.checkoutUrl ?? null, expiresAt: req.expiresAt };
  }

  /** Сообщить payOS адрес webhook канала: payOS шлёт туда пробное событие и запоминает адрес, если ответ 2xx. Заодно проверяет ключи. */
  async confirmWebhook(webhookUrl: string): Promise<void> {
    const res = await this.http(`${this.cfg.apiUrl.replace(/\/$/, '')}/confirm-webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-client-id': this.cfg.clientId, 'x-api-key': this.cfg.apiKey },
      body: JSON.stringify({ webhookUrl }),
    });
    if (!res.ok) throw new Error(`payOS: ${res.status}`);
  }

  verifyWebhook(req: WebhookRequest): WebhookEvent | null {
    const body = (req.body ?? {}) as { code?: string; success?: boolean; data?: Record<string, unknown>; signature?: string };
    if (!body.data || typeof body.data !== 'object' || typeof body.signature !== 'string') return null;
    if (!safeEqualHex(hmac(this.cfg.checksumKey, payOsDataString(body.data)), body.signature)) return null;
    const amount = Number(body.data.amount);
    const orderCode = body.data.orderCode;
    if (!Number.isFinite(amount) || (typeof orderCode !== 'number' && typeof orderCode !== 'string')) return null;
    const paid = body.code === '00' && body.success !== false && (body.data.code === undefined || body.data.code === '00');
    return { externalId: String(orderCode), amount: Math.round(amount), paid, raw: req.body };
  }
}
