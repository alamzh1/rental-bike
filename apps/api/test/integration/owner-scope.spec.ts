import { createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ADMIN_LOCATION_HEADER, type AdminFinanceSummary, type AdminListOf, type AdminLocation, type AuthResponse, type Booking } from '@rental/shared';
import { BotBookingsService } from '../../src/notifications/bot-bookings.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { NOTIFIER, type LogNotifier } from '../../src/notifications/notifier';
import { payOsDataString } from '../../src/payments/payos-provider';
import { createApp, createBooking, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Несколько арендодателей: владелец видит и меняет только свою точку; деньги каждой точки идут на её счёт payOS.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
let app: INestApplication;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const MUT = { 'x-admin-request': '1' };
const TG = { client: 9101, ownerA: 9102, ownerB: 9103, managerB: 9104, admin: 9105 };
const KEYS = { a: { clientId: 'client-a', apiKey: 'api-secret-a', checksumKey: 'checksum-secret-a' }, b: { clientId: 'client-b', apiKey: 'api-secret-b', checksumKey: 'checksum-secret-b' } };

let locA = '';
let locB = '';
let modelA = '';
let modelB = '';
let bikeA = '';
let bikeB = '';
let bookingB = '';
let paymentB = '';
let expenseB = '';
let ownerAId = '';
const auth: Record<string, Record<string, string>> = {};

const adminAs = (who: keyof typeof auth) => auth[who]!;

async function staffSession(telegramId: number): Promise<Record<string, string>> {
  const res = await http().post('/api/admin/auth/webapp').set(MUT).send({ initData: signInitData({ id: telegramId, first_name: 'S', language_code: 'en' }) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { Authorization: `Bearer ${(res.body as { token: string }).token}` };
}

const signed = (data: Record<string, unknown>, key: string) => ({ code: '00', desc: 'success', success: true, data, signature: createHmac('sha256', key).update(payOsDataString(data)).digest('hex') });

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(TG.admin);
  process.env.API_PUBLIC_URL = 'https://app.example.com';
  process.env.PAYMENT_KEYS_SECRET = 'test-payment-keys-secret';
  for (const k of ['PAYOS_CLIENT_ID', 'PAYOS_API_KEY', 'PAYOS_CHECKSUM_KEY', 'PAYOS_WEBHOOK_IPS']) delete process.env[k];
  await resetDb(prisma);
  await createSettings(prisma, { depositMode: 'DOCUMENT' });
  const a = await createLocation(prisma);
  const b = await prisma.location.create({ data: { name: { ru: 'Точка Б', en: 'Point B', vi: 'Điểm B' }, address: 'B street', lat: 1, lng: 1 } });
  locA = a.id;
  locB = b.id;
  const spec = { brand: 'Honda', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: [], prices: [200_000, 180_000, 160_000, 140_000], rating: 4.5, popularity: 1, bikes: [{}] } as const;
  const ma = await createModel(prisma, locA, { ...spec, key: 'a', name: 'Vision A', bikes: [{}] } as never);
  const mb = await createModel(prisma, locB, { ...spec, key: 'b', name: 'Vision B', bikes: [{}] } as never);
  modelA = ma.model.id;
  modelB = mb.model.id;
  bikeA = (await prisma.bike.findFirstOrThrow({ where: { modelId: modelA } })).id;
  bikeB = (await prisma.bike.findFirstOrThrow({ where: { modelId: modelB } })).id;

  app = await createApp();
  const client = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: TG.client, first_name: 'C', language_code: 'ru' }) });
  auth.client = { Authorization: `Bearer ${(client.body as AuthResponse).token}` };
  const clientId = (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG.client) } })).id;
  for (const [tg, role, locationId] of [[TG.ownerA, 'OWNER', locA], [TG.ownerB, 'OWNER', locB], [TG.managerB, 'MANAGER', locB]] as const) {
    await prisma.user.create({ data: { telegramId: String(tg), firstName: 'Staff', role, locationId, lang: 'ru' } });
  }
  ownerAId = (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG.ownerA) } })).id;
  auth.ownerA = await staffSession(TG.ownerA);
  auth.ownerB = await staffSession(TG.ownerB);
  auth.managerB = await staffSession(TG.managerB);
  auth.admin = await staffSession(TG.admin);

  const start = new Date(Date.now() - 2 * H);
  const created = await createBooking(prisma, { userId: clientId, modelId: modelB, locationId: locB, bikeId: bikeB, startAt: start, endAt: new Date(start.getTime() + 48 * H), status: 'ISSUED' } as never);
  bookingB = created.id;
  paymentB = (await prisma.payment.create({ data: { bookingId: bookingB, kind: 'RENT', method: 'CASH', amount: 500_000, status: 'PAID', paidAt: new Date() } })).id;
  expenseB = (await prisma.expense.create({ data: { locationId: locB, bikeId: bikeB, category: 'OTHER', amount: 77_000, date: new Date(), createdById: ownerAId } })).id;
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('владелец видит только свою точку', () => {
  it('финансы: чужие доход, расход и байки не видны', async () => {
    const own = (await http().get('/api/admin/finance/summary').set(adminAs('ownerA'))).body as AdminFinanceSummary;
    expect(own.income).toBe(0);
    expect(own.expenses).toBe(0);
    expect(own.bikes.map((x) => x.bikeId)).toEqual([bikeA]);
    const other = (await http().get('/api/admin/finance/summary').set(adminAs('ownerB'))).body as AdminFinanceSummary;
    expect(other.expenses).toBe(77_000);
    expect(other.bikes.map((x) => x.bikeId)).toEqual([bikeB]);
  });

  it('параметр и заголовок точки не расширяют область владельца', async () => {
    const q = (await http().get('/api/admin/finance/summary').query({ locationId: locB }).set(adminAs('ownerA'))).body as AdminFinanceSummary;
    expect(q.bikes.map((x) => x.bikeId)).toEqual([bikeA]);
    const h = (await http().get('/api/admin/finance/summary').set(adminAs('ownerA')).set(ADMIN_LOCATION_HEADER, locB)).body as AdminFinanceSummary;
    expect(h.bikes.map((x) => x.bikeId)).toEqual([bikeA]);
  });

  it('чужой расход нельзя ни создать на чужой байк, ни изменить, ни удалить', async () => {
    const o = adminAs('ownerA');
    expect((await http().post('/api/admin/finance/expenses').set({ ...o, ...MUT }).send({ date: '2026-11-01', category: 'OTHER', amount: 1, bikeId: bikeB })).status).toBe(400);
    expect((await http().patch(`/api/admin/finance/expenses/${expenseB}`).set({ ...o, ...MUT }).send({ amount: 1 })).status).toBe(404);
    expect((await http().delete(`/api/admin/finance/expenses/${expenseB}`).set({ ...o, ...MUT })).status).toBe(404);
  });

  it('общий расход владельца записывается на его точку, а не на первую', async () => {
    const res = await http().post('/api/admin/finance/expenses').set({ ...adminAs('ownerB'), ...MUT }).send({ date: '2026-11-01', category: 'OTHER', amount: 5 });
    expect(res.status).toBe(201);
    expect(res.body.locationId).toBe(locB);
    await prisma.expense.delete({ where: { id: res.body.id as string } });
  });

  it('брони, платежи и сверка чужой точки закрыты', async () => {
    const o = adminAs('ownerA');
    expect((await http().get('/api/admin/bookings').set(o)).body.total).toBe(0);
    expect((await http().get(`/api/admin/bookings/${bookingB}`).set(o)).status).toBe(404);
    expect((await http().get('/api/admin/payments').set(o)).body.total).toBe(0);
    expect((await http().get('/api/admin/payments/reconciliation').set(o)).body.total).toBe(0);
    expect((await http().post(`/api/admin/payments/${paymentB}/refund`).set({ ...o, ...MUT }).send({ amount: 1 })).status).toBe(404);
    expect((await http().get('/api/admin/payments').set(adminAs('ownerB'))).body.total).toBe(1);
  });

  it('парк: свой правит, чужой недоступен; новая модель всегда на своей точке', async () => {
    const o = adminAs('ownerA');
    const models = (await http().get('/api/admin/models').set(o)).body.items as { id: string }[];
    expect(models.map((m) => m.id)).toEqual([modelA]);
    expect((await http().get('/api/admin/bikes').set(o)).body.items.map((x: { id: string }) => x.id)).toEqual([bikeA]);
    expect((await http().patch(`/api/admin/models/${modelB}`).set({ ...o, ...MUT }).send({ name: 'Hacked' })).status).toBe(404);
    expect((await http().patch(`/api/admin/models/${modelB}/photos`).set({ ...o, ...MUT }).send({ key: 'x', action: 'main' })).status).toBe(404);
    expect((await http().patch(`/api/admin/bikes/${bikeB}`).set({ ...o, ...MUT }).send({ mileageKm: 1 })).status).toBe(404);
    expect((await http().post('/api/admin/bikes').set({ ...o, ...MUT }).send({ modelId: modelB, plate: 'HACK-1' })).status).toBe(400);
    expect((await http().patch(`/api/admin/bikes/${bikeA}`).set({ ...o, ...MUT }).send({ modelId: modelB })).status).toBe(400);
    const brandId = (await prisma.bikeModel.findUniqueOrThrow({ where: { id: modelA } })).brandId;
    const made = await http().post('/api/admin/models').set({ ...o, ...MUT }).send({ locationId: locB, brandId, name: 'Own', category: 'SCOOTER', transmission: 'AUTOMATIC', description: { ru: 'x', en: 'x', vi: 'x' }, deposit: 0 });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    expect(made.body.locationId).toBe(locA);
    const moved = await http().patch(`/api/admin/models/${made.body.id as string}`).set({ ...o, ...MUT }).send({ locationId: locB });
    expect(moved.body.locationId).toBe(locA);
    await prisma.bikeModel.delete({ where: { id: made.body.id as string } });
  });

  it('цены: свои тарифы и сезоны; общие сезоны и опции только для чтения', async () => {
    const o = adminAs('ownerA');
    expect((await http().get('/api/admin/tariffs').set(o)).body.items.map((x: { modelId: string }) => x.modelId)).toEqual([modelA]);
    expect((await http().patch(`/api/admin/tariffs/${modelB}`).set({ ...o, ...MUT }).send({ tariffs: [{ minDays: 1, maxDays: null, pricePerDay: 1 }] })).status).toBe(404);
    const season = { name: { ru: 's', en: 's', vi: 's' }, from: '2026-12-01', to: '2026-12-02', coefficient: 1.5 };
    const own = await http().post('/api/admin/seasons').set({ ...o, ...MUT }).send({ ...season, locationId: locB });
    expect(own.body.locationId).toBe(locA);
    const shared = await prisma.seasonRule.create({ data: { name: season.name, from: new Date('2026-12-10'), to: new Date('2026-12-11'), coefficient: 2 } });
    const foreign = await prisma.seasonRule.create({ data: { locationId: locB, name: season.name, from: new Date('2026-12-20'), to: new Date('2026-12-21'), coefficient: 2 } });
    const seen = (await http().get('/api/admin/seasons').set(o)).body.items.map((x: { id: string }) => x.id);
    expect(seen).toContain(shared.id);
    expect(seen).not.toContain(foreign.id);
    expect((await http().patch(`/api/admin/seasons/${shared.id}`).set({ ...o, ...MUT }).send({ coefficient: 9 })).status).toBe(404);
    expect((await http().delete(`/api/admin/seasons/${foreign.id}`).set({ ...o, ...MUT })).status).toBe(404);
    expect((await http().get('/api/admin/extras').set(o)).status).toBe(200);
    expect((await http().post('/api/admin/extras').set({ ...o, ...MUT }).send({ code: 'X', name: season.name, price: 1, per: 'DAY' })).status).toBe(403);
    await prisma.seasonRule.deleteMany({ where: { id: { in: [own.body.id as string, shared.id, foreign.id] } } });
  });

  it('общие разделы закрыты', async () => {
    for (const path of ['settings', 'audit', 'banner', 'texts']) expect((await http().get(`/api/admin/${path}`).set(adminAs('ownerA'))).status).toBe(403);
  });

  it('точки: только своя; новая точка и назначение владельца — у администратора', async () => {
    const o = adminAs('ownerA');
    const list = (await http().get('/api/admin/locations').set(o)).body as AdminListOf<AdminLocation>;
    expect(list.items.map((l) => l.id)).toEqual([locA]);
    expect((await http().patch(`/api/admin/locations/${locB}`).set({ ...o, ...MUT }).send({ address: 'x' })).status).toBe(404);
    expect((await http().patch(`/api/admin/locations/${locA}`).set({ ...o, ...MUT }).send({ isActive: false })).status).toBe(403);
    const saved = await http().patch(`/api/admin/locations/${locA}`).set({ ...o, ...MUT }).send({ contact: '@point_a', legalName: 'Nguyen Van A' });
    expect(saved.body).toMatchObject({ contact: '@point_a', legalName: 'Nguyen Van A' });
    expect((await http().post('/api/admin/locations').set({ ...o, ...MUT }).send({ name: { ru: 'x', en: 'x', vi: 'x' }, address: 'x', lat: 1, lng: 1 })).status).toBe(403);
    expect((await http().post(`/api/admin/locations/${locA}/owners`).set({ ...o, ...MUT }).send({ telegramId: '555001' })).status).toBe(403);
  });

  it('владелец нанимает менеджера, но не может забрать чужого сотрудника', async () => {
    const o = adminAs('ownerA');
    const free = await http().post(`/api/admin/locations/${locA}/managers`).set({ ...o, ...MUT }).send({ telegramId: '555002' });
    expect(free.status).toBe(201);
    expect((free.body as AdminLocation).managers.map((m) => m.telegramId)).toContain('555002');
    const stolen = await http().post(`/api/admin/locations/${locA}/managers`).set({ ...o, ...MUT }).send({ telegramId: String(TG.managerB) });
    expect(stolen.status).toBe(409);
    const owner = await http().post(`/api/admin/locations/${locA}/managers`).set({ ...o, ...MUT }).send({ telegramId: String(TG.ownerB) });
    expect(owner.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG.ownerB) } })).role).toBe('OWNER');
  });

  it('менеджер точки по-прежнему не видит суммы и финансы', async () => {
    const m = adminAs('managerB');
    expect((await http().get('/api/admin/finance/summary').set(m)).status).toBe(403);
    expect((await http().get('/api/admin/bookings').set(m)).body.items[0].totalAmount).toBe(0);
    expect((await http().get(`/api/admin/locations`).set(m)).status).toBe(403);
  });

  it('владелец видит суммы своих броней', async () => {
    const rows = (await http().get('/api/admin/bookings').set(adminAs('ownerB'))).body.items as { paidAmount: number }[];
    expect(rows[0]!.paidAmount).toBe(500_000);
  });

  it('администратор: все точки или одна по заголовку; панель показывает выбранную', async () => {
    const all = (await http().get('/api/admin/bikes').set(adminAs('admin'))).body.items as { id: string }[];
    expect(all.map((x) => x.id).sort()).toEqual([bikeA, bikeB].sort());
    const one = (await http().get('/api/admin/bikes').set(adminAs('admin')).set(ADMIN_LOCATION_HEADER, locB)).body.items as { id: string }[];
    expect(one.map((x) => x.id)).toEqual([bikeB]);
    expect((await http().get('/api/admin/locations').set(adminAs('admin')).set(ADMIN_LOCATION_HEADER, locB)).body.total).toBe(2);
  });

  it('уведомления точки получает её владелец, а не чужой', async () => {
    const notifier = app.get<LogNotifier>(NOTIFIER);
    notifier.sent.length = 0;
    await prisma.bike.update({ where: { id: bikeB }, data: { lastLat: 1, lastLng: 1, lastSpeedKmh: 30 } });
    await app.get(NotificationsService).bikeMoving(bikeB);
    const to = notifier.sent.map((s) => s.telegramId);
    expect(to).toContain(String(TG.ownerB));
    expect(to).toContain(String(TG.managerB));
    expect(to).not.toContain(String(TG.ownerA));
  });
});

