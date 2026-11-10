import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { AuthResponse, Booking } from '@rental/shared';
import { AlertService } from '../../src/notifications/alert.service';
import { PAYMENT_PROVIDER, type PaymentProvider } from '../../src/payments/payment-provider';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// История 87: сбой платёжного провайдера при создании QR (PAYMENT_PROVIDER_ERROR) — алерт администратору.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
let app: INestApplication;
const http = () => request(app.getHttpServer());
let token = '';
let booking: Booking;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = '';
  for (const k of ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY', 'PAYOS_WEBHOOK_IPS']) delete process.env[k];
  await resetDb(prisma);
  await createSettings(prisma, { depositMode: 'DOCUMENT', holdMinutes: 15 });
  const loc = await createLocation(prisma);
  const { model } = await createModel(prisma, loc.id, {
    key: 'alert', brand: 'Honda', name: 'Air Blade', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125,
    features: [], prices: [180_000, 160_000, 140_000, 120_000], rating: 4.8, popularity: 1, bikes: [{}],
  });
  app = await createApp();
  const login = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 7101, first_name: 'P', language_code: 'en' }) });
  token = (login.body as AuthResponse).token;
  const start = new Date(Math.ceil(Date.now() / 3_600_000) * 3_600_000 + 5 * 86_400_000);
  const res = await http()
    .post('/api/bookings')
    .set({ Authorization: `Bearer ${token}` })
    .send({ modelId: model.id, startAt: start.toISOString(), endAt: new Date(start.getTime() + 86_400_000).toISOString(), paymentMethod: 'VIETQR', phone: '+84901234567', agreed: true });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  booking = res.body as Booking;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('сбой createPayment', () => {
  it('→ 502 PAYMENT_PROVIDER_ERROR и алерт с кодом брони', async () => {
    const provider = app.get<PaymentProvider>(PAYMENT_PROVIDER);
    const create = vi.spyOn(provider, 'createPayment').mockRejectedValueOnce(new Error('payOS 500'));
    const alert = vi.spyOn(app.get(AlertService), 'alert').mockResolvedValue(undefined);
    const res = await http().post(`/api/bookings/${booking.id}/pay`).set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(502);
    expect(res.body.code).toBe('PAYMENT_PROVIDER_ERROR');
    expect(create).toHaveBeenCalledTimes(1);
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0]![0]).toContain(booking.code);
    expect(alert.mock.calls[0]![0]).toContain('payOS 500');
  });

  it('успешная попытка после сбоя — без алерта', async () => {
    const alert = vi.spyOn(app.get(AlertService), 'alert').mockClear();
    const res = await http().post(`/api/bookings/${booking.id}/pay`).set({ Authorization: `Bearer ${token}` });
    expect(res.status).toBe(200);
    expect(alert).not.toHaveBeenCalled();
  });
});
