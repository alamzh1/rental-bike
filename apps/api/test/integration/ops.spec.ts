import { createHash, createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient, type BookingStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminDashboard, AdminFinanceSummary, AdminTrackedBikeDetail, AdminTrackerSetup, AdminTrackingList } from '@rental/shared';
import { JOB_OVERDUE, JOB_RETURN_REMINDER, LogNotifier, NOTIFIER } from '../../src/notifications';
import { JobsService } from '../../src/jobs';
import { createApp, createLocation, createModel, createSettings, resetDb, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Финансы, мониторинг, приём GPS, напоминания о конце аренды сотрудникам, локальный вход в админку.
// Суммы разобраны вручную по фикстурам в каждом тесте.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const DAY = 24 * H;
const envBackup = { ...process.env };
const ADMIN_TG = 7201;
const MANAGER_TG = 7202;
const MUT = { 'x-admin-request': '1' };

let locationId = '';
let modelId = '';
let bikeA = '';
let bikeB = '';
let otherBike = '';
let clientId = '';
let adminCookie = '';
let managerCookie = '';
let notifier: LogNotifier;

function widget(fields: Record<string, string | number>): Record<string, string | number> {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHash('sha256').update(TEST_BOT_TOKEN).digest();
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') };
}

async function login(id: number): Promise<string> {
  const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id, first_name: 'S', auth_date: Math.floor(Date.now() / 1000) }));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const raw = res.headers['set-cookie'] as unknown as string[];
  return raw.find((s) => s.startsWith('admin_session='))!.split(';')[0]!;
}

