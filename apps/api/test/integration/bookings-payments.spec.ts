import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, Booking, CancelBookingResponse, CreateDocumentResponse, PayBookingResponse } from '@rental/shared';
import { Clock } from '../../src/jobs/clock';
import { JobsService, JOB_HOLD_EXPIRY } from '../../src/jobs/jobs.service';
import { BookingsService } from '../../src/bookings/bookings.service';
import { RateLimiter } from '../../src/bookings/rate-limit';
import { AvailabilityService } from '../../src/availability/availability.service';
import { PAYMENT_PROVIDER } from '../../src/payments/payment-provider';
import { TestProvider } from '../../src/payments/test-provider';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Таск 05: бронь с резервом байка, удержание 15 мин, оплата (тестовый провайдер, webhook), сверка суммы,
// отмена с возвратом, неявка, документы. Суммы — вручную по тарифу фикстуры: 1 сутки = 180 000 ₫.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
let clock: Clock;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const MIN = 60_000;
const DAY_PRICE = 180_000;
const storageDir = mkdtempSync(join(tmpdir(), 'rental-storage-'));
const envBackup = { ...process.env };

let locationId = '';
let multiModel = ''; // 6 байков
let singleModel = ''; // последний байк — гонка
let holdModel = ''; // 1 байк — удержание

const realNow = new Date();
// Начало периода: через 5 суток, ровно в час (UTC)
const base = new Date(Math.ceil(realNow.getTime() / H) * H + 5 * 24 * H);
let slot = 0;
/** Непересекающиеся периоды по 1 суткам (для броней одного байка в разных тестах). */
function nextPeriod(): { startAt: string; endAt: string; start: Date } {
  const start = new Date(base.getTime() + slot++ * 3 * 24 * H);
  return { startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString(), start };
}

async function login(telegramId: number): Promise<{ token: string; userId: string }> {
  const res = await http()
    .post('/api/auth/telegram')
    .send({ initData: signInitData({ id: telegramId, first_name: 'T', language_code: 'en' }) });
  expect(res.status).toBe(200);
  const body = res.body as AuthResponse;
  return { token: body.token, userId: body.user.id };
}

let alice: { token: string; userId: string };
let bob: { token: string; userId: string };
let manager: { token: string; userId: string };
const auth = (u: { token: string }) => ({ Authorization: `Bearer ${u.token}` });

function book(u: { token: string }, body: Record<string, unknown>) {
  return http()
    .post('/api/bookings')
    .set(auth(u))
    .send({ paymentMethod: 'VIETQR', phone: '+84901234567', agreed: true, ...body });
}

async function bookOk(u: { token: string }, body: Record<string, unknown>): Promise<Booking> {
  const res = await book(u, body);
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as Booking;
}

async function payOk(u: { token: string }, bookingId: string): Promise<PayBookingResponse> {
  const res = await http().post(`/api/bookings/${bookingId}/pay`).set(auth(u));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return res.body as PayBookingResponse;
}

/** Одна настройка (createSettings перезаписывает все значения по умолчанию). */
async function setSetting(key: string, value: unknown): Promise<void> {
  await prisma.setting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
}

const status = async (id: string) => (await prisma.booking.findUniqueOrThrow({ where: { id } })).status;

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error('PostgreSQL недоступен по DATABASE_URL — запустите `pnpm test:integration`.');
  }
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = '';
  process.env.STORAGE_DRIVER = 'local';
  process.env.STORAGE_DIR = storageDir;
  for (const k of ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY', 'PAYOS_WEBHOOK_IPS']) delete process.env[k];
  await resetDb(prisma);
  await createSettings(prisma, { holdMinutes: 15, cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 }, noShowHours: 3, cashPrepayPercent: 0, depositMode: 'DOCUMENT', docRetentionDays: 90 });
  const loc = await createLocation(prisma);
  locationId = loc.id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [DAY_PRICE, 160_000, 140_000, 120_000] as [number, number, number, number], rating: 4.8, popularity: 1 };
  multiModel = (await createModel(prisma, loc.id, { ...spec, key: 'multi', name: 'Air Blade', bikes: [{}, {}, {}, {}, {}, {}] })).model.id;
  singleModel = (await createModel(prisma, loc.id, { ...spec, key: 'single', name: 'Vision', bikes: [{}] })).model.id;
  holdModel = (await createModel(prisma, loc.id, { ...spec, key: 'hold', name: 'Lead', bikes: [{}] })).model.id;

  app = await createApp();
  clock = app.get(Clock);
  alice = await login(5001);
  bob = await login(5002);
  manager = await login(5003);
  await prisma.user.update({ where: { id: manager.userId }, data: { role: 'MANAGER', locationId } });
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

