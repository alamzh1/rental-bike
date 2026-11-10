import { createHash, createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient, type BookingStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import type { AdminBookingDetail, AdminBookingList, AdminDashboard, AdminSessionResponse, AuditList, ChessResponse } from '@rental/shared';
import { Clock } from '../../src/jobs/clock';
import { createApp, createLocation, createModel, createSettings, resetDb, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Таск 10: вход в админку (Login Widget, dev-вход), роли, дашборд, брони, шахматка, ручная бронь, журнал.
// Ожидаемые суммы дашборда разобраны вручную по фикстуре ниже (не из кода под тестом).

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
let clock: Clock;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const DAY = 24 * H;
const envBackup = { ...process.env };
const ADMIN_TG = 7001;
const MANAGER_TG = 7002;
const CLIENT_TG = 7003;
const MUT = { 'x-admin-request': '1' };

let locationId = '';
let modelId = ''; // 3 байка — перенос в шахматке
let bikes: string[] = [];
let soloModel = ''; // 1 байк — ручная бронь
let otherModel = '';
let otherBike = '';
let adminCookie = '';
let managerCookie = '';
let clientUserId = '';

/** Подпись Login Widget: secret = SHA256(bot_token), hash = HMAC-SHA256(secret, data_check_string). */
function widget(fields: Record<string, string | number>, token = TEST_BOT_TOKEN): Record<string, string | number> {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHash('sha256').update(token).digest();
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') };
}
const nowSec = () => Math.floor(Date.now() / 1000);

function cookieOf(res: request.Response): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const c = (raw ?? []).find((s) => s.startsWith('admin_session='));
  expect(c, 'admin_session cookie').toBeTruthy();
  return c!.split(';')[0]!;
}

let seq = 0;
async function booking(p: { bikeId: string; modelId?: string; startAt: Date; endAt: Date; status?: BookingStatus; total?: number; lateFee?: number; userId?: string }) {
  seq += 1;
  return prisma.booking.create({
    data: {
      code: `T10-${seq}-${Math.random().toString(36).slice(2, 6)}`,
      userId: p.userId ?? clientUserId,
      modelId: p.modelId ?? modelId,
      locationId,
      bikeId: p.bikeId,
      startAt: p.startAt,
      endAt: p.endAt,
      status: p.status ?? 'CONFIRMED',
      paymentMethod: 'CASH',
      lang: 'en',
      rentAmount: p.total ?? 0,
      totalAmount: p.total ?? 0,
      lateFeeAmount: p.lateFee ?? 0,
      quote: {},
    },
  });
}

const base = new Date(Math.ceil(Date.now() / H) * H + 10 * DAY);
let slot = 0;
function period(days = 1): { startAt: Date; endAt: Date } {
  const startAt = new Date(base.getTime() + slot++ * 5 * DAY);
  return { startAt, endAt: new Date(startAt.getTime() + days * DAY) };
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ADMIN_TG);
  process.env.NODE_ENV = 'test';
  process.env.DEV_AUTH = '1';
  await resetDb(prisma);
  await createSettings(prisma, { holdMinutes: 15, cashPrepayPercent: 0, cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 } });
  locationId = (await createLocation(prisma)).id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [150_000, 130_000, 110_000, 90_000] as [number, number, number, number], rating: 4.5, popularity: 1 };
  const m = await createModel(prisma, locationId, { ...spec, key: 'chess', name: 'Air Blade', bikes: [{}, {}, {}, { status: 'RETIRED' }] });
  modelId = m.model.id;
  bikes = m.bikes.map((b) => b.id);
  soloModel = (await createModel(prisma, locationId, { ...spec, key: 'solo', name: 'Vision', bikes: [{}] })).model.id;
  const o = await createModel(prisma, locationId, { ...spec, key: 'other', name: 'NVX', bikes: [{}] });
  otherModel = o.model.id;
  otherBike = o.bikes[0]!.id;
  clientUserId = (await prisma.user.create({ data: { telegramId: String(CLIENT_TG), firstName: 'Client' } })).id;
  await prisma.user.create({ data: { telegramId: String(MANAGER_TG), firstName: 'Manager', role: 'MANAGER', locationId } });
  app = await createApp();
  clock = app.get(Clock);
});

