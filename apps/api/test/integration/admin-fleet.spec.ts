import { createHash, createHmac } from 'node:crypto';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminBike, AdminModel, AdminReconciliation, AdminSettingsResponse, AdminTextList, PaymentDto, PublicSettings, Quote } from '@rental/shared';
import { BookingsService } from '../../src/bookings/bookings.service';
import { LogNotifier, NOTIFIER } from '../../src/notifications';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN, TZ } from './support/catalog-fixture';

// Таск 11: парк, цены, точки, тексты, платежи, настройки, баннер, GET /settings/public.
// Ожидаемые суммы разобраны вручную (тарифы и коэффициенты заданы в тесте), не из кода под тестом.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
let notifier: LogNotifier;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const DAY = 24 * H;
const envBackup = { ...process.env };
const ADMIN_TG = 8101;
const MANAGER_TG = 8102;
const CLIENT_TG = 8103;
const MUT = { 'x-admin-request': '1' };
const storageDir = mkdtempSync(join(tmpdir(), 'rb-t11-'));

let locationId = '';
let otherLocationId = '';
let modelId = '';
let bikeId = '';
let otherModelId = '';
let adminCookie = '';
let managerCookie = '';
let clientId = '';

function widget(fields: Record<string, string | number>): Record<string, string | number> {
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHash('sha256').update(TEST_BOT_TOKEN).digest();
  return { ...fields, hash: createHmac('sha256', secret).update(dcs).digest('hex') };
}

async function login(tg: number): Promise<string> {
  const res = await http().post('/api/admin/auth/telegram').set(MUT).send(widget({ id: tg, first_name: 'Staff', auth_date: Math.floor(Date.now() / 1000) }));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const raw = (res.headers['set-cookie'] as unknown as string[]).find((s) => s.startsWith('admin_session='))!;
  return raw.split(';')[0]!;
}

const admin = {
  get: (p: string) => http().get(`/api/admin${p}`).set('Cookie', adminCookie),
  post: (p: string, b: object = {}) => http().post(`/api/admin${p}`).set(MUT).set('Cookie', adminCookie).send(b),
  patch: (p: string, b: object) => http().patch(`/api/admin${p}`).set(MUT).set('Cookie', adminCookie).send(b),
};

/** Полдень по tz точки через n суток (UTC+7 → 05:00Z). */
function localNoon(daysAhead: number): Date {
  const d = new Date(Date.now() + daysAhead * DAY);
  return new Date(`${d.toISOString().slice(0, 10)}T05:00:00Z`);
}
/** Окно сверки: все брони теста начинаются в ближайший год */
const WINDOW = `from=${new Date(Date.now() - DAY).toISOString()}&to=${new Date(Date.now() + 365 * DAY).toISOString()}`;
const ymdLocal = (d: Date) => new Date(d.getTime() + 7 * H).toISOString().slice(0, 10);

