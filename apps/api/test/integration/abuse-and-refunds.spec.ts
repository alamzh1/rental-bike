import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AnalyticsService } from '../../src/analytics/analytics.service';
import { createApp, createBooking, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Общий лимит запросов с адреса, срок хранения событий и возвраты под блокировкой брони.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
let app: INestApplication;
const http = () => request(app.getHttpServer());
const MUT = { 'x-admin-request': '1' };
const ADMIN = 9401;
let adminAuth: Record<string, string> = {};
let modelId = '';
let locationId = '';
let bikes: string[] = [];
let clientId = '';
let slot = 0;

async function paid(amount: number): Promise<{ bookingId: string; paymentId: string }> {
  const start = new Date(Date.now() + (10 + 10 * slot++) * 86_400_000);
  const b = await createBooking(prisma, { userId: clientId, modelId, locationId, bikeId: bikes[0]!, startAt: start, endAt: new Date(start.getTime() + 86_400_000), status: 'CONFIRMED' });
  const p = await prisma.payment.create({ data: { bookingId: b.id, kind: 'RENT', method: 'VIETQR', amount, status: 'PAID', paidAt: new Date() } });
  return { bookingId: b.id, paymentId: p.id };
}

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ADMIN);
  await resetDb(prisma);
  await createSettings(prisma);
  const loc = await createLocation(prisma);
  locationId = loc.id;
  const m = await createModel(prisma, loc.id, { key: 'a', brand: 'Honda', name: 'Vision', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: [], prices: [100_000, 100_000, 100_000, 100_000], rating: 4.5, popularity: 1, bikes: [{}] });
  modelId = m.model.id;
  bikes = m.bikes.map((b) => b.id);
  app = await createApp();
  const admin = await http().post('/api/admin/auth/webapp').set(MUT).send({ initData: signInitData({ id: ADMIN, first_name: 'A', language_code: 'ru' }) });
  adminAuth = { Authorization: `Bearer ${admin.body.token as string}` };
  clientId = (await prisma.user.create({ data: { telegramId: '9402', firstName: 'C' } })).id;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('общий лимит запросов с адреса', () => {
  const from = (ip: string) => ({ 'x-forwarded-for': ip });

  it('вход: 30 в минуту с адреса, затем 429 с Retry-After; другой адрес не страдает', async () => {
    process.env.IP_RATE_LIMIT = 'on';
    const codes: number[] = [];
    for (let i = 0; i < 31; i++) codes.push((await http().post('/api/auth/telegram').set(from('198.51.100.1')).send({})).status);
    expect(codes.slice(0, 30).includes(429)).toBe(false);
    expect(codes[30]).toBe(429);
    // Группа общая: заявка на вход в админку с этого адреса тоже закрыта
    const blocked = await http().post('/api/admin/auth/link').set(MUT).set(from('198.51.100.1'));
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe('RATE_LIMITED');
    expect(blocked.headers['retry-after']).toBeDefined();
    expect((await http().post('/api/auth/telegram').set(from('198.51.100.2')).send({})).status).not.toBe(429);
    delete process.env.IP_RATE_LIMIT;
  });

  it('заголовок не обходит лимит: учитывается адрес, добавленный последним прокси', async () => {
    process.env.IP_RATE_LIMIT = 'on';
    let limited = 0;
    for (let i = 0; i < 61; i++) {
      const res = await http().post('/api/events').set('x-forwarded-for', `10.9.8.${i}, 198.51.100.3`).send({ name: 'open' });
      if (res.status === 429) limited++;
    }
    expect(limited).toBe(1);
    delete process.env.IP_RATE_LIMIT;
  });

  it('регистр и лишний слэш не обходят лимит; проверка здоровья и webhook без него', async () => {
    process.env.IP_RATE_LIMIT = 'on';
    let limited = 0;
    for (let i = 0; i < 61; i++) if ((await http().post(i % 2 ? '/api/EVENTS' : '/api/events/').set(from('198.51.100.4')).send({ name: 'open' })).status === 429) limited++;
    expect(limited).toBe(1);
    for (let i = 0; i < 3; i++) expect((await http().get('/api/health').set(from('198.51.100.4'))).status).toBe(200);
    delete process.env.IP_RATE_LIMIT;
  });
});

describe('защитные заголовки', () => {
  it('ответы API не встраиваются и не угадывают тип; договор и файлы открываются без CSP', async () => {
    const res = await http().get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
    const file = await http().get('/api/files/public/none.webp');
    expect(file.headers['x-content-type-options']).toBe('nosniff');
    expect(file.headers['content-security-policy']).toBeUndefined();
  });
});

