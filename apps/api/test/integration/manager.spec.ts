import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthResponse, Booking, HandoverResponse, ManagerBookingDetail, ManagerTodayResponse, ReturnResponse } from '@rental/shared';
import { Clock } from '../../src/jobs/clock';
import { RateLimiter } from '../../src/bookings/rate-limit';
import { AvailabilityService } from '../../src/availability/availability.service';
import { STORAGE, type Storage } from '../../src/documents/storage/storage';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Таск 09: режим менеджера. Суммы вручную: сутки = 180 000 ₫, депозит 1 000 000 ₫, опоздание 2 ч при льготе 60 мин и 30 000 ₫/ч → 30 000 ₫.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
let clock: Clock;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const storageDir = mkdtempSync(join(tmpdir(), 'rental-storage-'));
const envBackup = { ...process.env };

type U = { token: string; userId: string };
let alice: U;
let bob: U;
let manager: U;
let outsider: U; // менеджер другой точки
let admin: U;
let locationId = '';
let model = '';
let bikeIds: string[] = [];
const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });

const base = new Date(Math.ceil(Date.now() / H) * H + 10 * 24 * H);
let slot = 0;
const nextPeriod = () => {
  const start = new Date(base.getTime() + slot++ * 3 * 24 * H);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString(), end: new Date(start.getTime() + 24 * H) };
};

async function login(telegramId: number): Promise<U> {
  const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: telegramId, first_name: 'T', language_code: 'en' }) });
  expect(res.status).toBe(200);
  const body = res.body as AuthResponse;
  return { token: body.token, userId: body.user.id };
}

/** Бронь наличными (CONFIRMED сразу) на следующий свободный период. */
async function cashBooking(u: U = alice) {
  const p = nextPeriod();
  const res = await http().post('/api/bookings').set(auth(u)).send({ modelId: model, startAt: p.startAt, endAt: p.endAt, paymentMethod: 'CASH', phone: '+84901234567', agreed: true });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return { booking: res.body as Booking, end: p.end };
}

const photos = (id: string, n: number) => Array.from({ length: n }, (_, i) => `acts/${id}/p${i}`);
const handoverBody = (id: string, over: Record<string, unknown> = {}) => ({ bikeId: bikeIds[0], mileageKm: 1000, fuelLevel: 80, photos: photos(id, 4), ...over });
const status = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

async function issue(b: Booking): Promise<void> {
  const h = await http().post(`/api/manager/bookings/${b.id}/handover`).set(auth(manager)).send(handoverBody(b.id, { bikeId: (await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).bikeId }));
  expect(h.status, JSON.stringify(h.body)).toBe(201);
  const c = await http().post(`/api/bookings/${b.id}/handover/${(h.body as HandoverResponse).actId}/confirm`).set(auth(alice));
  expect(c.status).toBe(200);
}

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = '';
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_DIR = storageDir;
  await resetDb(prisma);
  await createSettings(prisma, { holdMinutes: 15, noShowHours: 3, cashPrepayPercent: 0, depositMode: 'MONEY', late: { graceMinutes: 60, hourlyFee: 30_000, extraDayAfterHours: 4 } });
  const loc = await createLocation(prisma);
  locationId = loc.id;
  const other = await createLocation(prisma);
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [180_000, 160_000, 140_000, 120_000] as [number, number, number, number], rating: 4.8, popularity: 1 };
  const made = await createModel(prisma, loc.id, { ...spec, key: 'mgr', name: 'Air Blade', deposit: 1_000_000, bikes: [{}, {}, {}] });
  model = made.model.id;
  bikeIds = made.bikes.map((b) => b.id);
  app = await createApp();
  // Здесь проверяются правила актов; что файл действительно загружен — в bike-missing.spec
  vi.spyOn(app.get<Storage>(STORAGE), 'exists').mockResolvedValue(true);
  clock = app.get(Clock);
  alice = await login(7001);
  bob = await login(7002);
  manager = await login(7003);
  outsider = await login(7004);
  admin = await login(7005);
  await prisma.user.update({ where: { id: manager.userId }, data: { role: 'MANAGER', locationId } });
  await prisma.user.update({ where: { id: outsider.userId }, data: { role: 'MANAGER', locationId: other.id } });
  await prisma.user.update({ where: { id: admin.userId }, data: { role: 'ADMIN' } });
});

beforeEach(() => {
  app.get(RateLimiter).reset();
  clock.now = () => new Date();
});
afterEach(() => {
  clock.now = () => new Date();
});
afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
  rmSync(storageDir, { recursive: true, force: true });
});