describe('POST /bookings — резерв байка', () => {
  it('две параллельные брони последнего байка: одна успешная, одна 409 BIKE_TAKEN', async () => {
    const p = nextPeriod();
    const [a, b] = await Promise.all([book(alice, { modelId: singleModel, ...p }), book(bob, { modelId: singleModel, ...p })]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([201, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.code).toBe('BIKE_TAKEN');
    expect(await prisma.booking.count({ where: { modelId: singleModel, startAt: p.start } })).toBe(1);
  });

  it('пять одновременных броней последнего байка → ровно одна создана', async () => {
    const p = nextPeriod();
    const users = [alice, bob, manager, alice, bob];
    const res = await Promise.all(users.map((u) => book(u, { modelId: singleModel, ...p })));
    expect(res.filter((r) => r.status === 201)).toHaveLength(1);
    expect(res.filter((r) => r.status === 409 && r.body.code === 'BIKE_TAKEN')).toHaveLength(4);
  });

  it('VietQR → «Ожидает оплаты» с удержанием 15 мин и кодом BK-; сумма по тарифу', async () => {
    const before = Date.now();
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    expect(b.status).toBe('PENDING_PAYMENT');
    expect(b.code).toMatch(/^BK-\d{5,}$/);
    expect(b.totalAmount).toBe(DAY_PRICE);
    expect(b.payable).toBe(DAY_PRICE);
    const hold = new Date(b.holdExpiresAt!).getTime() - before;
    expect(hold).toBeGreaterThanOrEqual(15 * MIN - 1000);
    expect(hold).toBeLessThanOrEqual(15 * MIN + 5000);
    expect(app.get(JobsService).hasTimer(`hold-${b.id}`)).toBe(true);
  });

  it('наличные → «Подтверждена» без предоплаты; при cashPrepayPercent=30 — ожидает предоплату 30%', async () => {
    const cash = await bookOk(alice, { modelId: multiModel, paymentMethod: 'CASH', ...nextPeriod() });
    expect(cash.status).toBe('CONFIRMED');
    expect(cash.payable).toBe(0);
    await setSetting('cashPrepayPercent', 30);
    try {
      const pre = await bookOk(alice, { modelId: multiModel, paymentMethod: 'CASH', ...nextPeriod() });
      expect(pre.status).toBe('PENDING_PAYMENT');
      expect(pre.payable).toBe(54_000);
    } finally {
      await setSetting('cashPrepayPercent', 0);
    }
  });

  it('срок меньше minRentDays → 400 MIN_RENT_DAYS; выдача раньше now + minLeadMinutes → 400 LEAD_TIME', async () => {
    await setSetting('minRentDays', 2);
    try {
      const short = await book(alice, { modelId: multiModel, ...nextPeriod() });
      expect(short.status).toBe(400);
      expect(short.body.code).toBe('MIN_RENT_DAYS');
    } finally {
      await setSetting('minRentDays', 1);
    }
    const soon = new Date(Date.now() + 30 * MIN);
    const early = await book(alice, { modelId: multiModel, startAt: soon.toISOString(), endAt: new Date(soon.getTime() + 24 * H).toISOString() });
    expect(early.status).toBe(400);
    expect(early.body.code).toBe('LEAD_TIME');
  });

  it('без согласия с правилами → 400 AGREEMENT_REQUIRED', async () => {
    const res = await book(alice, { modelId: multiModel, agreed: false, ...nextPeriod() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('AGREEMENT_REQUIRED');
  });

  it('больше 10 созданий брони в минуту → 429 RATE_LIMITED', async () => {
    for (let i = 0; i < 10; i++) expect((await book(bob, { modelId: 'nope' })).status).not.toBe(429);
    const res = await book(bob, { modelId: 'nope' });
    expect(res.status).toBe(429);
    expect(res.body.code).toBe('RATE_LIMITED');
  });
});

describe('удержание 15 минут', () => {
  it('неоплаченная бронь через 15 мин → «Отменена системой» (не оплачено), байк снова свободен', async () => {
    const p = nextPeriod();
    const created = Date.now();
    const b = await bookOk(alice, { modelId: holdModel, ...p });
    const availability = app.get(AvailabilityService);
    expect(await availability.freeBikeCount(holdModel, new Date(p.startAt), new Date(p.endAt))).toBe(0);

    clock.now = () => new Date(created + 14 * MIN);
    await app.get(JobsService).run(JOB_HOLD_EXPIRY, { bookingId: b.id });
    expect(await status(b.id)).toBe('PENDING_PAYMENT');

    clock.now = () => new Date(created + 16 * MIN);
    await app.get(JobsService).run(JOB_HOLD_EXPIRY, { bookingId: b.id });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe('CANCELLED_BY_SYSTEM');
    expect(row.cancelReason).toBe('NOT_PAID');
    expect(await availability.freeBikeCount(holdModel, new Date(p.startAt), new Date(p.endAt))).toBe(1);
    // тот же байк на те же даты снова бронируется
    clock.now = () => new Date();
    expect((await book(bob, { modelId: holdModel, ...p })).status).toBe(201);
  });

  it('свипер отменяет просроченные удержания, если задача потерялась', async () => {
    const created = Date.now();
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    clock.now = () => new Date(created + 16 * MIN);
    expect(await app.get(BookingsService).expireOverdueHolds()).toBeGreaterThanOrEqual(1);
    expect(await status(b.id)).toBe('CANCELLED_BY_SYSTEM');
  });

  it('оплата после истечения удержания недоступна → 409 HOLD_EXPIRED', async () => {
    const created = Date.now();
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    clock.now = () => new Date(created + 16 * MIN);
    const res = await http().post(`/api/bookings/${b.id}/pay`).set(auth(alice));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('HOLD_EXPIRED');
  });
});

describe('оплата и webhook', () => {
  const provider = () => app.get<TestProvider>(PAYMENT_PROVIDER);

  it('POST /bookings/{id}/pay → QR с кодом брони; повторный вызов — тот же платёж', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    expect(pay.provider).toBe('test');
    expect(pay.amount).toBe(DAY_PRICE);
    expect(pay.description).toBe(b.code);
    expect(pay.qrPayload).toContain(b.code);
    expect((await payOk(alice, b.id)).paymentId).toBe(pay.paymentId);
    expect(await prisma.payment.count({ where: { bookingId: b.id } })).toBe(1);
  });

  it('webhook подтверждает бронь; повторный webhook не создаёт второй оплаты', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    const { externalId } = await prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } });
    const body = provider().simulate(externalId!, DAY_PRICE);

    const first = await http().post('/api/webhooks/payos').send(body);
    expect(first.status).toBe(200);
    expect(await status(b.id)).toBe('CONFIRMED');
    const paidAt = (await prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } })).paidAt;

    const again = await http().post('/api/webhooks/payos').send(body);
    expect(again.status).toBe(200);
    const payments = await prisma.payment.findMany({ where: { bookingId: b.id } });
    expect(payments.filter((p) => p.status === 'PAID')).toHaveLength(1);
    expect(payments[0]!.paidAt).toEqual(paidAt);
    expect(await prisma.bookingStatusChange.count({ where: { bookingId: b.id, to: 'CONFIRMED' } })).toBe(1);
    const view = (await http().get(`/api/bookings/${b.id}`).set(auth(alice))).body as Booking;
    expect(view.status).toBe('CONFIRMED');
    expect(view.paidAmount).toBe(DAY_PRICE);
  });

  it('неверная подпись webhook → 400 INVALID_SIGNATURE, бронь не меняется', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    const { externalId } = await prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } });
    const body = { ...provider().simulate(externalId!, DAY_PRICE), signature: '0'.repeat(64) };
    const res = await http().post('/api/webhooks/payos').send(body);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_SIGNATURE');
    expect(await status(b.id)).toBe('PENDING_PAYMENT');
  });

  it('webhook с IP не из PAYOS_WEBHOOK_IPS → 403', async () => {
    process.env.PAYOS_WEBHOOK_IPS = '203.0.113.7';
    try {
      const res = await http().post('/api/webhooks/payos').send({});
      expect(res.status).toBe(403);
    } finally {
      delete process.env.PAYOS_WEBHOOK_IPS;
    }
  });

  it('недоплата → «Проблема»', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    const res = await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth(alice)).send({ amount: DAY_PRICE - 10_000 });
    expect(res.status).toBe(200);
    expect(await status(b.id)).toBe('PROBLEM');
    const change = await prisma.bookingStatusChange.findFirstOrThrow({ where: { bookingId: b.id, to: 'PROBLEM' } });
    expect(change.reason).toMatch(/UNDERPAID/);
  });

  it('переплата → «Проблема»', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth(alice)).send({ amount: DAY_PRICE + 50_000 });
    expect(await status(b.id)).toBe('PROBLEM');
    expect((await prisma.bookingStatusChange.findFirstOrThrow({ where: { bookingId: b.id, to: 'PROBLEM' } })).reason).toMatch(/OVERPAID/);
  });

  it('тестовая оплата «Оплатить (тест)» подтверждает бронь без аккаунтов', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    const res = await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth(alice)).send({});
    expect(res.status).toBe(200);
    expect((res.body as Booking).status).toBe('CONFIRMED');
  });
});

