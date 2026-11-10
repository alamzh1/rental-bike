import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AcceptContractResponse, AuthResponse, Booking } from '@rental/shared';
import { RateLimiter } from '../../src/bookings/rate-limit';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Подтверждение договора клиентом в приложении (ТЗ §11.1).

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const storageDir = mkdtempSync(join(tmpdir(), 'rental-storage-'));
const envBackup = { ...process.env };

type U = { token: string; userId: string };
let alice: U;
let bob: U;
let model = '';
const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });

const base = new Date(Math.ceil(Date.now() / H) * H + 10 * 24 * H);
let slot = 0;

async function login(telegramId: number): Promise<U> {
  const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: telegramId, first_name: 'T', language_code: 'en' }) });
  expect(res.status).toBe(200);
  const body = res.body as AuthResponse;
  return { token: body.token, userId: body.user.id };
}

/** Бронь наличными — сразу CONFIRMED. */
async function cashBooking(u: U = alice): Promise<Booking> {
  const start = new Date(base.getTime() + slot++ * 3 * 24 * H);
  const res = await http()
    .post('/api/bookings')
    .set(auth(u))
    .send({ modelId: model, startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString(), paymentMethod: 'CASH', phone: '+84901234567', agreed: true });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as Booking;
}

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = '';
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_DIR = storageDir;
  await resetDb(prisma);
  await createSettings(prisma, { cashPrepayPercent: 0 });
  const loc = await createLocation(prisma);
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [180_000, 160_000, 140_000, 120_000] as [number, number, number, number], rating: 4.8, popularity: 1 };
  model = (await createModel(prisma, loc.id, { ...spec, key: 'contract', name: 'Air Blade', deposit: 1_000_000, bikes: [{}, {}] })).model.id;
  app = await createApp();
  alice = await login(7101);
  bob = await login(7102);
});

beforeEach(() => app.get(RateLimiter).reset());

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
  rmSync(storageDir, { recursive: true, force: true });
});

describe('POST /bookings/:id/contract/accept', () => {
  it('новая бронь ещё не подтверждена; владелец подтверждает, отметка видна в брони', async () => {
    const b = await cashBooking();
    expect(b.contractAcceptedAt).toBeNull();
    const res = await http().post(`/api/bookings/${b.id}/contract/accept`).set(auth(alice));
    expect(res.status).toBe(200);
    const at = (res.body as AcceptContractResponse).contractAcceptedAt;
    expect(Number.isNaN(Date.parse(at))).toBe(false);
    const after = await http().get(`/api/bookings/${b.id}`).set(auth(alice));
    expect((after.body as Booking).contractAcceptedAt).toBe(at);
  });

  it('повторное подтверждение возвращает ту же отметку', async () => {
    const b = await cashBooking();
    const first = await http().post(`/api/bookings/${b.id}/contract/accept`).set(auth(alice));
    const second = await http().post(`/api/bookings/${b.id}/contract/accept`).set(auth(alice));
    expect(second.status).toBe(200);
    expect(second.body.contractAcceptedAt).toBe(first.body.contractAcceptedAt);
  });

  it('чужая бронь → 404, отметка не ставится; без сессии → 401', async () => {
    const b = await cashBooking();
    expect((await http().post(`/api/bookings/${b.id}/contract/accept`).set(auth(bob))).status).toBe(404);
    expect((await http().post(`/api/bookings/${b.id}/contract/accept`)).status).toBe(401);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).contractAcceptedAt).toBeNull();
  });

  it('отменённая бронь → 409 INVALID_TRANSITION', async () => {
    const b = await cashBooking();
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'CANCELLED_BY_CLIENT', cancelledAt: new Date() } });
    const res = await http().post(`/api/bookings/${b.id}/contract/accept`).set(auth(alice));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });
});