let seq = 0;
async function booking(p: { status: 'CONFIRMED' | 'ISSUED' | 'CANCELLED_BY_CLIENT'; total: number; deposit?: number; method?: 'VIETQR' | 'CASH'; startAt?: Date }) {
  seq += 1;
  const startAt = p.startAt ?? localNoon(40 + seq * 3);
  return prisma.booking.create({
    data: {
      code: `T11-${seq}-${Math.random().toString(36).slice(2, 6)}`,
      userId: clientId,
      modelId: otherModelId,
      locationId,
      bikeId: (await prisma.bike.findFirstOrThrow({ where: { modelId: otherModelId } })).id,
      startAt,
      endAt: new Date(startAt.getTime() + DAY),
      status: p.status,
      paymentMethod: p.method ?? 'VIETQR',
      lang: 'ru',
      rentAmount: p.total,
      totalAmount: p.total,
      depositAmount: p.deposit ?? 0,
      quote: {},
    },
  });
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ADMIN_TG);
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_DIR = storageDir;
  process.env.STORAGE_DRIVER = 'local';
  await resetDb(prisma);
  await createSettings(prisma, { holdMinutes: 15, cashPrepayPercent: 0, cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 } });
  locationId = (await createLocation(prisma)).id;
  otherLocationId = (await createLocation(prisma)).id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], rating: 4.5, popularity: 1 };
  const m = await createModel(prisma, locationId, { ...spec, key: 'fleet', name: 'Air Blade', prices: [150_000, 130_000, 110_000, 90_000], bikes: [{}, {}] });
  modelId = m.model.id;
  bikeId = m.bikes[0]!.id;
  await prisma.bikeModel.update({ where: { id: modelId }, data: { isDemo: true } });
  await prisma.tariff.updateMany({ where: { modelId }, data: { isDemo: true } });
  otherModelId = (await createModel(prisma, locationId, { ...spec, key: 'other', name: 'Vision', prices: [100_000, 100_000, 100_000, 100_000], bikes: [{}, {}] })).model.id;
  await createModel(prisma, otherLocationId, { ...spec, key: 'far', name: 'Far Away', prices: [1, 1, 1, 1], bikes: [{}] });
  clientId = (await prisma.user.create({ data: { telegramId: String(CLIENT_TG), firstName: 'Client', lang: 'ru', currency: 'VND', phone: '+84905550123' } })).id;
  await prisma.user.create({ data: { telegramId: String(MANAGER_TG), firstName: 'Manager', role: 'MANAGER', locationId } });
  app = await createApp();
  notifier = app.get(NOTIFIER) as LogNotifier;
  adminCookie = await login(ADMIN_TG);
  managerCookie = await login(MANAGER_TG);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  rmSync(storageDir, { recursive: true, force: true });
  process.env = envBackup;
});

describe('права: менеджер видит парк своей точки без цен', () => {
  it('GET /admin/models у менеджера — только своя точка, без тарифов и депозита; у админа — с ними', async () => {
    const res = await http().get('/api/admin/models').set('Cookie', managerCookie);
    expect(res.status).toBe(200);
    const items = res.body.items as AdminModel[];
    expect(items.map((m) => m.name).sort()).toEqual(['Air Blade', 'Vision']);
    for (const m of items) {
      expect(m).not.toHaveProperty('deposit');
      expect(m).not.toHaveProperty('tariffs');
    }
    const one = await http().get(`/api/admin/models/${modelId}`).set('Cookie', managerCookie);
    expect(one.body).not.toHaveProperty('tariffs');
    expect(JSON.stringify(one.body)).not.toContain('150000');
    const full = (await admin.get(`/models/${modelId}`)).body as AdminModel;
    expect(full.deposit).toBe(1_000_000);
    expect(full.tariffs?.[0]).toEqual({ minDays: 1, maxDays: 2, pricePerDay: 150_000 });
  });

  it('менеджер не меняет модели, тарифы, депозит, настройки, тексты, платежи → 403', async () => {
    const m = (p: string) => http().patch(p).set(MUT).set('Cookie', managerCookie);
    expect((await m(`/api/admin/models/${modelId}`).send({ deposit: 1 })).status).toBe(403);
    expect((await http().patch(`/api/admin/tariffs/${modelId}`).set(MUT).set('Cookie', managerCookie).send({ tariffs: [{ minDays: 1, maxDays: null, pricePerDay: 1 }] })).status).toBe(403);
    for (const p of ['tariffs', 'seasons', 'extras', 'settings', 'texts', 'payments', 'payments/reconciliation', 'locations', 'banner']) {
      expect((await http().get(`/api/admin/${p}`).set('Cookie', managerCookie)).status, p).toBe(403);
    }
    expect((await http().post('/api/admin/payments/x/refund').set(MUT).set('Cookie', managerCookie).send({ amount: 1 })).status).toBe(403);
    expect((await prisma.bikeModel.findUniqueOrThrow({ where: { id: modelId } })).deposit).toBe(1_000_000);
  });

  it('менеджер меняет статус и пробег байка своей точки, но не номер', async () => {
    const ok = await http().patch(`/api/admin/bikes/${bikeId}`).set(MUT).set('Cookie', managerCookie).send({ status: 'REPAIR', mileageKm: 12_345 });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect((ok.body as AdminBike).status).toBe('REPAIR');
    expect((await http().patch(`/api/admin/bikes/${bikeId}`).set(MUT).set('Cookie', managerCookie).send({ plate: 'X-1' })).status).toBe(403);
    await admin.patch(`/bikes/${bikeId}`, { status: 'ACTIVE' });
  });
});