describe('отмена и возврат', () => {
  async function paidBooking(): Promise<{ id: string; start: Date }> {
    const p = nextPeriod();
    const b = await bookOk(alice, { modelId: multiModel, ...p });
    const pay = await payOk(alice, b.id);
    await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth(alice)).send({});
    expect(await status(b.id)).toBe('CONFIRMED');
    return { id: b.id, start: p.start };
  }

  async function cancelAt(id: string, at: Date): Promise<CancelBookingResponse> {
    clock.now = () => at;
    const res = await http().post(`/api/bookings/${id}/cancel`).set(auth(alice));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as CancelBookingResponse;
  }

  it('за 30 ч до выдачи → 100%', async () => {
    const b = await paidBooking();
    const r = await cancelAt(b.id, new Date(b.start.getTime() - 30 * H));
    expect(r.refundPercent).toBe(100);
    expect(r.refundAmount).toBe(DAY_PRICE);
    expect(r.booking.status).toBe('CANCELLED_BY_CLIENT');
    const refund = await prisma.payment.findFirstOrThrow({ where: { bookingId: b.id, kind: 'REFUND' } });
    expect(refund.amount).toBe(DAY_PRICE);
    expect(refund.status).toBe('PENDING');
  });

  it('за 10 ч → 50%', async () => {
    const b = await paidBooking();
    const r = await cancelAt(b.id, new Date(b.start.getTime() - 10 * H));
    expect(r.refundPercent).toBe(50);
    expect(r.refundAmount).toBe(90_000);
  });

  it('за 1 ч → 0, запись возврата не создаётся', async () => {
    const b = await paidBooking();
    const r = await cancelAt(b.id, new Date(b.start.getTime() - 1 * H));
    expect(r.refundPercent).toBe(0);
    expect(r.refundAmount).toBe(0);
    expect(await prisma.payment.count({ where: { bookingId: b.id, kind: 'REFUND' } })).toBe(0);
  });

  it('депозит (depositMode=MONEY) — отдельной строкой, оплачивается с арендой и возвращается полностью даже за 1 ч', async () => {
    await setSetting('depositMode', 'MONEY');
    try {
      const b = await paidBooking();
      const view = (await http().get(`/api/bookings/${b.id}`).set(auth(alice))).body as Booking;
      expect(view.depositAmount).toBe(1_000_000);
      expect(view.quote.lines.some((l) => l.kind === 'DEPOSIT' && l.amount === 1_000_000)).toBe(true);
      expect(view.paidAmount).toBe(DAY_PRICE + 1_000_000);
      const r = await cancelAt(b.id, new Date(b.start.getTime() - 1 * H));
      expect(r.refundPercent).toBe(0);
      expect(r.refundAmount).toBe(1_000_000);
    } finally {
      await setSetting('depositMode', 'DOCUMENT');
    }
  });

  it('карточка брони показывает сумму возврата до отмены', async () => {
    const b = await paidBooking();
    clock.now = () => new Date(b.start.getTime() - 10 * H);
    const view = (await http().get(`/api/bookings/${b.id}`).set(auth(alice))).body as Booking;
    expect(view.cancelPreview).toEqual({ refundPercent: 50, refundAmount: 90_000 });
  });

  it('повторная отмена → 409 INVALID_TRANSITION', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    expect((await http().post(`/api/bookings/${b.id}/cancel`).set(auth(alice))).status).toBe(200);
    const res = await http().post(`/api/bookings/${b.id}/cancel`).set(auth(alice));
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('INVALID_TRANSITION');
  });

  it('неявка: через noShowHours после выдачи «Подтверждена» → «Отменена системой» (неявка)', async () => {
    const p = nextPeriod();
    const b = await bookOk(alice, { modelId: multiModel, paymentMethod: 'CASH', ...p });
    clock.now = () => new Date(p.start.getTime() + 2 * H);
    await app.get(BookingsService).cancelNoShows();
    expect(await status(b.id)).toBe('CONFIRMED');
    clock.now = () => new Date(p.start.getTime() + 3 * H + MIN);
    await app.get(BookingsService).cancelNoShows();
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: b.id } });
    expect(row.status).toBe('CANCELLED_BY_SYSTEM');
    expect(row.cancelReason).toBe('NO_SHOW');
  });

  it('«Не пришёл» менеджером пишется в журнал действий', async () => {
    const b = await bookOk(alice, { modelId: multiModel, paymentMethod: 'CASH', ...nextPeriod() });
    await app.get(BookingsService).markNoShow(b.id, { id: manager.userId, role: 'MANAGER' });
    expect(await prisma.auditLog.count({ where: { entity: 'Booking', entityId: b.id, actorId: manager.userId } })).toBe(1);
  });
});