afterEach(() => {
  clock.now = () => new Date();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('вход: Telegram Login Widget → cookie-сессия', () => {
  it('поддельная подпись → 401', async () => {
    const forged = { ...widget({ id: ADMIN_TG, first_name: 'Admin', auth_date: nowSec() }), first_name: 'Mallory' };
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(forged);
    expect(res.status).toBe(401);
    expect(res.body.code).toBe('UNAUTHORIZED');
  });

  it('подпись чужим токеном бота → 401', async () => {
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: ADMIN_TG, auth_date: nowSec() }, '999:other'));
    expect(res.status).toBe(401);
  });

  it('устаревший auth_date (> 24 ч) → 401', async () => {
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: ADMIN_TG, auth_date: nowSec() - 25 * 3600 }));
    expect(res.status).toBe(401);
  });

  it('верная подпись клиента без роли → 403', async () => {
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: CLIENT_TG, auth_date: nowSec() }));
    expect(res.status).toBe(403);
  });

  it('админ из ADMIN_TELEGRAM_IDS → 200, httpOnly cookie, me по cookie', async () => {
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: ADMIN_TG, first_name: 'Owner', username: 'owner', auth_date: nowSec() }));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const raw = (res.headers['set-cookie'] as unknown as string[]).find((s) => s.startsWith('admin_session='))!;
    expect(raw).toMatch(/HttpOnly/i);
    expect(raw).toMatch(/SameSite=Lax/i);
    expect(JSON.stringify(res.body)).not.toContain(raw.split(';')[0]!.split('=')[1]);
    adminCookie = cookieOf(res);
    expect((res.body as AdminSessionResponse).me.role).toBe('ADMIN');
    const me = await http().get('/api/admin/auth/me').set('Cookie', adminCookie);
    expect(me.status).toBe(200);
    expect((me.body as AdminSessionResponse).me.sections).toContain('settings');
  });

  it('менеджер входит по подписи; разделы без цен, настроек и платежей', async () => {
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: MANAGER_TG, first_name: 'Manager', auth_date: nowSec() }));
    expect(res.status).toBe(200);
    managerCookie = cookieOf(res);
    const me = (res.body as AdminSessionResponse).me;
    expect(me.role).toBe('MANAGER');
    expect(me.locationId).toBe(locationId);
    expect(me.sections).toEqual(expect.arrayContaining(['bookings', 'chess', 'fleet']));
    for (const s of ['prices', 'settings', 'payments']) expect(me.sections).not.toContain(s);
  });

  it('без cookie и с испорченной cookie → 401', async () => {
    expect((await http().get('/api/admin/dashboard')).status).toBe(401);
    expect((await http().get('/api/admin/dashboard').set('Cookie', `${adminCookie}x`)).status).toBe(401);
  });

  it('выход стирает cookie', async () => {
    const res = await http().post('/api/admin/auth/logout').set(MUT).set('Cookie', adminCookie);
    expect(res.status).toBe(204);
    expect(String(res.headers['set-cookie'])).toMatch(/admin_session=;/);
  });
});

describe('dev-вход', () => {
  it('закрыт при пустом NODE_ENV и в production', async () => {
    for (const env of ['', 'production']) {
      process.env.NODE_ENV = env;
      const res = await http().post('/api/admin/auth/dev').set(MUT).send({ role: 'admin' });
      expect(res.status, `NODE_ENV=${env}`).toBe(404);
    }
    process.env.NODE_ENV = 'test';
    const cfg = await http().get('/api/admin/auth/config');
    expect(cfg.body.devAuth).toBe(true);
  });

  it('при NODE_ENV=test и DEV_AUTH=1 — вход тестовым админом', async () => {
    const res = await http().post('/api/admin/auth/dev').set(MUT).send({ role: 'admin' });
    expect(res.status).toBe(200);
    expect((res.body as AdminSessionResponse).me.role).toBe('ADMIN');
  });
});

describe('роли', () => {
  it('менеджер: настройки, платежи, цены, журнал → 403; брони и шахматка → 200', async () => {
    for (const path of ['settings', 'payments', 'payments/x/refund', 'tariffs', 'seasons', 'audit', 'staff']) {
      const res = await http().get(`/api/admin/${path}`).set('Cookie', managerCookie);
      expect(res.status, path).toBe(403);
    }
    expect((await http().get('/api/admin/bookings').set('Cookie', managerCookie)).status).toBe(200);
    expect((await http().get('/api/admin/chess').set('Cookie', managerCookie)).status).toBe(200);
  });

  it('админ проходит проверку роли к тем же разделам (не 403)', async () => {
    const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: ADMIN_TG, auth_date: nowSec() }));
    adminCookie = cookieOf(res);
    for (const path of ['settings', 'payments']) expect((await http().get(`/api/admin/${path}`).set('Cookie', adminCookie)).status).not.toBe(403);
    expect((await http().get('/api/admin/audit').set('Cookie', adminCookie)).status).toBe(200);
  });

  it('изменение без заголовка x-admin-request → 403 (CSRF)', async () => {
    const res = await http().post('/api/admin/bookings').set('Cookie', adminCookie).send({});
    expect(res.status).toBe(403);
  });
});