describe('доступ', () => {
  it('клиент → 403, без сессии → 401', async () => {
    for (const path of ['/api/manager/today', '/api/manager/bikes']) {
      expect((await http().get(path).set(auth(alice))).status).toBe(403);
      expect((await http().get(path)).status).toBe(401);
    }
    expect((await http().post('/api/manager/bookings/x/cash').set(auth(alice)).send({ amount: 1 })).status).toBe(403);
    expect((await http().patch(`/api/manager/bikes/${bikeIds[0]}`).set(auth(alice)).send({ status: 'REPAIR' })).status).toBe(403);
  });

  it('QR чужой точки → 403 WRONG_LOCATION, администратор видит любую', async () => {
    const { booking } = await cashBooking();
    const res = await http().get(`/api/manager/bookings/${booking.code}`).set(auth(outsider));
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('WRONG_LOCATION');
    expect((await http().get(`/api/manager/bookings/${booking.code}`).set(auth(admin))).status).toBe(200);
  });
});

describe('список и QR', () => {
  it('выдачи на сегодня и поиск по тексту QR', async () => {
    const { booking } = await cashBooking();
    await prisma.booking.update({ where: { id: booking.id }, data: { startAt: new Date(Date.now() - 10 * 60_000), endAt: new Date(Date.now() + 24 * H) } });
    const today = (await http().get('/api/manager/today').set(auth(manager))).body as ManagerTodayResponse;
    const card = today.issues.find((c) => c.id === booking.id);
    expect(card?.overdue).toBe(true);
    expect(card?.cashDue).toBe(180_000 + 1_000_000);
    const qr = await http().get(`/api/manager/bookings/${encodeURIComponent(`https://t.me/bot/app?startapp=${booking.code.toLowerCase()}`)}`).set(auth(manager));
    expect(qr.status).toBe(200);
    const detail = qr.body as ManagerBookingDetail;
    expect(detail.card.id).toBe(booking.id);
    expect(detail.freeBikes.length).toBe(3);
  });
});

describe('выдача', () => {
  it('меньше 4 фото → 400 PHOTOS_COUNT, больше 8 → тоже; чужой ключ фото отклоняется', async () => {
    const { booking } = await cashBooking();
    const send = (body: object) => http().post(`/api/manager/bookings/${booking.id}/handover`).set(auth(manager)).send(body);
    const few = await send(handoverBody(booking.id, { photos: photos(booking.id, 3) }));
    expect([few.status, few.body.code]).toEqual([400, 'PHOTOS_COUNT']);
    expect((await send(handoverBody(booking.id, { photos: photos(booking.id, 9) }))).body.code).toBe('PHOTOS_COUNT');
    expect((await send(handoverBody(booking.id, { photos: photos('other', 4) }))).status).toBe(400);
    expect(await status(booking.id)).toBe('CONFIRMED');
  });

  it('бронь становится «Выдана» только после подтверждения клиентом-владельцем', async () => {
    const { booking } = await cashBooking();
    const h = await http().post(`/api/manager/bookings/${booking.id}/handover`).set(auth(manager)).send(handoverBody(booking.id));
    expect(h.status).toBe(201);
    const actId = (h.body as HandoverResponse).actId;
    expect(await status(booking.id)).toBe('CONFIRMED');
    expect((await http().post(`/api/bookings/${booking.id}/handover/${actId}/confirm`).set(auth(bob))).status).toBe(404);
    const ok = await http().post(`/api/bookings/${booking.id}/handover/${actId}/confirm`).set(auth(alice));
    expect(ok.status).toBe(200);
    expect(ok.body.status).toBe('ISSUED');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).actualStartAt).not.toBeNull();
    expect((await http().post(`/api/bookings/${booking.id}/handover/${actId}/confirm`).set(auth(alice))).status).toBe(200);
    const acts = await http().get(`/api/bookings/${booking.id}/handover`).set(auth(alice));
    expect(acts.body.acts[0].photoUrls).toHaveLength(4);
  });

  it('другой байк модели назначается; занятый или чужой модели → 409 BIKE_NOT_AVAILABLE', async () => {
    const { booking } = await cashBooking();
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    const other = bikeIds.find((id) => id !== row.bikeId)!;
    const res = await http().post(`/api/manager/bookings/${booking.id}/handover`).set(auth(manager)).send(handoverBody(booking.id, { bikeId: other }));
    expect(res.status).toBe(201);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).bikeId).toBe(other);
    // тот же период занят другой бронью на третьем байке
    const second = await prisma.booking.create({ data: { code: `X-${Date.now()}`, userId: bob.userId, modelId: model, locationId, bikeId: row.bikeId, startAt: row.startAt, endAt: row.endAt, status: 'CONFIRMED', paymentMethod: 'CASH', lang: 'en', rentAmount: 0, totalAmount: 0, quote: {} } });
    const busy = await http().post(`/api/manager/bookings/${booking.id}/handover`).set(auth(manager)).send(handoverBody(booking.id, { bikeId: row.bikeId }));
    expect([busy.status, busy.body.code]).toEqual([409, 'BIKE_NOT_AVAILABLE']);
    await prisma.booking.delete({ where: { id: second.id } });
  });
});