describe('цены → POST /quotes', () => {
  const quote = async (id: string, startAt: Date, days: number) => {
    const res = await http().post('/api/quotes').send({ modelId: id, startAt: startAt.toISOString(), endAt: new Date(startAt.getTime() + days * DAY).toISOString() });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    return res.body as Quote;
  };

  it('изменённый тариф сразу меняет итог; «ДЕМО» с тарифов снимается', async () => {
    const start = localNoon(60);
    expect((await quote(modelId, start, 2)).total).toBe(2 * 150_000);
    const res = await admin.patch(`/tariffs/${modelId}`, { tariffs: [{ minDays: 1, maxDays: 2, pricePerDay: 200_000 }, { minDays: 3, maxDays: null, pricePerDay: 180_000 }] });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await quote(modelId, start, 2)).total).toBe(400_000);
    expect((await quote(modelId, start, 3)).total).toBe(540_000);
    expect(await prisma.tariff.count({ where: { modelId, isDemo: true } })).toBe(0);
  });

  it('сетка с пропуском дней → 400 TARIFFS_INVALID', async () => {
    const res = await admin.patch(`/tariffs/${modelId}`, { tariffs: [{ minDays: 1, maxDays: 2, pricePerDay: 1 }, { minDays: 5, maxDays: null, pricePerDay: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('TARIFFS_INVALID');
  });

  it('сезонный коэффициент применяется только к дням внутри диапазона', async () => {
    // 100 000 ₫/сутки; 4 суток с полудня D0: D0, D1, D2, D3. Сезон ×1.5 на D1–D2 → 100 + 150 + 150 + 100 = 500 000
    const start = localNoon(80);
    expect((await quote(otherModelId, start, 4)).total).toBe(400_000);
    const res = await admin.post('/seasons', { name: { en: 'Tet' }, from: ymdLocal(new Date(start.getTime() + DAY)), to: ymdLocal(new Date(start.getTime() + 2 * DAY)), coefficient: 1.5 });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const q = await quote(otherModelId, start, 4);
    expect(q.total).toBe(500_000);
    expect(q.lines.filter((l) => l.kind === 'RENT').map((l) => l.unitPrice)).toEqual(expect.arrayContaining([100_000, 150_000]));
    // Аренда целиком вне сезона — без коэффициента
    expect((await quote(otherModelId, localNoon(120), 2)).total).toBe(200_000);
    await admin.post('/seasons', {}).expect(400);
    await http().delete(`/api/admin/seasons/${res.body.id}`).set(MUT).set('Cookie', adminCookie).expect(204);
    expect((await quote(otherModelId, start, 4)).total).toBe(400_000);
  });

  it('опция: создаётся с ценой и попадает в расчёт', async () => {
    const ex = await admin.post('/extras', { code: 'helmet_2', name: { en: 'Second helmet', ru: 'Второй шлем' }, price: 20_000, per: 'DAY', maxQty: 1 });
    expect(ex.status, JSON.stringify(ex.body)).toBe(201);
    expect(ex.body.code).toBe('HELMET_2');
    const start = localNoon(90);
    const res = await http().post('/api/quotes').send({ modelId: otherModelId, startAt: start.toISOString(), endAt: new Date(start.getTime() + 2 * DAY).toISOString(), extras: [{ id: ex.body.id, qty: 1 }] });
    expect((res.body as Quote).total).toBe(2 * 100_000 + 2 * 20_000);
  });
});

describe('парк: правка владельцем, фото, документы байка', () => {
  it('правка модели владельцем снимает «ДЕМО»; тексты на 3 языках', async () => {
    const res = await admin.patch(`/models/${modelId}`, { description: { ru: 'Описание', en: 'Description', vi: 'Mô tả' }, deposit: 2_000_000 });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body.isDemo).toBe(false);
    expect(res.body.description).toEqual({ ru: 'Описание', en: 'Description', vi: 'Mô tả' });
    expect((await admin.patch(`/models/${modelId}`, { description: { ru: 'без en' } })).status).toBe(400);
  });

  it('фото конвертируется в WebP и AVIF 400/800/1200 и лежит в публичном хранилище', async () => {
    const png = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 200, g: 200, b: 210 } } }).png().toBuffer();
    const res = await http().post(`/api/admin/models/${modelId}/photos`).set(MUT).set('Cookie', adminCookie).set('Content-Type', 'image/png').send(png);
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const photo = (res.body as AdminModel).photos.at(-1)!;
    expect(Object.keys(photo.sizes).sort()).toEqual(['1200', '400', '800']);
    const stored = (await prisma.bikeModel.findUniqueOrThrow({ where: { id: modelId } })).photos as { key: string; sizes: Record<string, { webp: string; avif: string }> }[];
    const last = stored.at(-1)!;
    for (const w of ['400', '800', '1200']) {
      for (const f of [last.sizes[w]!.webp, last.sizes[w]!.avif]) expect(existsSync(join(storageDir, 'public', f)), f).toBe(true);
    }
    expect((await sharp(join(storageDir, 'public', last.sizes['800']!.webp)).metadata()).width).toBe(800);
    expect((await sharp(join(storageDir, 'public', last.sizes['400']!.avif)).metadata()).format).toBe('heif');
    const bad = await http().post(`/api/admin/models/${modelId}/photos`).set(MUT).set('Cookie', adminCookie).set('Content-Type', 'image/png').send(Buffer.from('not an image'));
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('IMAGE_INVALID');
  });

  it('регистрационный документ байка: загрузка по подписанной ссылке и просмотр по временной', async () => {
    const up = await admin.post(`/bikes/${bikeId}/documents/registration`, { contentType: 'application/pdf' });
    expect(up.status, JSON.stringify(up.body)).toBe(201);
    const u = new URL(up.body.uploadUrl, 'http://localhost');
    const body = Buffer.from('%PDF-1.4 test');
    await http().put(`${u.pathname}${u.search}`).set('Content-Type', 'application/pdf').send(body).expect((r) => expect(r.status).toBeLessThan(300));
    // До подтверждения загрузка не считается: сорвавшийся файл не заменит старый документ
    expect((await admin.get(`/bikes/${bikeId}/documents/registration/url`)).status).toBe(404);
    expect((await admin.post(`/bikes/${bikeId}/documents/registration/confirm`, { key: 'bikes/other/registration-x' })).status).toBe(400);
    expect((await admin.post(`/bikes/${bikeId}/documents/registration/confirm`, { key: up.body.key })).status).toBe(201);
    const link = await admin.get(`/bikes/${bikeId}/documents/registration/url`);
    expect(link.status).toBe(200);
    expect(new Date(link.body.expiresAt).getTime() - Date.now()).toBeLessThanOrEqual(600_000);
    const g = new URL(link.body.url, 'http://localhost');
    const file = await http().get(`${g.pathname}${g.search}`).buffer(true).parse((res, cb) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(Buffer.compare(file.body as Buffer, body)).toBe(0);
    expect((await admin.get(`/bikes/${bikeId}`)).body.hasRegistrationDoc).toBe(true);
  });

  it('новый байк: номер уникален', async () => {
    const res = await admin.post('/bikes', { modelId, plate: '77-a1 234.56', vin: null });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body.plate).toBe('77-A1 234.56');
    expect(res.body.locationId).toBe(locationId);
    const dup = await admin.post('/bikes', { modelId, plate: '77-A1 234.56' });
    expect(dup.status).toBe(409);
    expect(dup.body.code).toBe('PLATE_TAKEN');
  });
});