let seq = 0;
async function booking(p: { bikeId: string; startAt: Date; endAt: Date; status?: BookingStatus; rent?: number; extras?: number; discount?: number; lateFee?: number; deposit?: number; refund?: number | null; modelId?: string; locationId?: string }) {
  seq += 1;
  const rent = p.rent ?? 0;
  const extras = p.extras ?? 0;
  const discount = p.discount ?? 0;
  return prisma.booking.create({
    data: {
      code: `OPS-${seq}`,
      userId: clientId,
      modelId: p.modelId ?? modelId,
      locationId: p.locationId ?? locationId,
      bikeId: p.bikeId,
      startAt: p.startAt,
      endAt: p.endAt,
      status: p.status ?? 'COMPLETED',
      paymentMethod: 'CASH',
      lang: 'en',
      phone: '+84900000001',
      rentAmount: rent,
      extrasAmount: extras,
      discountAmount: discount,
      totalAmount: rent + extras - discount,
      depositAmount: p.deposit ?? 0,
      lateFeeAmount: p.lateFee ?? 0,
      refundAmount: p.refund ?? null,
      quote: {},
    },
  });
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ADMIN_TG);
  process.env.NODE_ENV = 'test';
  process.env.DEV_AUTH = '0';
  process.env.API_PUBLIC_URL = 'https://rent.example';
  process.env.GPS_FORWARD_SECRET = 'forward-secret';
  await resetDb(prisma);
  await createSettings(prisma, {});
  locationId = (await createLocation(prisma)).id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [150_000, 130_000, 110_000, 90_000] as [number, number, number, number], rating: 4.5, popularity: 1 };
  const m = await createModel(prisma, locationId, { ...spec, key: 'ops', name: 'Air Blade', bikes: [{}, {}] });
  modelId = m.model.id;
  [bikeA, bikeB] = m.bikes.map((b) => b.id) as [string, string];
  const other = await prisma.location.create({ data: { name: { en: 'Other' }, address: 'x', lat: 1, lng: 1 } });
  const om = await createModel(prisma, other.id, { ...spec, key: 'ops-other', name: 'NVX', bikes: [{}] });
  otherBike = om.bikes[0]!.id;
  clientId = (await prisma.user.create({ data: { telegramId: '7203', firstName: 'Ann', lastName: 'Lee' } })).id;
  await prisma.user.create({ data: { telegramId: String(MANAGER_TG), firstName: 'Manager', role: 'MANAGER', locationId, lang: 'en' } });
  app = await createApp();
  notifier = app.get(NOTIFIER) as LogNotifier;
  adminCookie = await login(ADMIN_TG);
  managerCookie = await login(MANAGER_TG);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('финансы', () => {
  const start = new Date('2026-03-10T05:00:00Z');
  const q = { from: '2026-03-01', to: '2026-03-31' };

  it('прибыль = доход − расходы; депозит не доход; другая дата не считается; менеджеру закрыто', async () => {
    const days = (n: number) => new Date(start.getTime() + n * DAY);
    // A: аренда 1 000 000 − скидка 100 000 + опции 50 000 + опоздание 20 000 + удержание 200 000 = 1 170 000; депозит 500 000 внесён
    const a = await booking({ bikeId: bikeA, startAt: start, endAt: days(2), rent: 1_000_000, extras: 50_000, discount: 100_000, lateFee: 20_000, deposit: 500_000, refund: 300_000 });
    await prisma.payment.create({ data: { bookingId: a.id, kind: 'RENT', method: 'CASH', amount: 950_000, status: 'PAID' } });
    await prisma.payment.create({ data: { bookingId: a.id, kind: 'DEPOSIT', method: 'CASH', amount: 500_000, status: 'PAID' } });
    const admin = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(ADMIN_TG) } });
    await prisma.depositDeduction.create({ data: { bookingId: a.id, amount: 200_000, reason: 'scratch', createdById: admin.id } });
    // B: отмена, оплачено 400 000, возвращено 300 000 → удержано 100 000
    const c = await booking({ bikeId: bikeB, startAt: days(5), endAt: days(6), status: 'CANCELLED_BY_CLIENT', rent: 400_000, refund: 300_000 });
    await prisma.payment.create({ data: { bookingId: c.id, kind: 'RENT', method: 'CASH', amount: 400_000, status: 'PAID' } });
    // Не считаются: другая дата начала и неоплаченная
    await booking({ bikeId: bikeB, startAt: new Date('2026-05-01T00:00:00Z'), endAt: new Date('2026-05-02T00:00:00Z'), rent: 9_000_000 });
    await booking({ bikeId: bikeB, startAt: days(10), endAt: days(11), status: 'PENDING_PAYMENT', rent: 9_000_000 });

    const add = (body: Record<string, unknown>) => http().post('/api/admin/finance/expenses').set('Cookie', adminCookie).set(MUT).send(body);
    expect((await add({ date: '2026-03-12', category: 'REPAIR', amount: 300_000, bikeId: bikeA, comment: 'brakes' })).status).toBe(201);
    expect((await add({ date: '2026-03-15', category: 'RENT', amount: 200_000 })).status).toBe(201);
    expect((await add({ date: '2026-04-01', category: 'RENT', amount: 999_000 })).status).toBe(201);
    expect((await add({ date: '2026-03-15', category: 'NOPE', amount: 1 })).status).toBe(400);
    expect((await add({ date: '2026-03-15', category: 'RENT', amount: 0 })).status).toBe(400);

    const res = await http().get('/api/admin/finance/summary').set('Cookie', adminCookie).query(q);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const s = res.body as AdminFinanceSummary;
    expect(s.breakdown).toEqual({ rent: 900_000, extras: 50_000, delivery: 0, lateFees: 20_000, deductions: 200_000, cancellationFees: 100_000, refunds: 0 });
    expect(s.income).toBe(1_270_000);
    expect(s.expenses).toBe(500_000);
    expect(s.profit).toBe(770_000);
    expect(s.marginPercent).toBe(61);
    // A: 950 000 + 500 000 + 20 000 − внесённые 1 450 000
    expect(s.outstanding).toBe(20_000);
    expect(s.expensesByCategory).toEqual([{ category: 'REPAIR', amount: 300_000 }, { category: 'RENT', amount: 200_000 }]);
    expect(s.granularity).toBe('day');
    expect(s.series.length).toBe(31);
    expect(s.series.find((p) => p.period === '2026-03-10')?.income).toBe(1_170_000);
    expect(s.series.find((p) => p.period === '2026-03-12')?.expenses).toBe(300_000);
    expect(s.series.reduce((x, p) => x + p.profit, 0)).toBe(770_000);

    const rowA = s.bikes.find((b) => b.bikeId === bikeA)!;
    expect(rowA).toMatchObject({ income: 1_170_000, expenses: 300_000, profit: 870_000, bookings: 1, rentedDays: 2 });
    expect((await http().get('/api/admin/finance/summary').set('Cookie', managerCookie).query(q)).status).toBe(403);
    expect((await http().get('/api/admin/finance/expenses').set('Cookie', managerCookie).query(q)).status).toBe(403);
  });

  it('окупаемость считает прибыль за всё время к цене покупки; цену видит только администратор', async () => {
    const patch = await http().patch(`/api/admin/bikes/${bikeB}`).set('Cookie', adminCookie).set(MUT).send({ purchasePrice: 10_000_000 });
    expect(patch.status, JSON.stringify(patch.body)).toBe(200);
    expect(patch.body.purchasePrice).toBe(10_000_000);
    const s = (await http().get('/api/admin/finance/summary').set('Cookie', adminCookie).query(q)).body as AdminFinanceSummary;
    // за всё время: удержание при отмене 100 000 + майская бронь 9 000 000 = 9 100 000 → 91 %
    expect(s.bikes.find((b) => b.bikeId === bikeB)).toMatchObject({ lifetimeProfit: 9_100_000, paybackPercent: 91 });
    const asManager = await http().get('/api/admin/bikes').set('Cookie', managerCookie);
    expect(asManager.body.items.find((b: { id: string }) => b.id === bikeB).purchasePrice).toBeUndefined();
    const denied = await http().patch(`/api/admin/bikes/${bikeB}`).set('Cookie', managerCookie).set(MUT).send({ purchasePrice: 1 });
    expect(denied.status).toBe(403);
  });

  it('расход можно изменить и удалить; действия пишутся в журнал', async () => {
    const created = (await http().post('/api/admin/finance/expenses').set('Cookie', adminCookie).set(MUT).send({ date: ymd(new Date()), category: 'OTHER', amount: 1000 })).body as { id: string };
    const patched = await http().patch(`/api/admin/finance/expenses/${created.id}`).set('Cookie', adminCookie).set(MUT).send({ amount: 2000 });
    expect(patched.body.amount).toBe(2000);
    expect((await http().delete(`/api/admin/finance/expenses/${created.id}`).set('Cookie', adminCookie).set(MUT)).status).toBe(204);
    expect((await http().delete(`/api/admin/finance/expenses/${created.id}`).set('Cookie', adminCookie).set(MUT)).status).toBe(404);
    expect(await prisma.auditLog.count({ where: { entity: 'Expense', entityId: created.id } })).toBe(3);
  });
});