describe('каталог для клиента', () => {
  it('при нескольких точках карточка называет точку, контакт брони — контакт её точки', async () => {
    const items = (await http().get('/api/models').set(adminAs('client'))).body.items as { id: string; pointName: { en: string } | null }[];
    expect(items.find((m) => m.id === modelB)?.pointName?.en).toBe('Point B');
    await prisma.location.update({ where: { id: locB }, data: { contact: '@point_b' } });
    const booking = (await http().get(`/api/bookings/${bookingB}`).set(adminAs('client'))).body as Booking;
    expect(booking.location.contact).toBe('@point_b');
  });
});

describe('кнопки бота', () => {
  const bot = () => app.get(BotBookingsService);

  it('клиент видит свои брони и срок возврата с кнопкой открытия', async () => {
    const my = await bot().reply(String(TG.client), 'my', 'ru');
    expect(my.text).toContain('Твои брони');
    expect(my.text).toContain('Vision B');
    expect(my.open).toHaveLength(1);
    const ending = await bot().reply(String(TG.client), 'ending', 'ru');
    expect(ending.text).toContain('Вернуть до');
    expect(ending.text).toMatch(/Осталось 1 д/);
  });

  it('просрочка называется просрочкой', async () => {
    const original = await prisma.booking.findUniqueOrThrow({ where: { id: bookingB } });
    await prisma.booking.update({ where: { id: bookingB }, data: { endAt: new Date(Date.now() - H) } });
    const r = await bot().reply(String(TG.client), 'ending', 'ru');
    await prisma.booking.update({ where: { id: bookingB }, data: { endAt: original.endAt } });
    expect(r.text).toContain('Просрочено на');
  });

  it('сотрудник видит брони только своей точки, чужой владелец — ни одной', async () => {
    expect((await bot().reply(String(TG.ownerB), 'ending', 'ru')).text).toContain('Vision B');
    expect((await bot().reply(String(TG.managerB), 'my', 'ru')).text).toContain('Брони точки');
    const foreign = await bot().reply(String(TG.ownerA), 'my', 'ru');
    expect(foreign.text).toBe('Активных броней нет.');
    expect(foreign.text).not.toContain('Vision B');
  });

  it('незнакомый пользователь получает пустой ответ, а не ошибку', async () => {
    expect((await bot().reply('123456', 'my', 'en')).text).toBe('No active bookings.');
  });
});