describe('тексты интерфейса', () => {
  it('переопределённая строка приходит в GET /i18n/{lang}; пустое значение возвращает текст из JSON', async () => {
    const before = (await http().get('/api/i18n/ru')).body.admin.common.retry as string;
    const list = (await admin.get('/texts')).body as AdminTextList;
    expect(list.items.find((r) => r.key === 'admin.common.retry')?.base.ru).toBe(before);
    const res = await admin.patch('/texts', { lang: 'ru', key: 'admin.common.retry', value: 'Ещё раз' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await http().get('/api/i18n/ru')).body.admin.common.retry).toBe('Ещё раз');
    expect((await http().get('/api/i18n/en')).body.admin.common.retry).not.toBe('Ещё раз');
    await admin.patch('/texts', { lang: 'ru', key: 'admin.common.retry', value: '' }).expect(200);
    expect((await http().get('/api/i18n/ru')).body.admin.common.retry).toBe(before);
  });

  it('неизвестный ключ → 400 UNKNOWN_KEY; потерянный плейсхолдер → 400', async () => {
    const res = await admin.patch('/texts', { lang: 'ru', key: 'nope.key', value: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('UNKNOWN_KEY');
    expect((await admin.patch('/texts', { lang: 'en', key: 'admin.common.page', value: 'Page' })).status).toBe(400);
  });
});

describe('платежи: возвраты и сверка', () => {
  it('возврат создаёт Payment REFUND и уведомляет клиента; повтор той же суммы отклоняется; сверх полученного — 400', async () => {
    const b = await booking({ status: 'CONFIRMED', total: 300_000 });
    const pay = await prisma.payment.create({ data: { bookingId: b.id, kind: 'RENT', method: 'VIETQR', amount: 300_000, receivedAmount: 300_000, status: 'PAID', paidAt: new Date() } });
    notifier.sent.length = 0;
    const res = await admin.post(`/payments/${pay.id}/refund`, { amount: 100_000, comment: 'goodwill' });
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    expect(res.body as PaymentDto).toMatchObject({ kind: 'REFUND', amount: 100_000, status: 'PAID', bookingId: b.id });
    await expect.poll(() => notifier.sent.filter((m) => m.key === 'bot.client.refunded' && m.telegramId === String(CLIENT_TG)).length).toBe(1);
    const again = await admin.post(`/payments/${pay.id}/refund`, { amount: 100_000 });
    expect(again.status, JSON.stringify(again.body)).toBe(409);
    expect(again.body.code).toBe('REFUND_DUPLICATE');
    const tooMuch = await admin.post(`/payments/${pay.id}/refund`, { amount: 250_000 });
    expect(tooMuch.status).toBe(400);
    expect(tooMuch.body.code).toBe('REFUND_EXCEEDS_PAID');
    expect(await prisma.payment.count({ where: { bookingId: b.id, kind: 'REFUND' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'payment.refund', entity: 'Payment', entityId: res.body.id } })).toBe(1);
  });

  it('ожидающий возврат после отмены закрывается один раз', async () => {
    const b = await booking({ status: 'CANCELLED_BY_CLIENT', total: 200_000 });
    await prisma.payment.create({ data: { bookingId: b.id, kind: 'RENT', method: 'VIETQR', amount: 200_000, receivedAmount: 200_000, status: 'PAID', paidAt: new Date() } });
    const pending = await prisma.payment.create({ data: { bookingId: b.id, kind: 'REFUND', method: 'VIETQR', amount: 200_000, status: 'PENDING' } });
    const rec = (await admin.get(`/payments/reconciliation?${WINDOW}`)).body as AdminReconciliation;
    expect(rec.items.find((r) => r.bookingId === b.id)).toMatchObject({ state: 'REFUND_DUE', pendingRefundId: pending.id });
    const done = await admin.post(`/payments/${pending.id}/refund`, {});
    expect(done.status, JSON.stringify(done.body)).toBe(201);
    expect(done.body.status).toBe('PAID');
    expect((await admin.post(`/payments/${pending.id}/refund`, {})).status).toBe(409);
  });

  it('сверка подсвечивает бронь с недоплатой', async () => {
    const under = await booking({ status: 'ISSUED', total: 500_000 });
    await prisma.payment.create({ data: { bookingId: under.id, kind: 'RENT', method: 'VIETQR', amount: 500_000, receivedAmount: 300_000, status: 'PAID', paidAt: new Date() } });
    const full = await booking({ status: 'ISSUED', total: 400_000, deposit: 1_000_000 });
    await prisma.payment.create({ data: { bookingId: full.id, kind: 'RENT', method: 'VIETQR', amount: 1_400_000, receivedAmount: 1_400_000, status: 'PAID', paidAt: new Date() } });
    const res = await admin.get(`/payments/reconciliation?${WINDOW}`);
    expect(res.status).toBe(200);
    const rec = res.body as AdminReconciliation;
    expect(rec.items.find((r) => r.bookingId === under.id)).toMatchObject({ expected: 500_000, received: 300_000, difference: -200_000, state: 'UNDERPAID' });
    expect(rec.items.find((r) => r.bookingId === full.id)).toMatchObject({ expected: 1_400_000, received: 1_400_000, state: 'OK' });
    const only = (await admin.get(`/payments/reconciliation?${WINDOW}&onlyMismatches=1`)).body as AdminReconciliation;
    expect(only.items.map((r) => r.bookingId)).toContain(under.id);
    expect(only.items.map((r) => r.bookingId)).not.toContain(full.id);
    const list = await admin.get('/payments?kind=REFUND');
    expect(list.body.items.every((p: PaymentDto) => p.kind === 'REFUND')).toBe(true);
  });
});

describe('настройки', () => {
  it('GET /settings/public без авторизации отдаёт тексты, контакт, доставку, предоплату, валюты и курсы', async () => {
    const save = await admin.patch('/settings', {
      faq: { ru: 'Вопрос — ответ', en: 'Q — A' },
      rulesText: { en: 'Rules' },
      privacyText: { en: 'Privacy' },
      managerContact: '@owner_bikes',
      deliveryFee: 120_000,
      cashPrepayPercent: 20,
    });
    expect(save.status, JSON.stringify(save.body)).toBe(200);
    const res = await http().get('/api/settings/public');
    expect(res.status).toBe(200);
    const rates = (await http().get('/api/rates')).body;
    expect(res.body as PublicSettings).toEqual({
      faq: { ru: 'Вопрос — ответ', en: 'Q — A' },
      rulesText: { en: 'Rules' },
      privacyText: { en: 'Privacy' },
      managerContact: '@owner_bikes',
      deliveryFee: 120_000,
      cashPrepayPercent: 20,
      defaultCurrencyByLang: { ru: 'RUB', en: 'USD', vi: 'VND' },
      rates,
      rubTransfer: null,
    });
    await admin.patch('/settings', { cashPrepayPercent: 0 }).expect(200);
  });

  it('сохранённые буфер, удержание и правила отмены читаются без перезапуска', async () => {
    await prisma.setting.update({ where: { key: 'bufferMinutes' }, data: { isDemo: true } });
    const res = await admin.patch('/settings', { bufferMinutes: 180, holdMinutes: 30, cancel: { fullHours: 48, halfHours: 2, halfPercent: 30 } });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const s = res.body as AdminSettingsResponse;
    expect(s.values.bufferMinutes).toBe(180);
    expect(s.demo).not.toContain('bufferMinutes');

    const start = localNoon(150);
    const created = await app.get(BookingsService).create(clientId, 'ru', { modelId: otherModelId, startAt: start, endAt: new Date(start.getTime() + DAY), extras: [], paymentMethod: 'VIETQR', phone: '+84905550009', agreed: true, delivery: false, deliveryAddress: null, source: null });
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: created.id } });
    expect(row.blockedUntil!.getTime()).toBe(start.getTime() + DAY + 180 * 60_000);
    expect(row.holdExpiresAt!.getTime() - row.createdAt.getTime()).toBeGreaterThan(29 * 60_000);
    expect(row.holdExpiresAt!.getTime() - row.createdAt.getTime()).toBeLessThanOrEqual(30 * 60_000 + 5_000);

    // Отмена за 30 ч: по умолчанию (24 ч) было бы 100 %, по новым правилам (48 ч / 30 %) — 30 %
    const soon = await booking({ status: 'CONFIRMED', total: 100_000, startAt: new Date(Date.now() + 30 * H) });
    const r = await app.get(BookingsService).cancel(soon.id, { id: null, role: 'SYSTEM' }, 'CLIENT');
    expect(r.refundPercent).toBe(30);
    await admin.patch('/settings', { bufferMinutes: 60, holdMinutes: 15, cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 } }).expect(200);
  });

  it('неизвестный ключ и неверное значение → 400', async () => {
    expect((await admin.patch('/settings', { foo: 1 })).status).toBe(400);
    expect((await admin.patch('/settings', { cashPrepayPercent: 150 })).status).toBe(400);
    expect((await admin.patch('/settings', { depositMode: 'GOLD' })).status).toBe(400);
  });
});