describe('шахматка: перенос брони на другой байк', () => {
  it('на занятый — 409 с причиной; на свободный — сохраняется и пишется в журнал', async () => {
    const p = period(2);
    const moving = await booking({ bikeId: bikes[0]!, ...p });
    const blocker = await booking({ bikeId: bikes[1]!, startAt: new Date(p.startAt.getTime() + 12 * H), endAt: new Date(p.endAt.getTime() + DAY) });

    const busy = await http().patch(`/api/admin/bookings/${moving.id}`).set(MUT).set('Cookie', adminCookie).send({ bikeId: bikes[1] });
    expect(busy.status).toBe(409);
    expect(busy.body.code).toBe('BIKE_TAKEN');
    expect(busy.body.conflict.code).toBe(blocker.code);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: moving.id } })).bikeId).toBe(bikes[0]);

    const ok = await http().patch(`/api/admin/bookings/${moving.id}`).set(MUT).set('Cookie', adminCookie).send({ bikeId: bikes[2] });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: moving.id } })).bikeId).toBe(bikes[2]);
    const log = await prisma.auditLog.findFirst({ where: { entity: 'Booking', entityId: moving.id, action: 'booking.bike' } });
    expect(log?.diff).toMatchObject({ from: bikes[0], to: bikes[2] });
  });

  it('буфер после брони тоже занят: конец + bufferMinutes пересекается → 409', async () => {
    const p = period(1);
    const before = await booking({ bikeId: bikes[1]!, ...p });
    const after = await booking({ bikeId: bikes[2]!, startAt: new Date(p.endAt.getTime() + 30 * 60_000), endAt: new Date(p.endAt.getTime() + DAY) });
    const res = await http().patch(`/api/admin/bookings/${after.id}`).set(MUT).set('Cookie', adminCookie).send({ bikeId: bikes[1] });
    expect(res.status).toBe(409);
    expect(res.body.conflict.code).toBe(before.code);
  });

  it('на списанный байк и на байк другой модели — 409 с причиной', async () => {
    const b = await booking({ bikeId: bikes[0]!, ...period(1) });
    const retired = await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', adminCookie).send({ bikeId: bikes[3] });
    expect(retired.status).toBe(409);
    expect(retired.body.code).toBe('BIKE_UNAVAILABLE');
    const other = await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', adminCookie).send({ bikeId: otherBike });
    expect(other.status).toBe(409);
    expect(other.body.code).toBe('BIKE_MODEL_MISMATCH');
  });

  it('GET /admin/chess отдаёт байки строками и брони полосами в окне', async () => {
    const p = period(1);
    const b = await booking({ bikeId: bikes[0]!, ...p });
    const res = await http().get('/api/admin/chess').query({ from: new Date(p.startAt.getTime() - DAY).toISOString(), to: new Date(p.endAt.getTime() + DAY).toISOString() }).set('Cookie', managerCookie);
    expect(res.status).toBe(200);
    const body = res.body as ChessResponse;
    expect(body.bikes.map((x) => x.id)).toEqual(expect.arrayContaining([bikes[0], bikes[1], bikes[2], otherBike]));
    const bar = body.bookings.find((x) => x.id === b.id)!;
    expect(bar.bikeId).toBe(bikes[0]);
    expect(new Date(bar.blockedUntil).getTime()).toBe(p.endAt.getTime() + 60 * 60_000);
  });
});