describe('счёт оплаты точки', () => {
  const payos = new Map<string, unknown>();

  beforeAll(() => {
    const real = globalThis.fetch;
    vi.stubGlobal('fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/confirm-webhook')) {
        const client = (init?.headers as Record<string, string>)['x-client-id'];
        return new Response('{}', { status: client === 'client-bad' ? 401 : 200 });
      }
      if (url.endsWith('/v2/payment-requests')) {
        const body = JSON.parse(String(init?.body)) as { orderCode: number };
        payos.set((init?.headers as Record<string, string>)['x-client-id']!, body);
        return new Response(JSON.stringify({ code: '00', desc: 'ok', data: { qrCode: 'QR', checkoutUrl: 'https://pay.example.com' } }), { status: 200 });
      }
      return real(input, init);
    });
  });

  it('ключи проверяются, хранятся зашифрованными и не возвращаются', async () => {
    const res = await http().put(`/api/admin/locations/${locA}/payos`).set({ ...adminAs('ownerA'), ...MUT }).send(KEYS.a);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const text = JSON.stringify(res.body);
    expect(text).not.toContain(KEYS.a.apiKey);
    expect(text).not.toContain(KEYS.a.checksumKey);
    expect((res.body as AdminLocation).payos).toMatchObject({ account: 'own', clientId: 'client-a', webhookUrl: `https://app.example.com/api/webhooks/payos/${locA}` });
    expect((res.body as AdminLocation).payos.webhookConfirmedAt).not.toBeNull();
    const row = await prisma.location.findUniqueOrThrow({ where: { id: locA } });
    expect(row.payosApiKey).not.toContain(KEYS.a.apiKey);
    expect(row.payosChecksumKey).not.toContain(KEYS.a.checksumKey);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'location.payos.set', entityId: locA } });
    expect(JSON.stringify(audit.diff)).not.toContain('secret');
  });

  it('владелец не может подключить счёт к чужой точке', async () => {
    expect((await http().put(`/api/admin/locations/${locB}/payos`).set({ ...adminAs('ownerA'), ...MUT }).send(KEYS.a)).status).toBe(404);
  });

  it('ключи, которые payOS не принял, не заменяют рабочие', async () => {
    const res = await http().put(`/api/admin/locations/${locA}/payos`).set({ ...adminAs('ownerA'), ...MUT }).send({ ...KEYS.a, clientId: 'client-bad' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PAYOS_KEYS_REJECTED');
    expect((await prisma.location.findUniqueOrThrow({ where: { id: locA } })).payosClientId).toBe('client-a');
  });

  it('оплата идёт на счёт точки; подпись другой точки и общий webhook её не подтверждают', async () => {
    await http().put(`/api/admin/locations/${locB}/payos`).set({ ...adminAs('ownerB'), ...MUT }).send(KEYS.b).expect(200);
    const start = new Date(Math.ceil(Date.now() / H) * H + 5 * 24 * H);
    const made = await http().post('/api/bookings').set(adminAs('client')).send({ modelId: modelA, startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString(), paymentMethod: 'VIETQR', phone: '+84901234567', agreed: true, delivery: false, extras: [] });
    expect(made.status, JSON.stringify(made.body)).toBe(201);
    const booking = made.body as Booking;
    const pay = await http().post(`/api/bookings/${booking.id}/pay`).set(adminAs('client'));
    expect(pay.status, JSON.stringify(pay.body)).toBe(200);
    expect(payos.has('client-a')).toBe(true);
    expect(payos.has('client-b')).toBe(false);

    const { orderCode } = payos.get('client-a') as { orderCode: number };
    const data = { orderCode, amount: pay.body.amount as number, code: '00' };
    const status = async () => (await prisma.booking.findUniqueOrThrow({ where: { id: booking.id } })).status;

    // Владелец Б знает свой ключ и подставляет чужой номер заказа
    expect((await http().post(`/api/webhooks/payos/${locB}`).send(signed(data, KEYS.b.checksumKey))).status).toBe(200);
    expect(await status()).toBe('PENDING_PAYMENT');
    // Подпись чужим ключом на адрес этой точки
    expect((await http().post(`/api/webhooks/payos/${locA}`).send(signed(data, KEYS.b.checksumKey))).status).toBe(400);
    expect(await status()).toBe('PENDING_PAYMENT');
    // Настоящий webhook счёта точки
    expect((await http().post(`/api/webhooks/payos/${locA}`).send(signed(data, KEYS.a.checksumKey))).status).toBe(200);
    expect(await status()).toBe('CONFIRMED');
  });

  it('пробный webhook payOS с неизвестным заказом подтверждается без действий', async () => {
    expect((await http().post(`/api/webhooks/payos/${locA}`).send(signed({ orderCode: 123, amount: 1, code: '00' }, KEYS.a.checksumKey))).status).toBe(200);
  });

  it('точка без ключей не принимает webhook на свой адрес', async () => {
    const other = await prisma.location.create({ data: { name: { ru: 'x', en: 'x', vi: 'x' }, address: 'x', lat: 1, lng: 1 } });
    expect((await http().post(`/api/webhooks/payos/${other.id}`).send(signed({ orderCode: 1, amount: 1, code: '00' }, 'any'))).status).toBe(400);
    await prisma.location.delete({ where: { id: other.id } });
  });
});
