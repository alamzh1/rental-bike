import { createHash, createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fromLocationDateTime, toLocationDate } from '@rental/shared';
import type { AdminBookingList, AdminDashboard, AuthResponse, ChessResponse, ManagerBike, ManagerTodayResponse } from '@rental/shared';
import { createApp, createBooking, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN, TZ } from './support/catalog-fixture';

// Ремонт ветки (F1): область видимости сотрудника. Менеджер видит только свою точку (история 84),
// документы — только менеджер точки и администратор (история 54). Менеджер без точки не видит ничего.
// Данные точки B: бронь сегодня (выдача), байк, модель, документ клиента.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const envBackup = { ...process.env };
const MUT = { 'x-admin-request': '1' };
const TG = { client: 8101, managerA: 8102, managerNone: 8103, admin: 8104 };

let bookingB = '';
let bikeB = '';
let modelB = '';
let docB = '';
const bearer: Record<string, string> = {};
const cookie: Record<string, string> = {};

function widget(fields: Record<string, string | number>): Record<string, string | number> {
  const dcs = Object.keys(fields).sort().map((k) => `${k}=${fields[k]}`).join('\n');
  const secret = createHash('sha256').update(TEST_BOT_TOKEN).digest();
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') };
}

async function miniappLogin(telegramId: number): Promise<string> {
  const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: telegramId, first_name: 'T', language_code: 'en' }) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return (res.body as AuthResponse).token;
}

async function adminLogin(telegramId: number): Promise<string> {
  const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: telegramId, first_name: 'Staff', auth_date: Math.floor(Date.now() / 1000) }));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const raw = (res.headers['set-cookie'] as unknown as string[]).find((s) => s.startsWith('admin_session='))!;
  return raw.split(';')[0]!;
}

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(TG.admin);
  process.env.NODE_ENV = 'test';
  await resetDb(prisma);
  await createSettings(prisma);
  const a = await createLocation(prisma);
  const b = await createLocation(prisma);
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [150_000, 130_000, 110_000, 90_000] as [number, number, number, number], rating: 4.5, popularity: 1 };
  await createModel(prisma, a.id, { ...spec, key: 'scope-a', name: 'Vision', bikes: [{}] });
  const mb = await createModel(prisma, b.id, { ...spec, key: 'scope-b', name: 'Air Blade', bikes: [{}] });
  modelB = mb.model.id;
  bikeB = mb.bikes[0]!.id;
  app = await createApp();
  for (const [k, id] of Object.entries(TG)) bearer[k] = await miniappLogin(id);
  const client = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG.client) } });
  await prisma.user.update({ where: { telegramId: String(TG.managerA) }, data: { role: 'MANAGER', locationId: a.id } });
  await prisma.user.update({ where: { telegramId: String(TG.managerNone) }, data: { role: 'MANAGER', locationId: null } });
  // Выдача сегодня в полдень по часам точки: не зависит от времени суток запуска (now+2ч после 22:00 уже «завтра»)
  const start = fromLocationDateTime(toLocationDate(new Date(), TZ), '12:00', TZ);
  bookingB = (await createBooking(prisma, { userId: client.id, modelId: modelB, locationId: b.id, bikeId: bikeB, startAt: start, endAt: new Date(start.getTime() + 24 * H) })).id;
  docB = (await prisma.document.create({ data: { userId: client.id, type: 'PASSPORT', fileKey: `documents/${client.id}/passport` } })).id;
  for (const k of ['managerA', 'managerNone', 'admin'] as const) cookie[k] = await adminLogin(TG[k]);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe.each([['managerA'], ['managerNone']] as const)('%s не видит данные точки B', (who) => {
  const tma = () => ({ Authorization: `Bearer ${bearer[who]}` });
  const adm = () => ({ Cookie: cookie[who]! });

  it('документ чужой точки: /documents/:id/url → 404', async () => {
    expect((await http().get(`/api/documents/${docB}/url`).set(tma())).status).toBe(404);
  });

  it('режим менеджера: бронь и байк точки B → 403, в списках их нет', async () => {
    expect((await http().get(`/api/manager/bookings/${bookingB}`).set(tma())).status).toBe(403);
    expect((await http().patch(`/api/manager/bikes/${bikeB}`).set(tma()).send({ status: 'REPAIR' })).status).toBe(403);
    const today = (await http().get('/api/manager/today').set(tma())).body as ManagerTodayResponse;
    expect([...today.issues, ...today.returns].map((c) => c.id)).not.toContain(bookingB);
    const bikes = (await http().get('/api/manager/bikes').set(tma())).body as ManagerBike[];
    expect(bikes.map((x) => x.id)).not.toContain(bikeB);
  });

  it('админка: бронь и документ точки B → 404, в списке броней их нет', async () => {
    expect((await http().get(`/api/admin/bookings/${bookingB}`).set(adm())).status).toBe(404);
    expect((await http().get(`/api/admin/bookings/${bookingB}/documents/${docB}/url`).set(adm())).status).toBe(404);
    const list = (await http().get('/api/admin/bookings').set(adm())).body as AdminBookingList;
    expect(list.items.map((r) => r.id)).not.toContain(bookingB);
  });

  it('админка: парк, шахматка, дашборд и ручная бронь не раскрывают точку B', async () => {
    expect((await http().get(`/api/admin/bikes/${bikeB}`).set(adm())).status).toBe(404);
    expect((await http().get(`/api/admin/models/${modelB}`).set(adm())).status).toBe(404);
    const bikes = (await http().get('/api/admin/bikes').set(adm())).body as { items: { id: string }[] };
    expect(bikes.items.map((x) => x.id)).not.toContain(bikeB);
    const models = (await http().get('/api/admin/models').set(adm())).body as { items: { id: string }[] };
    expect(models.items.map((x) => x.id)).not.toContain(modelB);
    const chess = (await http().get('/api/admin/chess').set(adm())).body as ChessResponse;
    expect(chess.bikes.map((x) => x.id)).not.toContain(bikeB);
    expect(chess.bookings.map((x) => x.id)).not.toContain(bookingB);
    const dash = (await http().get('/api/admin/dashboard').set(adm())).body as AdminDashboard;
    expect(dash.issuesToday).toBe(0);
    expect(dash.unpaid.items.map((r) => r.id)).not.toContain(bookingB);
    const start = new Date(Date.now() + 72 * H);
    const manual = await http().post('/api/admin/bookings').set(adm()).set(MUT)
      .send({ modelId: modelB, paymentMethod: 'CASH', phone: '+84901230000', startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString() });
    expect(manual.status).toBe(404);
  });
});

describe('администратор видит точку B', () => {
  it('бронь, документ и шахматка доступны', async () => {
    const adm = { Cookie: cookie.admin! };
    expect((await http().get(`/api/admin/bookings/${bookingB}`).set(adm)).status).toBe(200);
    expect((await http().get(`/api/documents/${docB}/url`).set({ Authorization: `Bearer ${bearer.admin}` })).status).toBe(200);
    const chess = (await http().get('/api/admin/chess').set(adm)).body as ChessResponse;
    expect(chess.bikes.map((x) => x.id)).toContain(bikeB);
    const dash = (await http().get('/api/admin/dashboard').set(adm)).body as AdminDashboard;
    expect(dash.issuesToday).toBe(1);
  });
});