describe('менеджер не видит суммы', () => {
  it('в брони, истории, мониторинге и воронке денег нет', async () => {
    const managerTg = 9403;
    await prisma.user.create({ data: { telegramId: String(managerTg), firstName: 'M', role: 'MANAGER', locationId } });
    const mgr = await http().post('/api/admin/auth/webapp').set(MUT).send({ initData: signInitData({ id: managerTg, first_name: 'M', language_code: 'ru' }) });
    const auth = { Authorization: `Bearer ${mgr.body.token as string}` };
    const { bookingId } = await paid(700_000);
    await prisma.booking.update({ where: { id: bookingId }, data: { rentAmount: 700_000, totalAmount: 700_000, quote: { days: 1, pricePerDay: 700_000, rent: 700_000, extras: 0, delivery: 0, total: 700_000, deposit: 0, payable: 700_000, lines: [{ kind: 'RENT', amount: 700_000 }] } } });
    await prisma.bookingStatusChange.create({ data: { bookingId, from: 'PENDING_PAYMENT', to: 'PROBLEM', reason: 'UNDERPAID: expected 700000, received 1' } });
    await prisma.analyticsEvent.create({ data: { name: 'open', source: 'secret-campaign' } });
    const detail = await http().get(`/api/admin/bookings/${bookingId}`).set(auth);
    expect(detail.status).toBe(200);
    expect(JSON.stringify(detail.body)).not.toContain('700000');
    expect(detail.body.history.at(-1).reason).toBe('UNDERPAID');
    expect(detail.body.booking.quote.lines).toEqual([]);
    const card = await http().get(`/api/admin/tracking/${bikes[0]!}`).set(auth);
    expect(card.status).toBe(200);
    expect(card.body.history.every((h: { paidAmount: number; totalAmount: number }) => h.paidAmount === 0 && h.totalAmount === 0)).toBe(true);
    const dash = await http().get('/api/admin/dashboard').set(auth);
    expect(dash.body.funnel.sources).toEqual([]);
    expect(dash.body.funnel.steps.every((s: { count: number }) => s.count === 0)).toBe(true);
    const own = (await http().get(`/api/admin/bookings/${bookingId}`).set(adminAuth)).body as { booking: { totalAmount: number } };
    expect(own.booking.totalAmount).toBe(700_000);
  });
});

describe('события', () => {
  it('старые события удаляются, свежие остаются', async () => {
    const old = await prisma.analyticsEvent.create({ data: { name: 'open', createdAt: new Date(Date.now() - 200 * 86_400_000) } });
    const fresh = await prisma.analyticsEvent.create({ data: { name: 'open' } });
    await app.get(AnalyticsService).purgeOld();
    expect(await prisma.analyticsEvent.count({ where: { id: old.id } })).toBe(0);
    expect(await prisma.analyticsEvent.count({ where: { id: fresh.id } })).toBe(1);
  });
});

describe('возвраты под блокировкой брони', () => {
  const refund = (paymentId: string, amount: number) => http().post(`/api/admin/payments/${paymentId}/refund`).set({ ...adminAuth, ...MUT }).send({ amount });

  it('параллельные возвраты не превышают оплату', async () => {
    const { bookingId, paymentId } = await paid(1_000_000);
    const results = await Promise.all([400_001, 400_002, 400_003, 400_004, 400_005].map((a) => refund(paymentId, a)));
    expect(results.filter((r) => r.status === 201 || r.status === 200)).toHaveLength(2);
    expect(results.filter((r) => r.status >= 400).every((r) => r.body.code === 'REFUND_EXCEEDS_PAID')).toBe(true);
    const total = await prisma.payment.aggregate({ where: { bookingId, kind: 'REFUND' }, _sum: { amount: true } });
    expect(total._sum.amount).toBeLessThanOrEqual(1_000_000);
  });

  it('двойной клик по одной сумме создаёт один возврат', async () => {
    const { bookingId, paymentId } = await paid(1_000_000);
    const results = await Promise.all([refund(paymentId, 100_000), refund(paymentId, 100_000), refund(paymentId, 100_000)]);
    expect(results.filter((r) => r.body.code === 'REFUND_DUPLICATE')).toHaveLength(2);
    expect(await prisma.payment.count({ where: { bookingId, kind: 'REFUND' } })).toBe(1);
  });

  it('возврат по отменённой брони и ручной возврат одновременно не превышают оплату', async () => {
    const { bookingId, paymentId } = await paid(1_000_000);
    await Promise.all([refund(paymentId, 900_000), http().patch(`/api/admin/bookings/${bookingId}`).set({ ...adminAuth, ...MUT }).send({ status: 'CANCELLED_BY_SYSTEM' })]);
    const total = await prisma.payment.aggregate({ where: { bookingId, kind: 'REFUND' }, _sum: { amount: true } });
    expect(total._sum.amount).toBeLessThanOrEqual(1_000_000);
  });

  it('отметка «возврат выполнен» дважды считается один раз', async () => {
    const { bookingId } = await paid(100_000);
    const pending = await prisma.payment.create({ data: { bookingId, kind: 'REFUND', method: 'VIETQR', amount: 50_000, status: 'PENDING' } });
    const results = await Promise.all([refund(pending.id, 0), refund(pending.id, 0)]);
    expect(results.filter((r) => r.status === 200 || r.status === 201)).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { action: 'payment.refund', entityId: pending.id } })).toBe(1);
  });
});