describe('ручная бронь для клиента «с улицы»', () => {
  const manual = (body: Record<string, unknown>) => http().post('/api/admin/bookings').set(MUT).set('Cookie', managerCookie).send({ paymentMethod: 'CASH', phone: '+84905550001', name: 'Walk-in Tom', ...body });

  it('свободный байк → 201, клиент заведён, наличные — «Подтверждена», в журнале', async () => {
    const p = period(2);
    const res = await manual({ modelId: soloModel, startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const d = res.body as AdminBookingDetail;
    expect(d.status).toBe('CONFIRMED');
    expect(d.client.walkIn).toBe(true);
    expect(d.client.phone).toBe('+84905550001');
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: d.id } })).totalAmount).toBe(2 * 150_000);
    expect(await prisma.auditLog.count({ where: { entity: 'Booking', entityId: d.id, action: 'booking.manual' } })).toBe(1);
  });

  it('занятый период → 409 BIKE_TAKEN (та же проверка доступности, что в Mini App)', async () => {
    const p = period(1);
    const first = await manual({ modelId: soloModel, startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() });
    expect(first.status).toBe(201);
    const second = await manual({ modelId: soloModel, phone: '+84905550002', startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() });
    expect(second.status).toBe(409);
    expect(second.body.code).toBe('BIKE_TAKEN');
  });

  it('выбранный в шахматке занятый байк → 409 с причиной, брони не создаётся', async () => {
    const p = period(1);
    const blocker = await booking({ bikeId: bikes[2]!, ...p });
    const before = await prisma.booking.count();
    const res = await manual({ modelId, bikeId: bikes[2], startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() });
    expect(res.status).toBe(409);
    expect(res.body.conflict.code).toBe(blocker.code);
    expect(await prisma.booking.count()).toBe(before);
  });

  it('выбранный свободный байк → бронь на нём', async () => {
    const p = period(1);
    const res = await manual({ modelId, bikeId: bikes[1], startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect((res.body as AdminBookingDetail).bikeId).toBe(bikes[1]);
  });

  it('сотрудник оформляет выдачу «прямо сейчас» (без minLeadMinutes), но не в прошлом; без телефона → 400', async () => {
    const past = new Date(Date.now() - 60 * 60_000);
    const res = await manual({ modelId: otherModel, startAt: past.toISOString(), endAt: new Date(past.getTime() + DAY).toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('LEAD_TIME');
    const p = period(1);
    expect((await manual({ modelId: otherModel, phone: '12', startAt: p.startAt.toISOString(), endAt: p.endAt.toISOString() })).status).toBe(400);
  });
});

describe('брони: список, карточка, смена статуса', () => {
  it('фильтр по статусу и датам; карточка с историей и платежами; смена статуса в журнале', async () => {
    const p = period(1);
    const b = await booking({ bikeId: bikes[0]!, ...p, status: 'PENDING_PAYMENT', total: 150_000 });
    await prisma.bookingStatusChange.create({ data: { bookingId: b.id, from: null, to: 'PENDING_PAYMENT' } });
    await prisma.payment.create({ data: { bookingId: b.id, kind: 'RENT', method: 'VIETQR', amount: 150_000, status: 'PENDING' } });

    const list = await http()
      .get('/api/admin/bookings')
      .query({ status: 'PENDING_PAYMENT', from: p.startAt.toISOString(), to: p.endAt.toISOString() })
      .set('Cookie', managerCookie);
    expect(list.status).toBe(200);
    const items = (list.body as AdminBookingList).items;
    expect(items.map((x) => x.id)).toEqual([b.id]);

    const card = await http().get(`/api/admin/bookings/${b.id}`).set('Cookie', managerCookie);
    expect(card.status).toBe(200);
    const d = card.body as AdminBookingDetail;
    expect(d.history.map((h) => h.to)).toEqual(['PENDING_PAYMENT']);
    // Менеджеру суммы и платежи в админке не показываются (история 84)
    expect(d.payments).toEqual([]);
    expect(d.totalAmount).toBe(0);
    expect(d.booking.totalAmount).toBe(0);
    expect(items[0]!.totalAmount).toBe(0);
    const asAdmin = (await http().get(`/api/admin/bookings/${b.id}`).set('Cookie', adminCookie)).body as AdminBookingDetail;
    expect(asAdmin.payments).toHaveLength(1);
    expect(d.nextStatuses).toContain('CONFIRMED');

    const patch = await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', managerCookie).send({ status: 'CONFIRMED', reason: 'paid in cash' });
    expect(patch.status, JSON.stringify(patch.body)).toBe(200);
    expect((patch.body as AdminBookingDetail).history.map((h) => h.to)).toEqual(['PENDING_PAYMENT', 'CONFIRMED']);
    expect(await prisma.auditLog.count({ where: { entityId: b.id, action: 'booking.status' } })).toBe(1);

    const bad = await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', managerCookie).send({ status: 'COMPLETED' });
    expect(bad.status).toBe(409);
  });

  it('журнал действий доступен админу и содержит изменения броней', async () => {
    const res = await http().get('/api/admin/audit').query({ entity: 'Booking' }).set('Cookie', adminCookie);
    expect(res.status).toBe(200);
    const actions = (res.body as AuditList).items.map((i) => i.action);
    expect(actions).toEqual(expect.arrayContaining(['booking.bike', 'booking.manual', 'booking.status']));
  });
});

describe('дашборд', () => {
  // «Сейчас» — чт 12.11.2026 09:00 в Asia/Ho_Chi_Minh (UTC+7). Неделя пн 09.11 – вс 15.11, месяц — ноябрь.
  const local = (d: string, hh: number) => new Date(`${d}T${String(hh).padStart(2, '0')}:00:00+07:00`);

  it('выдачи и возвраты сегодня, загрузка, выручка, неоплаченные, воронка — по фикстуре', async () => {
    await prisma.booking.deleteMany({});
    await prisma.analyticsEvent.deleteMany({});
    clock.now = () => local('2026-11-12', 9);
    const [b1, b2, b3] = bikes as [string, string, string, string];
    // Выдача сегодня, 300 000 ₫ — день, неделя, месяц
    await booking({ bikeId: b1, startAt: local('2026-11-12', 10), endAt: local('2026-11-14', 10), status: 'CONFIRMED', total: 300_000 });
    // Выдан во вторник, возврат сегодня; 200 000 + опоздание 50 000 — неделя и месяц
    await booking({ bikeId: b2, startAt: local('2026-11-10', 10), endAt: local('2026-11-12', 18), status: 'ISSUED', total: 200_000, lateFee: 50_000 });
    // Ожидает оплаты — неоплаченная, не выручка
    await booking({ bikeId: b3, startAt: local('2026-11-20', 10), endAt: local('2026-11-21', 10), status: 'PENDING_PAYMENT', total: 100_000 });
    // Отменена сегодня — нигде не считается
    await booking({ bikeId: b3, startAt: local('2026-11-12', 12), endAt: local('2026-11-13', 12), status: 'CANCELLED_BY_CLIENT', total: 999_000 });
    // Завершена 2–4 ноября — только месяц
    await booking({ bikeId: b3, startAt: local('2026-11-02', 10), endAt: local('2026-11-04', 10), status: 'COMPLETED', total: 400_000 });
    // Октябрь — не входит
    await booking({ bikeId: b3, startAt: local('2026-10-30', 10), endAt: local('2026-10-31', 10), status: 'COMPLETED', total: 700_000 });
    const ev = (name: string, source: string | null, at: Date) => prisma.analyticsEvent.create({ data: { name, source, createdAt: at } });
    await ev('open', 'ads', local('2026-11-11', 10));
    await ev('open', 'ads', local('2026-11-12', 8));
    await ev('open', null, local('2026-11-12', 8));
    await ev('open', 'ads', local('2026-09-01', 8)); // старше 30 дней
    await ev('dates_selected', null, local('2026-11-12', 8));
    await ev('dates_selected', null, local('2026-11-12', 8));
    await ev('paid', null, local('2026-11-12', 8));

    const res = await http().get('/api/admin/dashboard').set('Cookie', adminCookie);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const d = res.body as AdminDashboard;
    expect(d.date).toBe('2026-11-12');
    expect(d.issuesToday).toBe(1);
    expect(d.returnsToday).toBe(1);
    // Парк модели chess: 3 действующих + 1 списанный; solo и other — по 1. Всего действующих 5, заняты сегодня 2 → 40 %
    expect(d.fleetSize).toBe(5);
    expect(d.busyBikes).toBe(2);
    expect(d.fleetLoadPercent).toBe(40);
    expect(d.revenue).toEqual({ day: 300_000, week: 550_000, month: 950_000 });
    expect(d.unpaid.count).toBe(1);
    expect(Object.fromEntries(d.funnel.steps.map((s) => [s.name, s.count]))).toEqual({ open: 3, dates_selected: 2, model_viewed: 0, checkout_opened: 0, paid: 1 });
    expect(d.funnel.sources).toEqual([{ source: 'ads', count: 2 }]);

    const asManager = await http().get('/api/admin/dashboard').set('Cookie', managerCookie);
    expect(asManager.status).toBe(200);
    expect((asManager.body as AdminDashboard).revenue).toBeNull();
  });
});