describe('доступ к чужим броням и документам', () => {
  it('чужая бронь по подмене ID → 404 (просмотр, отмена, оплата, календарь)', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    expect((await http().get(`/api/bookings/${b.id}`).set(auth(bob))).status).toBe(404);
    expect((await http().post(`/api/bookings/${b.id}/cancel`).set(auth(bob))).status).toBe(404);
    expect((await http().post(`/api/bookings/${b.id}/pay`).set(auth(bob))).status).toBe(404);
    expect((await http().get(`/api/bookings/${b.id}/calendar.ics`).set(auth(bob))).status).toBe(404);
    const list = (await http().get('/api/bookings').set(auth(bob))).body as { items: Booking[] };
    expect(list.items.some((x) => x.id === b.id)).toBe(false);
    expect(await status(b.id)).toBe('PENDING_PAYMENT');
  });

  it('чужой платёж в dev-оплате → 404', async () => {
    const b = await bookOk(alice, { modelId: multiModel, ...nextPeriod() });
    const pay = await payOk(alice, b.id);
    expect((await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth(bob)).send({})).status).toBe(404);
    expect(await status(b.id)).toBe('PENDING_PAYMENT');
  });

  it('календарь .ics своей брони', async () => {
    const p = nextPeriod();
    const b = await bookOk(alice, { modelId: multiModel, ...p });
    const res = await http().get(`/api/bookings/${b.id}/calendar.ics`).set(auth(alice));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/calendar/);
    expect(res.text).toContain(`SUMMARY:${b.code}`);
  });
});

