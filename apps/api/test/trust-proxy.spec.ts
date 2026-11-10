import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { applyTrustProxy, trustProxySetting } from '../src/auth/trust-proxy';

// Webhook за обратным прокси (история 86): API за nginx на той же машине получает соединение с 127.0.0.1,
// а адрес отправителя — из X-Forwarded-For. 203.0.113.10 — адрес из документационного диапазона (RFC 5737).
const PAYOS_IP = '203.0.113.10';
const envBackup = { ...process.env };

describe('trustProxySetting', () => {
  it.each([
    [undefined, 'loopback'],
    ['', 'loopback'],
    ['loopback', 'loopback'],
    ['1', 1],
    ['true', true],
    ['false', false],
    ['loopback, 10.0.0.0/8', 'loopback, 10.0.0.0/8'],
  ])('TRUST_PROXY=%s → %s', (value, expected) => {
    expect(trustProxySetting({ TRUST_PROXY: value })).toEqual(expected);
  });
});

describe('POST /api/webhooks/payos за прокси на loopback', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    process.env.PAYOS_WEBHOOK_IPS = PAYOS_IP;
    delete process.env.TRUST_PROXY;
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    applyTrustProxy(app);
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    process.env = envBackup;
  });

  it('X-Forwarded-For из списка → проходит проверку IP (дальше — проверка подписи, 400)', async () => {
    const res = await request(app.getHttpServer()).post('/api/webhooks/payos').set('X-Forwarded-For', PAYOS_IP).send({});
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
  });

  it('X-Forwarded-For не из списка → 403', async () => {
    const res = await request(app.getHttpServer()).post('/api/webhooks/payos').set('X-Forwarded-For', '198.51.100.7').send({});
    expect(res.status).toBe(403);
  });

  it('подделка: клиент дописал IP payOS первым, прокси добавил настоящий адрес → 403', async () => {
    const res = await request(app.getHttpServer()).post('/api/webhooks/payos').set('X-Forwarded-For', `${PAYOS_IP}, 198.51.100.7`).send({});
    expect(res.status).toBe(403);
  });
});
