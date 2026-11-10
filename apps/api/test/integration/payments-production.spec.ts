import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthResponse, Booking } from '@rental/shared';
import { TestProvider } from '../../src/payments/test-provider';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// NODE_ENV=production без PAYOS_*: тестовый провайдер не активен — оплата недоступна (503),
// webhook, подписанный открытым ключом тестового провайдера, отклоняется (400), бронь не подтверждается.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
let app: INestApplication;
const http = () => request(app.getHttpServer());
let token = '';
let booking: Booking;

beforeAll(async () => {
  process.env.NODE_ENV = 'production';
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = '';
  for (const k of ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY', 'PAYOS_WEBHOOK_IPS']) delete process.env[k];
  await resetDb(prisma);
  await createSettings(prisma, { depositMode: 'DOCUMENT' });
  const loc = await createLocation(prisma);
  const { model } = await createModel(prisma, loc.id, {
    key: 'prod', brand: 'Honda', name: 'Air Blade', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125,
    features: [], prices: [180_000, 160_000, 140_000, 120_000], rating: 4.8, popularity: 1, bikes: [{}],
  });
  app = await createApp();
  const login = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 7001, first_name: 'P', language_code: 'en' }) });
  token = (login.body as AuthResponse).token;
  const start = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 5 * 86_400_000);
  const res = await http()
    .post('/api/bookings')
    .set({ Authorization: `Bearer ${token}` })
    .send({ modelId: model.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + 86_400_000).toISOString(), paymentMethod: 'VIETQR', phone: '+84901234567', agreed: true });
  expect(res.status).toBe(201);
  booking = res.body as Booking;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('production без PAYOS_*', () => {
  it('POST /bookings/{id}/pay → 503 PAYMENT_NOT_AVAILABLE, фальшивый QR не выдаётся', async () => {
    const res = await http().post(`/api/bookings/${booking.id}/pay`).set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('PAYMENT_NOT_AVAILABLE');
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(0);
  });

  it('webhook, подписанный ключом тестового провайдера, → 400, бронь не подтверждена', async () => {
    // Подделка: платёж с внешним ID, как если бы его выдал тестовый провайдер
    const p = await prisma.payment.create({ data: { bookingId: booking.id, kind: 'RENT', method: 'VIETQR', provider: 'test', amount: 180_000, externalId: 'test-forged-1' } });
    const forged = new TestProvider().simulate(p.externalId!, 180_000);
    const res = await http().post('/api/webhooks/payos').send(forged);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status).toBe('PENDING_PAYMENT');
    expect((await prisma.payment.findUniqueOrThrow({ where: { id: p.id } })).status).toBe('PENDING');
  });

  it('POST /dev/payments/{id}/pay → 404', async () => {
    const p = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    expect((await http().post(`/api/dev/payments/${p.id}/pay`).set({ Authorization: `Bearer ${token}` }).send({})).status).toBe(404);
  });
});