describe('документы', () => {
  const PNG = Buffer.from('89504e470d0a1a0a-secret-passport-scan', 'utf8');
  const pathOf = (url: string) => {
    const u = new URL(url);
    return `${u.pathname}${u.search}`;
  };

  it('без согласия на обработку ПД первая загрузка недоступна → 400 CONSENT_REQUIRED', async () => {
    const res = await http().post('/api/documents').set(auth(bob)).send({ type: 'PASSPORT', contentType: 'image/png' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('CONSENT_REQUIRED');
  });

  it('загрузка по подписанной ссылке, файл зашифрован на диске; чтение — менеджеру ссылкой ≤ 600 с; клиенту — нет', async () => {
    const created = await http().post('/api/documents').set(auth(alice)).send({ type: 'PASSPORT', contentType: 'image/png', consent: true });
    expect(created.status).toBe(201);
    const doc = created.body as CreateDocumentResponse;
    const put = await http().put(pathOf(doc.uploadUrl)).set(doc.headers).send(PNG);
    expect(put.status).toBe(200);

    // повторная загрузка — согласие уже есть
    expect((await http().post('/api/documents').set(auth(alice)).send({ type: 'LICENSE', contentType: 'image/jpeg' })).status).toBe(201);

    const onDisk = readdirSync(join(storageDir, 'private', 'documents', alice.userId)).map((f) => join(storageDir, 'private', 'documents', alice.userId, f));
    const file = onDisk.find((f) => statSync(f).size > 0)!;
    expect(readFileSync(file).includes(Buffer.from('secret-passport-scan'))).toBe(false);

    expect((await http().get(`/api/documents/${doc.documentId}/url`).set(auth(alice))).status).toBe(403);

    const before = Date.now();
    const link = await http().get(`/api/documents/${doc.documentId}/url?ttl=3600`).set(auth(manager));
    expect(link.status).toBe(200);
    expect(new Date(link.body.expiresAt).getTime() - before).toBeLessThanOrEqual(600_000 + 1000);
    const got = await http().get(pathOf(link.body.url)).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(got.status).toBe(200);
    expect(Buffer.compare(got.body as Buffer, PNG)).toBe(0);
    expect(await prisma.auditLog.count({ where: { entity: 'Document', entityId: doc.documentId, action: 'document.read' } })).toBe(1);

    // подделанная подпись — отказ
    const forged = pathOf(link.body.url).replace(/sig=[^&]+/, 'sig=forged');
    expect((await http().get(forged)).status).toBe(403);
  });

  it('чужой документ по подмене ID → 404', async () => {
    const created = await http().post('/api/documents').set(auth(alice)).send({ type: 'IDP', contentType: 'application/pdf', consent: true });
    const id = (created.body as CreateDocumentResponse).documentId;
    expect((await http().get(`/api/documents/${id}`).set(auth(bob))).status).toBe(404);
    expect((await http().delete(`/api/documents/${id}`).set(auth(bob))).status).toBe(404);
    const list = await http().get('/api/documents').set(auth(bob));
    expect((list.body.items as { id: string }[]).some((d) => d.id === id)).toBe(false);
    expect((await http().get(`/api/documents/${id}`).set(auth(alice))).status).toBe(200);
  });
});
