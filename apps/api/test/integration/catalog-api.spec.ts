import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthResponse, ModelCard, ModelDetail, ModelListResponse, Quote } from '@rental/shared';
import { createApp, createBooking, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Таск 04: вход, каталог с доступностью, карточка, календарь занятости, расчёт цены, главная, избранное, события, тексты.
// Ожидаемые суммы посчитаны вручную по тарифам фикстуры (не кодом под тестом).

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());

// Период каталога: 3 суток с 10.03.2027 10:00 по Вьетнаму (03:00 UTC)
const FROM = '2027-03-10T03:00:00.000Z';
const TO = '2027-03-13T03:00:00.000Z';
const period = `from=${FROM}&to=${TO}`;

const ids = {} as Record<'a' | 'b' | 'c' | 'd' | 'e' | 'f', string>;
const extraIds = {} as Record<'helmet' | 'raincoat', string>;
let locationId = '';

const envBackup = { ...process.env };

async function login(telegramId: number, extra: Record<string, unknown> = {}): Promise<AuthResponse> {
  const res = await http()
    .post('/api/auth/telegram')
    .send({ initData: signInitData({ id: telegramId, first_name: 'T', language_code: 'ru', ...extra }) });
  expect(res.status).toBe(200);
  return res.body as AuthResponse;
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error('PostgreSQL недоступен по DATABASE_URL — запустите `pnpm test:integration`.');
  }
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = '';
  await resetDb(prisma);
  await createSettings(prisma);
  const loc = await createLocation(prisma);
  locationId = loc.id;
  const owner = await prisma.user.create({ data: { telegramId: '1' } });

  const a = await createModel(prisma, loc.id, {
    key: 'air', brand: 'Honda', name: 'Air Blade 125', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125,
    features: ['TRUNK', 'USB', 'SMART_KEY'], prices: [180_000, 160_000, 140_000, 120_000], rating: 4.8, popularity: 100,
    bikes: [{}, {}],
  }, 0);
  const b = await createModel(prisma, loc.id, {
    key: 'vario', brand: 'Honda', name: 'Vario 160', category: 'MAXI_SCOOTER', transmission: 'AUTOMATIC', engineCc: 160,
    features: ['TRUNK', 'USB', 'ABS', 'SMART_KEY'], prices: [250_000, 220_000, 200_000, 170_000], rating: 4.5, popularity: 70,
    licenseRequired: 'A', bikes: [{ status: 'REPAIR' }, { status: 'RETIRED' }],
  });
  const c = await createModel(prisma, loc.id, {
    key: 'nvx', brand: 'Yamaha', name: 'NVX 155', category: 'MAXI_SCOOTER', transmission: 'AUTOMATIC', engineCc: 155,
    features: ['TRUNK', 'USB', 'ABS', 'SMART_KEY'], prices: [250_000, 220_000, 200_000, 170_000], rating: 4.9, popularity: 75,
    licenseRequired: 'A', bikes: [{}],
  }, 1);
  const d = await createModel(prisma, loc.id, {
    key: 'vision', brand: 'Honda', name: 'Vision 110', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 110,
    features: ['USB', 'SMART_KEY'], prices: [150_000, 130_000, 110_000, 90_000], rating: 4.7, popularity: 90, bikes: [{}],
  });
  const e = await createModel(prisma, loc.id, {
    key: 'evo', brand: 'VinFast', name: 'Evo200', category: 'ELECTRIC', transmission: 'ELECTRIC', engineCc: null,
    features: ['USB'], prices: [200_000, 180_000, 160_000, 140_000], rating: 4.6, popularity: 40,
    // Ремонт до 05.03.2027 12:00 по Вьетнаму
    bikes: [{ status: 'REPAIR', readyAt: new Date('2027-03-05T05:00:00Z') }],
  }, 2);
  const f = await createModel(prisma, loc.id, {
    key: 'off', brand: 'Suzuki', name: 'Hidden', category: 'MOTORCYCLE', transmission: 'MANUAL', engineCc: 300,
    features: [], prices: [1, 1, 1, 1], rating: 5, popularity: 999, isActive: false, bikes: [{}],
  }, 3);
  Object.assign(ids, { a: a.model.id, b: b.model.id, c: c.model.id, d: d.model.id, e: e.model.id, f: f.model.id });

  const bk = { userId: owner.id, locationId: loc.id };
  // A: оба байка заняты на период; первый освобождается (с буфером 1 ч) 12.03 21:00, второй — 12.03 18:00 по Вьетнаму
  await createBooking(prisma, { ...bk, modelId: a.model.id, bikeId: a.bikes[0]!.id, startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-12T13:00:00Z') });
  await createBooking(prisma, { ...bk, modelId: a.model.id, bikeId: a.bikes[1]!.id, startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-12T10:00:00Z'), status: 'PENDING_PAYMENT' });
  // C: бронь кончается за 30 мин до начала периода — буфер 1 ч ещё держит байк
  await createBooking(prisma, { ...bk, modelId: c.model.id, bikeId: c.bikes[0]!.id, startAt: new Date('2027-03-08T01:00:00Z'), endAt: new Date('2027-03-10T02:30:00Z') });
  // D: отменённая бронь на период байк не держит
  await createBooking(prisma, { ...bk, modelId: d.model.id, bikeId: d.bikes[0]!.id, startAt: new Date('2027-03-10T01:00:00Z'), endAt: new Date('2027-03-14T01:00:00Z'), status: 'CANCELLED_BY_CLIENT' });

  // Сезон: 12.03.2027 ×1.5 — третьи сутки периода
  await prisma.seasonRule.create({ data: { locationId: loc.id, name: { en: 'High' }, from: new Date('2027-03-12'), to: new Date('2027-03-12'), coefficient: 1.5 } });
  const helmet = await prisma.extra.create({ data: { code: 'HELMET_2', name: { en: 'Helmet' }, price: 20_000, per: 'DAY', maxQty: 1 } });
  const raincoat = await prisma.extra.create({ data: { code: 'RAINCOAT', name: { en: 'Raincoat' }, price: 30_000, per: 'ONCE', maxQty: 2 } });
  Object.assign(extraIds, { helmet: helmet.id, raincoat: raincoat.id });
  await prisma.banner.create({ data: { title: { en: 'Old' }, isActive: false } });
  await prisma.banner.create({ data: { title: { en: 'Promo', ru: 'Акция' }, link: '/catalog' } });

  app = await createApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

const names = (items: ModelCard[]) => items.map((m) => m.name);
const byId = (items: ModelCard[], id: string) => items.find((m) => m.id === id)!;

describe('POST /auth/telegram и /me', () => {
  it('валидный initData → JWT, пользователь и роль CLIENT; язык из language_code', async () => {
    const r = await login(700001, { language_code: 'uk', username: 'u1' });
    expect(r.token).toEqual(expect.any(String));
    expect(r.role).toBe('CLIENT');
    expect(r.user).toMatchObject({ telegramId: '700001', lang: 'ru', currency: 'RUB', onboarded: false });
    const me = await http().get('/api/me').set('Authorization', `Bearer ${r.token}`);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ telegramId: '700001', username: 'u1' });
  });

  it('поддельный или просроченный initData → 401', async () => {
    const forged = signInitData({ id: 700002 }).replace('700002', '700003');
    const old = signInitData({ id: 700002 }, Math.floor(Date.now() / 1000) - 25 * 3600);
    for (const initData of [forged, old, 'garbage']) {
      const res = await http().post('/api/auth/telegram').send({ initData });
      expect(res.status).toBe(401);
      expect(res.body.code).toBe('UNAUTHORIZED');
    }
    expect(await prisma.user.count({ where: { telegramId: { in: ['700002', '700003'] } } })).toBe(0);
  });

  it('роль по Telegram ID: ADMIN_TELEGRAM_IDS → ADMIN, роль из БД → MANAGER', async () => {
    process.env.ADMIN_TELEGRAM_IDS = '111, 700010';
    expect((await login(700010)).role).toBe('ADMIN');
    await prisma.user.create({ data: { telegramId: '700011', role: 'MANAGER' } });
    expect((await login(700011)).role).toBe('MANAGER');
    process.env.ADMIN_TELEGRAM_IDS = '';
  });

  it('без токена или с чужой подписью токена → 401', async () => {
    expect((await http().get('/api/me')).status).toBe(401);
    const bad = await http().get('/api/me').set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ4In0.bad');
    expect(bad.status).toBe(401);
  });

  it('PATCH /me сохраняет язык, валюту, телефон, категорию прав и онбординг; неверный телефон → 400', async () => {
    const { token } = await login(700020);
    const auth = { Authorization: `Bearer ${token}` };
    const ok = await http().patch('/api/me').set(auth).send({ lang: 'vi', currency: 'VND', phone: '+84901234567', licenseCategory: 'A1', onboarded: true });
    expect(ok.status).toBe(200);
    expect(ok.body).toMatchObject({ lang: 'vi', currency: 'VND', phone: '+84901234567', licenseCategory: 'A1', onboarded: true });
    expect((await http().patch('/api/me').set(auth).send({ phone: '12-34' })).status).toBe(400);
    expect((await http().patch('/api/me').set(auth).send({ lang: 'de' })).status).toBe(400);
  });

  it('DEV_AUTH=1 — тестовые пользователи по роли; без DEV_AUTH — 401', async () => {
    process.env.DEV_AUTH = '1';
    const res = await http().post('/api/auth/telegram').send({ devUser: 'manager' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('MANAGER');
    process.env.DEV_AUTH = '';
    expect((await http().post('/api/auth/telegram').send({ devUser: 'admin' })).status).toBe(401);
    process.env.DEV_AUTH = envBackup.DEV_AUTH;
  });
});

describe('GET /models — доступность на даты', () => {
  it('модели без свободного байка не свободны и несут busyUntil; неактивные не видны', async () => {
    const res = await http().get(`/api/models?${period}`);
    expect(res.status).toBe(200);
    const body = res.body as ModelListResponse;
    expect(body.count).toBe(5);
    expect(body.items.find((m) => m.id === ids.f)).toBeUndefined();
    expect(byId(body.items, ids.a)).toMatchObject({ available: false, busyUntil: '2027-03-12T11:00:00.000Z' });
    expect(byId(body.items, ids.b)).toMatchObject({ available: false, busyUntil: null });
    expect(byId(body.items, ids.c)).toMatchObject({ available: false, busyUntil: '2027-03-10T03:30:00.000Z' });
    expect(byId(body.items, ids.d)).toMatchObject({ available: true, busyUntil: null });
    expect(byId(body.items, ids.e)).toMatchObject({ available: true, busyUntil: null });
  });

  it('цена в день по тарифу срока и итог с сезоном; совпадает с POST /quotes', async () => {
    const { items } = (await http().get(`/api/models?${period}`)).body as ModelListResponse;
    // Vision: 3 суток по 130 000, третьи сутки ×1.5 → 130 000 + 130 000 + 195 000
    expect(byId(items, ids.d)).toMatchObject({ pricePerDay: 130_000, days: 3, total: 455_000 });
    for (const m of items) {
      const q = await http().post('/api/quotes').send({ modelId: m.id, startAt: FROM, endAt: TO });
      expect(q.status).toBe(200);
      expect((q.body as Quote).total).toBe(m.total);
    }
  });

  it('карточка содержит поля истории 64', async () => {
    const { items } = (await http().get(`/api/models?${period}`)).body as ModelListResponse;
    const d = byId(items, ids.d);
    expect(d).toMatchObject({ name: 'Vision 110', year: 2024, engineCc: 110, rating: 4.7, brand: { name: 'Honda' }, isFavorite: false });
    expect(d.photo?.url).toMatch(/models\/vision\/1-800\.webp$/);
  });

  it('без дат — итог не считается', async () => {
    const { items } = (await http().get('/api/models')).body as ModelListResponse;
    expect(byId(items, ids.d)).toMatchObject({ days: null, total: null, pricePerDay: 150_000 });
  });

  it('неверные даты → 400', async () => {
    expect((await http().get(`/api/models?from=${TO}&to=${FROM}`)).status).toBe(400);
    expect((await http().get('/api/models?from=nope&to=nope')).status).toBe(400);
  });
});

describe('GET /models — фильтры и сортировки (история 65)', () => {
  const cases: [string, string[]][] = [
    ['category=SCOOTER', ['Vision 110', 'Air Blade 125']],
    ['type=ELECTRIC', ['Evo200']],
    ['cc=150-160', ['NVX 155', 'Vario 160']],
    ['cc=110-125,150-160', ['Vision 110', 'Air Blade 125', 'NVX 155', 'Vario 160']],
    ['brand=Yamaha', ['NVX 155']],
    ['brand=Honda,VinFast', ['Vision 110', 'Evo200', 'Air Blade 125', 'Vario 160']],
    ['options=ABS,TRUNK', ['NVX 155', 'Vario 160']],
    ['priceMin=150000&priceMax=200000', ['Evo200', 'Air Blade 125']],
    ['q=vis', ['Vision 110']],
    ['q=yamaha', ['NVX 155']],
  ];
  it.each(cases)('%s', async (filter, expected) => {
    const res = await http().get(`/api/models?${period}&${filter}`);
    expect(res.status).toBe(200);
    const body = res.body as ModelListResponse;
    expect(names(body.items)).toEqual(expected);
    expect(body.count).toBe(body.items.length);
    const count = await http().get(`/api/models/count?${period}&${filter}`);
    expect(count.body).toEqual({ count: expected.length });
  });

  // Свободные (Vision 130k, Evo 180k) всегда раньше занятых (Air 160k, NVX 220k, Vario 220k)
  const sorts: [string, string[]][] = [
    ['popularity', ['Vision 110', 'Evo200', 'Air Blade 125', 'NVX 155', 'Vario 160']],
    ['price_asc', ['Vision 110', 'Evo200', 'Air Blade 125', 'NVX 155', 'Vario 160']],
    ['price_desc', ['Evo200', 'Vision 110', 'NVX 155', 'Vario 160', 'Air Blade 125']],
    ['rating', ['Vision 110', 'Evo200', 'NVX 155', 'Air Blade 125', 'Vario 160']],
  ];
  it.each(sorts)('sort=%s', async (sort, expected) => {
    const res = await http().get(`/api/models?${period}&sort=${sort}`);
    expect(names((res.body as ModelListResponse).items)).toEqual(expected);
  });

  it('неизвестные значения фильтров → 400', async () => {
    expect((await http().get('/api/models?sort=cheap')).status).toBe(400);
    expect((await http().get('/api/models?cc=999')).status).toBe(400);
    expect((await http().get('/api/models?type=JET')).status).toBe(400);
  });
});

describe('GET /models/{id} и календарь занятости', () => {
  it('карточка модели: галерея, характеристики, тарифная сетка, что входит, условия, опции', async () => {
    const res = await http().get(`/api/models/${ids.d}?${period}`);
    expect(res.status).toBe(200);
    const m = res.body as ModelDetail;
    expect(m.photos).toHaveLength(1);
    expect(m.specs).toEqual({ engineCc: 110, transmission: 'AUTOMATIC', fuelConsumption: 2, tankLiters: 5, maxSpeedKmh: 100, seats: 2 });
    expect(m.tariffs.map((t) => t.pricePerDay)).toEqual([150_000, 130_000, 110_000, 90_000]);
    expect(m.included).toEqual([{ en: '2 helmets' }]);
    expect(m.conditions).toEqual({ en: 'Passport or deposit' });
    expect(m.extras.map((x) => x.code)).toEqual(['HELMET_2', 'RAINCOAT']);
    expect(m).toMatchObject({ total: 455_000, available: true, deliveryFee: 100_000, depositMode: 'MONEY', deposit: 1_000_000 });
    expect(m.location.timezone).toBe('Asia/Ho_Chi_Minh');
  });

  it('неизвестная или скрытая модель → 404', async () => {
    expect((await http().get('/api/models/nope')).status).toBe(404);
    const hidden = await http().get(`/api/models/${ids.f}`);
    expect(hidden.status).toBe(404);
    expect(hidden.body.code).toBe('NOT_FOUND');
  });

  it('availability?month — даты, когда нет ни одного свободного байка в часы точки', async () => {
    const get = async (id: string) => (await http().get(`/api/models/${id}/availability?month=2027-03`)).body.busy as string[];
    // A: оба байка заняты 10–11.03 целиком; 12.03 второй свободен с 18:00
    expect(await get(ids.a)).toEqual(['2027-03-10', '2027-03-11']);
    // C: занят с 08.03 08:00 до 10.03 10:30 (с буфером)
    expect(await get(ids.c)).toEqual(['2027-03-08', '2027-03-09']);
    // E: в ремонте до 05.03 12:00
    expect(await get(ids.e)).toEqual(['2027-03-01', '2027-03-02', '2027-03-03', '2027-03-04']);
    // B: единственный исправный байк в ремонте без даты — занят весь месяц
    expect(await get(ids.b)).toHaveLength(31);
    expect(await get(ids.d)).toEqual([]);
    expect((await http().get(`/api/models/${ids.d}/availability?month=2027-3`)).status).toBe(400);
  });
});

describe('POST /quotes', () => {
  it('аренда + опции + доставка; депозит отдельно', async () => {
    const res = await http()
      .post('/api/quotes')
      .send({ modelId: ids.d, startAt: FROM, endAt: TO, extras: [{ id: extraIds.helmet, qty: 1 }, { id: extraIds.raincoat, qty: 2 }], delivery: true });
    expect(res.status).toBe(200);
    // 455 000 аренда + 20 000 × 3 суток + 30 000 × 2 + доставка 100 000; депозит 1 000 000
    expect(res.body).toMatchObject({ days: 3, rent: 455_000, extras: 120_000, delivery: 100_000, total: 675_000, deposit: 1_000_000, payable: 1_675_000 });
  });

  it('ошибки ввода → 400, неизвестная модель → 404', async () => {
    const base = { modelId: ids.d, startAt: FROM, endAt: TO };
    expect((await http().post('/api/quotes').send({ ...base, extras: [{ id: extraIds.raincoat, qty: 3 }] })).status).toBe(400);
    expect((await http().post('/api/quotes').send({ ...base, extras: [{ id: 'nope', qty: 1 }] })).status).toBe(400);
    expect((await http().post('/api/quotes').send({ ...base, startAt: TO, endAt: FROM })).status).toBe(400);
    expect((await http().post('/api/quotes').send({ ...base, modelId: 'nope' })).status).toBe(404);
  });

  it('доставка без цены в настройках → 400', async () => {
    await prisma.$executeRaw`UPDATE settings SET value = 'null'::jsonb WHERE key = 'deliveryFee'`;
    const res = await http().post('/api/quotes').send({ modelId: ids.d, startAt: FROM, endAt: TO, delivery: true });
    expect(res.status).toBe(400);
    await prisma.setting.update({ where: { key: 'deliveryFee' }, data: { value: 100_000 } });
  });
});

describe('GET /home и GET /now', () => {
  it('точка, активный баннер, счётчики категорий, бренды, популярные', async () => {
    const res = await http().get('/api/home');
    expect(res.status).toBe(200);
    expect(res.body.location).toMatchObject({ id: locationId, openTime: '08:00', closeTime: '20:00' });
    expect(res.body.banner).toMatchObject({ title: { en: 'Promo', ru: 'Акция' }, link: '/catalog' });
    expect(res.body.categories).toEqual([
      { category: 'SCOOTER', count: 2 },
      { category: 'MAXI_SCOOTER', count: 2 },
      { category: 'SEMI_AUTO', count: 0 },
      { category: 'MOTORCYCLE', count: 0 },
      { category: 'ELECTRIC', count: 1 },
    ]);
    expect(res.body.brands.map((b: { name: string }) => b.name)).toEqual(['Honda', 'Yamaha', 'VinFast']);
    expect(names(res.body.popular)).toEqual(['Air Blade 125', 'Vision 110', 'NVX 155', 'Vario 160', 'Evo200']);
  });

  it('без активного баннера — banner: null', async () => {
    await prisma.banner.updateMany({ data: { isActive: false } });
    expect((await http().get('/api/home')).body.banner).toBeNull();
    await prisma.banner.updateMany({ where: { link: '/catalog' }, data: { isActive: true } });
  });

  it('/now — только свободные модели с ближайшего слота не раньше чем через час', async () => {
    const before = Date.now();
    const res = await http().get('/api/now');
    expect(res.status).toBe(200);
    const from = new Date(res.body.from).getTime();
    expect(from).toBeGreaterThanOrEqual(before + 60 * 60_000 - 1000);
    expect(new Date(res.body.from).getUTCMinutes() % 30).toBe(0);
    expect(new Date(res.body.to).getTime() - from).toBe(24 * 3600_000);
    // Брони фикстуры — в 2027 году; B в ремонте без даты, E — в ремонте до марта 2027
    expect(names(res.body.items).sort()).toEqual(['Air Blade 125', 'NVX 155', 'Vision 110']);
    expect((res.body.items as ModelCard[]).every((m) => m.available)).toBe(true);
  });
});

describe('избранное', () => {
  it('доступно только своему пользователю', async () => {
    const alice = await login(700100);
    const bob = await login(700101);
    const asA = { Authorization: `Bearer ${alice.token}` };
    const asB = { Authorization: `Bearer ${bob.token}` };

    expect((await http().post(`/api/favorites/${ids.d}`).set(asA)).status).toBe(201);
    expect((await http().post(`/api/favorites/${ids.d}`).set(asA)).status).toBe(201); // повтор — без ошибки
    expect(names((await http().get(`/api/favorites?${period}`).set(asA)).body.items)).toEqual(['Vision 110']);
    expect((await http().get(`/api/favorites/${ids.d}`).set(asA)).body).toEqual({ modelId: ids.d, favorite: true });
    expect(byId((await http().get(`/api/models?${period}`).set(asA)).body.items, ids.d).isFavorite).toBe(true);

    expect((await http().get('/api/favorites').set(asB)).body.items).toEqual([]);
    expect((await http().get(`/api/favorites/${ids.d}`).set(asB)).body.favorite).toBe(false);
    expect(byId((await http().get(`/api/models?${period}`).set(asB)).body.items, ids.d).isFavorite).toBe(false);
    // Удаление чужим пользователем не трогает избранное владельца
    expect((await http().delete(`/api/favorites/${ids.d}`).set(asB)).status).toBe(204);
    expect((await http().get('/api/favorites').set(asA)).body.items).toHaveLength(1);

    expect((await http().get('/api/favorites')).status).toBe(401);
    expect((await http().post('/api/favorites/nope').set(asA)).status).toBe(404);
    expect((await http().delete(`/api/favorites/${ids.d}`).set(asA)).status).toBe(204);
    expect((await http().get('/api/favorites').set(asA)).body.items).toEqual([]);
  });
});

describe('POST /events и GET /i18n/{lang}', () => {
  it('событие воронки пишется с пользователем и источником', async () => {
    const { token, user } = await login(700200);
    const res = await http().post('/api/events').set('Authorization', `Bearer ${token}`).send({ name: 'model_viewed', props: { modelId: ids.d }, source: 'ad_fb' });
    expect(res.status).toBe(204);
    const row = await prisma.analyticsEvent.findFirst({ where: { userId: user.id } });
    expect(row).toMatchObject({ name: 'model_viewed', source: 'ad_fb', props: { modelId: ids.d } });
    expect((await http().post('/api/events').send({ name: 'hack' })).status).toBe(400);
  });

  it('словарь языка с переопределениями из админки', async () => {
    await prisma.i18nOverride.create({ data: { lang: 'ru', key: 'errors.NOT_FOUND', value: 'Нету' } });
    const ru = await http().get('/api/i18n/ru');
    expect(ru.status).toBe(200);
    expect(ru.body.errors.NOT_FOUND).toBe('Нету');
    expect(ru.body.errors.BIKE_TAKEN).toEqual(expect.any(String));
    expect((await http().get('/api/i18n/en')).body.errors.NOT_FOUND).toBe('Not found');
    expect((await http().get('/api/i18n/de')).status).toBe(400);
  });
});