describe('ручная бронь сотрудника «прямо сейчас»', () => {
  it('админка: начало сейчас → 201; клиент из Mini App с тем же началом → 400 LEAD_TIME', async () => {
    const now = new Date(Date.now() + 60_000);
    const end = new Date(now.getTime() + DAY).toISOString();
    const staff = await admin.post('/bookings', { modelId, startAt: now.toISOString(), endAt: end, paymentMethod: 'CASH', phone: '+84905550777' });
    expect(staff.status, JSON.stringify(staff.body)).toBe(201);
    const auth = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: CLIENT_TG, first_name: 'Client', language_code: 'ru' }) });
    expect(auth.status).toBe(200);
    const client = await http().post('/api/bookings').set('Authorization', `Bearer ${auth.body.token}`).send({ modelId, startAt: now.toISOString(), endAt: end, paymentMethod: 'CASH', phone: '+84905550123', agreed: true });
    expect(client.status).toBe(400);
    expect(client.body.code).toBe('LEAD_TIME');
  });
});

describe('точки и баннер', () => {
  it('точка: часы и менеджер по Telegram ID; «ДЕМО» снимается', async () => {
    await prisma.location.update({ where: { id: locationId }, data: { isDemo: true } });
    const res = await admin.patch(`/locations/${locationId}`, { openTime: '07:30', closeTime: '21:00', address: '1 Xuân Diệu' });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect(res.body).toMatchObject({ openTime: '07:30', closeTime: '21:00', isDemo: false, timezone: TZ });
    expect((await admin.patch(`/locations/${locationId}`, { openTime: '22:00' })).status).toBe(400);
    const add = await admin.post(`/locations/${locationId}/managers`, { telegramId: '8199' });
    expect(add.status, JSON.stringify(add.body)).toBe(201);
    expect(add.body.managers.map((m: { telegramId: string }) => m.telegramId)).toContain('8199');
  });

  it('баннер на 3 языках виден на главной Mini App', async () => {
    const res = await admin.patch('/banner', { title: { ru: 'Скидка', en: 'Discount', vi: 'Giảm giá' }, text: null, link: null, isActive: true });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const home = await http().get('/api/home');
    expect(home.body.banner.title).toEqual({ ru: 'Скидка', en: 'Discount', vi: 'Giảm giá' });
  });
});