describe('мониторинг и GPS', () => {
  let token = '';

  it('трекер подключает только администратор; менеджер не видит секрет', async () => {
    expect((await http().put(`/api/admin/tracking/${bikeA}/tracker`).set('Cookie', managerCookie).set(MUT).send({})).status).toBe(403);
    const res = await http().put(`/api/admin/tracking/${bikeA}/tracker`).set('Cookie', adminCookie).set(MUT).send({ deviceId: 'IMEI-1' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const setup = res.body as AdminTrackerSetup;
    expect(setup.ingestUrl).toMatch(/^https:\/\/rent\.example\/api\/gps\/gps_/);
    expect(setup.forwardEnabled).toBe(true);
    token = setup.ingestUrl.split('/').pop()!;
    const again = await http().put(`/api/admin/tracking/${bikeB}/tracker`).set('Cookie', adminCookie).set(MUT).send({ deviceId: 'IMEI-1' });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('TRACKER_TAKEN');
    const managerView = (await http().get(`/api/admin/tracking/${bikeA}`).set('Cookie', managerCookie)).body as AdminTrackedBikeDetail;
    expect(managerView.tracker).toBeNull();
    expect(managerView.finance).toBeNull();
    expect(JSON.stringify(managerView)).not.toContain(token);
    const list = await http().get('/api/admin/tracking').set('Cookie', managerCookie);
    expect(JSON.stringify(list.body)).not.toContain(token);
    expect((list.body as AdminTrackingList).items.map((b) => b.id)).not.toContain(otherBike);
    expect((await http().get(`/api/admin/tracking/${otherBike}`).set('Cookie', managerCookie)).status).toBe(404);
  });

  it('точка обновляет позицию и трек; чужой секрет — 404, плохие координаты — 400', async () => {
    const at = Math.floor(Date.now() / 1000) - 120;
    expect((await http().get('/api/gps/gps_wrong').query({ lat: 1, lon: 1 })).status).toBe(404);
    expect((await http().get(`/api/gps/${token}`).query({ lat: 200, lon: 1 })).status).toBe(400);
    expect((await http().get(`/api/gps/${token}`).query({ lat: 13.77, lon: 109.22, timestamp: at + 100_000 })).status).toBe(400);
    const ok = await http().post(`/api/gps/${token}`).query({ id: 'phone', lat: 13.77, lon: 109.22, speed: 0, batt: 80, timestamp: at });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    const json = await http().post(`/api/gps/${token}`).send({ location: { timestamp: new Date((at + 60) * 1000).toISOString(), coords: { latitude: 13.78, longitude: 109.23, speed: 2 }, battery: { level: 0.75 } } });
    expect(json.status).toBe(200);
    // старая точка — в трек, позицию не сдвигает; дубликат в пределах 5 с — отброшен
    await http().get(`/api/gps/${token}`).query({ lat: 13.5, lon: 109.5, timestamp: at - 600 });
    await http().get(`/api/gps/${token}`).query({ lat: 13.9, lon: 109.9, timestamp: at + 62 });
    const d = (await http().get(`/api/admin/tracking/${bikeA}`).set('Cookie', adminCookie)).body as AdminTrackedBikeDetail;
    expect(d.bike.gps).toMatchObject({ connected: true, lat: 13.78, lng: 109.23, speedKmh: 7.2, batteryPct: 75, online: true });
    expect(d.track.map((p) => p.lat)).toEqual([13.5, 13.77, 13.78]);
    expect(d.tracker?.deviceId).toBe('IMEI-1');
    expect(d.finance?.income).toBeGreaterThan(0);
  });

  it('приём от Traccar по ID устройства работает только с верным секретом', async () => {
    const p = { id: 'IMEI-1', lat: 13.8, lon: 109.3 };
    expect((await http().get('/api/gps/forward').query({ ...p, secret: 'nope' })).status).toBe(404);
    expect((await http().get('/api/gps/forward').query({ id: 'unknown', lat: 1, lon: 1, secret: 'forward-secret' })).status).toBe(404);
    expect((await http().get('/api/gps/forward').query({ ...p, secret: 'forward-secret' })).status).toBe(200);
    expect((await prisma.bike.findUniqueOrThrow({ where: { id: bikeA } })).lastLat).toBe(13.8);
  });

  it('движение без аренды: одна тревога в час, при аренде молчит', async () => {
    notifier.sent.length = 0;
    await prisma.bike.update({ where: { id: bikeA }, data: { lastSeenAt: null, motionAlertAt: null } });
    await http().get(`/api/gps/${token}`).query({ lat: 13.81, lon: 109.31, speed: 20 });
    const alerts = () => notifier.sent.filter((m) => m.key === 'bot.manager.bikeMoving');
    expect(alerts().map((m) => m.telegramId).sort()).toEqual([String(ADMIN_TG), String(MANAGER_TG)]);
    expect(alerts()[0]?.text).toContain('37');
    await prisma.bike.update({ where: { id: bikeA }, data: { lastSeenAt: null } });
    await http().get(`/api/gps/${token}`).query({ lat: 13.82, lon: 109.32, speed: 20 });
    expect(alerts().length).toBe(2);

    const rental = await booking({ bikeId: bikeA, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + 5 * H), status: 'ISSUED', rent: 100 });
    await prisma.bike.update({ where: { id: bikeA }, data: { lastSeenAt: null, motionAlertAt: null } });
    await http().get(`/api/gps/${token}`).query({ lat: 13.83, lon: 109.33, speed: 20 });
    expect(alerts().length).toBe(2);
    const rows = (await http().get('/api/admin/tracking').set('Cookie', managerCookie)).body as AdminTrackingList;
    const row = rows.items.find((b) => b.id === bikeA)!;
    expect(row.state).toBe('RENTED');
    expect(row.current).toMatchObject({ code: rental.code, clientName: 'Ann Lee', phone: '+84900000001' });
    expect(row.attention).toContain('ENDING_SOON');
  });

  it('отключение: старый адрес перестаёт работать, позиция стирается', async () => {
    expect((await http().delete(`/api/admin/tracking/${bikeA}/tracker`).set('Cookie', adminCookie).set(MUT)).status).toBe(204);
    expect((await http().get(`/api/gps/${token}`).query({ lat: 1, lon: 1 })).status).toBe(404);
    const d = (await http().get(`/api/admin/tracking/${bikeA}`).set('Cookie', adminCookie)).body as AdminTrackedBikeDetail;
    expect(d.bike.gps.connected).toBe(false);
    expect(d.bike.gps.lat).toBeNull();
    expect(d.tracker).toBeNull();
  });
});

describe('конец аренды', () => {
  it('сводка показывает просроченные и заканчивающиеся за 24 часа', async () => {
    const late = await booking({ bikeId: bikeB, startAt: new Date(Date.now() - 3 * DAY), endAt: new Date(Date.now() - H), status: 'ISSUED', rent: 100 });
    const d = (await http().get('/api/admin/dashboard').set('Cookie', managerCookie)).body as AdminDashboard;
    expect(d.rentals.overdue.map((b) => b.code)).toContain(late.code);
    expect(d.rentals.endingSoon.map((b) => b.bikeId)).toContain(bikeA);
    expect(d.rentals.endingSoon.map((b) => b.code)).not.toContain(late.code);
  });

  it('за 2 часа пишем клиенту, менеджеру и администратору; просрочка — тоже всем сотрудникам', async () => {
    const b = await prisma.booking.findFirstOrThrow({ where: { bikeId: bikeA, status: 'ISSUED' } });
    const jobs = app.get(JobsService);
    notifier.sent.length = 0;
    await jobs.run(JOB_RETURN_REMINDER, { bookingId: b.id, kind: '2h' });
    const client = await prisma.user.findUniqueOrThrow({ where: { id: clientId } });
    expect(notifier.sent.find((m) => m.key === 'bot.client.returnReminder2h')?.telegramId).toBe(client.telegramId);
    const staff = notifier.sent.filter((m) => m.key === 'bot.manager.returnSoon');
    expect(staff.map((m) => m.telegramId).sort()).toEqual([String(ADMIN_TG), String(MANAGER_TG)]);
    expect(staff.find((m) => m.telegramId === String(MANAGER_TG))?.text).toContain('+84900000001');

    notifier.sent.length = 0;
    await jobs.run(JOB_RETURN_REMINDER, { bookingId: b.id });
    expect(notifier.sent.map((m) => m.key)).toEqual(['bot.client.returnReminder']);

    notifier.sent.length = 0;
    await jobs.run(JOB_OVERDUE, { bookingId: b.id });
    expect(notifier.sent.filter((m) => m.key === 'bot.manager.overdue').length).toBe(2);
  });
});

describe('DEV_AUTH=local: тестовый вход в админку только с этой машины', () => {
  const dev = () => http().post('/api/admin/auth/dev').set(MUT).send({ role: 'admin' });

  it('DEV_AUTH=0: закрыто', async () => {
    expect((await dev()).status).toBe(404);
    expect((await http().get('/api/admin/auth/config')).body.devAuth).toBe(false);
  });

  it('local: локально можно, через туннель и с чужого сайта — нет; Mini App не открывается', async () => {
    process.env.DEV_AUTH = 'local';
    try {
      expect((await http().get('/api/admin/auth/config')).body.devAuth).toBe(true);
      expect((await dev().set('Origin', 'http://localhost:5174')).status).toBe(200);
      expect((await dev().set('cf-connecting-ip', '1.2.3.4')).status).toBe(404);
      expect((await dev().set('x-forwarded-for', '1.2.3.4')).status).toBe(404);
      expect((await dev().set('Origin', 'https://evil.example')).status).toBe(404);
      expect((await http().get('/api/admin/auth/config').set('cf-connecting-ip', '1.2.3.4')).body.devAuth).toBe(false);
      expect((await http().post('/api/auth/telegram').send({ devUser: 'admin' })).status).toBe(401);
    } finally {
      process.env.DEV_AUTH = '0';
    }
  });

  it('в production local не действует', async () => {
    process.env.DEV_AUTH = 'local';
    process.env.NODE_ENV = 'production';
    try {
      expect((await dev()).status).toBe(404);
    } finally {
      process.env.DEV_AUTH = '0';
      process.env.NODE_ENV = 'test';
    }
  });
});