describe('документы', () => {
  it('решение по документу менеджеру недоступно: проверяет администратор', async () => {
    const doc = await prisma.document.create({ data: { userId: alice.userId, type: 'PASSPORT', fileKey: `documents/${alice.userId}/p`, contentType: 'image/jpeg' } });
    const { booking } = await cashBooking();
    await prisma.booking.update({ where: { id: booking.id }, data: { locationId } });
    const res = await http().post(`/api/manager/documents/${doc.id}/verify`).set(auth(manager)).send({ status: 'VERIFIED' });
    expect(res.status).toBe(404);
    expect((await prisma.document.findUniqueOrThrow({ where: { id: doc.id } })).status).toBe('UPLOADED');
  });
});

describe('наличные', () => {
  it('платёж с методом CASH и суммой; доплата закрывает ожидающую запись', async () => {
    const { booking } = await cashBooking();
    const res = await http().post(`/api/manager/bookings/${booking.id}/cash`).set(auth(manager)).send({ amount: 180_000, kind: 'RENT' });
    expect(res.status).toBe(201);
    expect(res.body.paidAmount).toBe(180_000);
    const p = await prisma.payment.findUniqueOrThrow({ where: { id: res.body.paymentId } });
    expect([p.method, p.kind, p.status, p.amount, p.createdById]).toEqual(['CASH', 'RENT', 'PAID', 180_000, manager.userId]);
    expect((await http().post(`/api/manager/bookings/${booking.id}/cash`).set(auth(manager)).send({ amount: 0 })).status).toBe(400);
  });
});

