import { createHmac } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PayOsProvider, type PayOsConfig } from '../src/payments/payos-provider';
import { createPaymentProvider } from '../src/payments/payments.module';
import { webhookIpAllowed } from '../src/payments/webhook-ip';

// payOS: подпись запроса и webhook (HMAC-SHA256 ключом PAYOS_CHECKSUM_KEY). Ожидаемые строки для подписи
// выписаны вручную по документации payOS; ключ — тестовый, не секрет.
const KEY = 'test-checksum-key';
const cfg: PayOsConfig = { clientId: 'cid', apiKey: 'akey', checksumKey: KEY, apiUrl: 'https://payos.test', returnUrl: 'https://app.test', cancelUrl: 'https://app.test' };
const hmac = (s: string) => createHmac('sha256', KEY).update(s).digest('hex');

const data = {
  orderCode: 1000101,
  amount: 180000,
  description: 'BK-10001',
  accountNumber: '12345678',
  reference: 'TF230204212323',
  transactionDateTime: '2026-11-01 18:25:00',
  currency: 'VND',
  paymentLinkId: 'abc',
  code: '00',
  desc: 'success',
  counterAccountBankId: '',
  counterAccountName: null,
};
const canonical =
  'accountNumber=12345678&amount=180000&code=00&counterAccountBankId=&counterAccountName=&currency=VND&desc=success&description=BK-10001&orderCode=1000101&paymentLinkId=abc&reference=TF230204212323&transactionDateTime=2026-11-01 18:25:00';

describe('PayOsProvider.verifyWebhook', () => {
  const provider = new PayOsProvider(cfg, vi.fn());

  it('верная подпись → событие оплаты с внешним ID = orderCode и суммой', () => {
    const ev = provider.verifyWebhook({ body: { code: '00', desc: 'success', success: true, data, signature: hmac(canonical) }, headers: {} });
    expect(ev).toMatchObject({ externalId: '1000101', amount: 180000, paid: true });
  });

  it('неверная подпись или изменённая сумма → null', () => {
    expect(provider.verifyWebhook({ body: { code: '00', success: true, data, signature: 'f'.repeat(64) }, headers: {} })).toBeNull();
    expect(provider.verifyWebhook({ body: { code: '00', success: true, data: { ...data, amount: 1 }, signature: hmac(canonical) }, headers: {} })).toBeNull();
    expect(provider.verifyWebhook({ body: { data }, headers: {} })).toBeNull();
  });
});

describe('PayOsProvider.createPayment', () => {
  it('подписывает запрос и отдаёт QR и ссылку оплаты', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ code: '00', desc: 'ok', data: { qrCode: '000201010212', checkoutUrl: 'https://pay.payos.vn/web/abc' } }), { status: 200 }));
    const provider = new PayOsProvider(cfg, fetchMock as unknown as typeof fetch);
    const expiresAt = new Date('2026-11-01T10:15:00Z');
    const r = await provider.createPayment({ paymentId: 'p', bookingId: 'b', bookingCode: 'BK-10001', orderCode: 1000101, amount: 180000, description: 'BK-10001', expiresAt });
    expect(r).toEqual({ externalId: '1000101', qrPayload: '000201010212', deeplink: 'https://pay.payos.vn/web/abc', expiresAt });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://payos.test/v2/payment-requests');
    expect((init.headers as Record<string, string>)['x-client-id']).toBe('cid');
    const body = JSON.parse(init.body as string);
    expect(body.description).toBe('BK-10001');
    expect(body.expiredAt).toBe(Math.floor(expiresAt.getTime() / 1000));
    expect(body.signature).toBe(hmac('amount=180000&cancelUrl=https://app.test&description=BK-10001&orderCode=1000101&returnUrl=https://app.test'));
  });

  it('ошибка payOS → исключение', async () => {
    const provider = new PayOsProvider(cfg, (async () => new Response(JSON.stringify({ code: '20', desc: 'bad' }), { status: 200 })) as unknown as typeof fetch);
    await expect(provider.createPayment({ paymentId: 'p', bookingId: 'b', bookingCode: 'BK-1', orderCode: 1, amount: 1, description: 'BK-1', expiresAt: new Date() })).rejects.toThrow(/payOS/);
  });
});

describe('выбор провайдера и IP webhook', () => {
  it('PAYOS_* заданы → payOS, иначе тестовый', () => {
    expect(createPaymentProvider({ PAYOS_CLIENT_ID: 'a', PAYOS_API_KEY: 'b', PAYOS_CHECKSUM_KEY: 'c' }).name).toBe('payos');
    expect(createPaymentProvider({ PAYOS_CLIENT_ID: 'a', NODE_ENV: 'development' }).name).toBe('test');
    expect(createPaymentProvider({ NODE_ENV: 'test' }).name).toBe('test');
    expect(createPaymentProvider({ NODE_ENV: 'production' }).name).toBe('disabled');
    expect(createPaymentProvider({}).name).toBe('disabled');
  });

  it('PAYOS_WEBHOOK_IPS: пусто — любой IP; задан — только из списка', () => {
    expect(webhookIpAllowed('1.2.3.4', {})).toBe(true);
    expect(webhookIpAllowed('::ffff:1.2.3.4', { PAYOS_WEBHOOK_IPS: '5.6.7.8, 1.2.3.4' })).toBe(true);
    expect(webhookIpAllowed('9.9.9.9', { PAYOS_WEBHOOK_IPS: '5.6.7.8,1.2.3.4' })).toBe(false);
  });
});