describe('возврат', () => {
  it('опоздание 2 ч → доплата 30 000 ₫, удержание 200 000 ₫ → к возврату 800 000 ₫, бронь «Завершена»', async () => {
    const { booking, end } = await cashBooking();
    const cash = (amount: number, kind: string) => http().post(`/api/manager/bookings/${booking.id}/cash`).set(auth(manager)).send({ amount, kind });
    await cash(180_000, 'RENT');
    await cash(1_000_000, 'DEPOSIT');
    await issue(booking);
    clock.now = () => new Date(end.getTime() + 2 * H);
    const preview = (await http().get(`/api/manager/bookings/${booking.id}`).set(auth(manager))).body as ManagerBookingDetail;
    expect(preview.lateFee).toEqual({ amount: 30_000, minutesLate: 120 });

    const send = (body: object) => http().post(`/api/manager/bookings/${booking.id}/return`).set(auth(manager)).send(body);
    const ret = { mileageKm: 1200, fuelLevel: 50, photos: photos(booking.id, 5), damages: 'scratch' };
    expect((await send({ ...ret, mileageKm: 900 })).body.code).toBe('MILEAGE_LOWER');
    expect((await send({ ...ret, deductions: [{ amount: 1_100_000, reason: 'mirror' }] })).body.code).toBe('DEDUCTION_TOO_LARGE');
    expect((await send({ ...ret, photos: photos(booking.id, 2) })).body.code).toBe('PHOTOS_COUNT');

    const res = await send({ ...ret, deductions: [{ amount: 200_000, reason: 'mirror', photos: photos(booking.id, 1) }] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body as ReturnResponse).toMatchObject({ lateFeeAmount: 30_000, deductionsTotal: 200_000, depositRefund: 800_000 });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect([row.status, row.lateFeeAmount]).toEqual(['COMPLETED', 30_000]);
    expect((await prisma.bike.findUniqueOrThrow({ where: { id: row.bikeId } })).mileageKm).toBe(1200);
    expect(await prisma.payment.count({ where: { bookingId: booking.id, kind: 'REFUND', amount: 800_000, status: 'PENDING' } })).toBe(1);
    expect((await send(ret)).status).toBe(409);

    const before = await prisma.payment.count({ where: { bookingId: booking.id } });
    expect((await cash(30_000, 'SURCHARGE')).status).toBe(201);
    expect(await prisma.payment.count({ where: { bookingId: booking.id } })).toBe(before);
    const client = (await http().get(`/api/bookings/${booking.id}/handover`).set(auth(alice))).body;
    expect([client.depositRefund, client.deductions[0].reason, client.deductions[0].photoUrls.length]).toEqual([800_000, 'mirror', 1]);
  });

  it('оплата переводом в рублях: менеджер принимает депозит наличными и наличными возвращает', async () => {
    const { booking } = await cashBooking();
    await prisma.booking.update({ where: { id: booking.id }, data: { paymentMethod: 'RUB_TRANSFER' } });
    await prisma.payment.create({ data: { bookingId: booking.id, kind: 'RENT', method: 'RUB_TRANSFER', provider: 'manual', amount: 180_000, receivedAmount: 180_000, status: 'PAID', paidAt: new Date(), rubAmount: 650, rubRate: 0.0036 } });
    const detail = (await http().get(`/api/manager/bookings/${booking.id}`).set(auth(manager))).body as ManagerBookingDetail;
    expect(detail.card.cashDue).toBe(1_000_000);
    expect((await http().post(`/api/manager/bookings/${booking.id}/cash`).set(auth(manager)).send({ amount: 1_000_000, kind: 'DEPOSIT' })).status).toBe(201);
    await issue(booking);
    const res = await http().post(`/api/manager/bookings/${booking.id}/return`).set(auth(manager)).send({ mileageKm: 1200, fuelLevel: 50, photos: photos(booking.id, 5) });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((res.body as ReturnResponse).depositRefund).toBe(1_000_000);
    const refund = await prisma.payment.findFirstOrThrow({ where: { bookingId: booking.id, kind: 'REFUND' } });
    expect([refund.method, refund.amount]).toEqual(['CASH', 1_000_000]);
  });

  it('возврат невыданной брони → 409', async () => {
    const { booking } = await cashBooking();
    const res = await http().post(`/api/manager/bookings/${booking.id}/return`).set(auth(manager)).send({ mileageKm: 1, fuelLevel: 1, photos: photos(booking.id, 4) });
    expect(res.status).toBe(409);
  });
});

describe('неявка и ремонт', () => {
  it('«Не пришёл» → отмена системой, причина «неявка»', async () => {
    const { booking } = await cashBooking();
    expect((await http().post(`/api/manager/bookings/${booking.id}/no-show`).set(auth(outsider))).status).toBe(403);
    const res = await http().post(`/api/manager/bookings/${booking.id}/no-show`).set(auth(manager));
    expect(res.status).toBe(200);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } });
    expect([row.status, row.cancelReason]).toEqual(['CANCELLED_BY_SYSTEM', 'NO_SHOW']);
  });

  it('байк в «Ремонте» пропадает из доступности до даты готовности', async () => {
    const solo = (await createModel(prisma, locationId, { brand: 'Yamaha', key: 'solo', name: 'Solo', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: [], prices: [1, 1, 1, 1], rating: 4, popularity: 1, bikes: [{}] }, 2));
    const from = new Date(Date.now() + 2 * 24 * H);
    const to = new Date(from.getTime() + 24 * H);
    const avail = app.get(AvailabilityService);
    expect(await avail.freeBikeCount(solo.model.id, from, to)).toBe(1);
    const readyAt = new Date(Date.now() + 4 * 24 * H);
    const res = await http().patch(`/api/manager/bikes/${solo.bikes[0]!.id}`).set(auth(manager)).send({ status: 'REPAIR', readyAt: readyAt.toISOString() });
    expect(res.status).toBe(200);
    expect(await avail.freeBikeCount(solo.model.id, from, to)).toBe(0);
    const later = new Date(readyAt.getTime() + 24 * H);
    expect(await avail.freeBikeCount(solo.model.id, later, new Date(later.getTime() + 24 * H))).toBe(1);
    expect((await http().patch(`/api/manager/bikes/${solo.bikes[0]!.id}`).set(auth(outsider)).send({ status: 'ACTIVE' })).status).toBe(403);
    await http().patch(`/api/manager/bikes/${solo.bikes[0]!.id}`).set(auth(manager)).send({ status: 'ACTIVE' });
    expect(await avail.freeBikeCount(solo.model.id, from, to)).toBe(1);
  });
});
