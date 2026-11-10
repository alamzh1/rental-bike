import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, createBooking, createLocation, createModel, createSettings, resetDb } from './support/catalog-fixture';

// История 88: каталог и расчёт цены p95 ≤ 300 мс. Парк как в prisma/seed.ts (6 моделей, 14 байков, 4 тарифа, 4 опции)
// плюс ~250 броней на полгода вперёд — тяжелее, чем свежий сид.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const RUNS = 40;
const H = 3_600_000;
const T0 = Date.UTC(2027, 0, 1, 3);
const FROM = new Date(T0 + 30 * 24 * H).toISOString();
const TO = new Date(T0 + 37 * 24 * H).toISOString();

const SEED = [
  { key: 'vision', brand: 'Honda', name: 'Vision 110', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 110, features: ['USB', 'SMART_KEY'], prices: [150_000, 130_000, 110_000, 90_000], rating: 4.7, popularity: 90, bikes: 3 },
  { key: 'air', brand: 'Honda', name: 'Air Blade 125', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: ['TRUNK', 'USB', 'SMART_KEY'], prices: [180_000, 160_000, 140_000, 120_000], rating: 4.8, popularity: 100, bikes: 3 },
  { key: 'vario', brand: 'Honda', name: 'Vario 160', category: 'MAXI_SCOOTER', transmission: 'AUTOMATIC', engineCc: 160, features: ['TRUNK', 'USB', 'ABS', 'SMART_KEY'], prices: [250_000, 220_000, 200_000, 170_000], rating: 4.9, popularity: 70, bikes: 2 },
  { key: 'nvx', brand: 'Yamaha', name: 'NVX 155', category: 'MAXI_SCOOTER', transmission: 'AUTOMATIC', engineCc: 155, features: ['TRUNK', 'USB', 'ABS', 'SMART_KEY'], prices: [250_000, 220_000, 200_000, 170_000], rating: 4.8, popularity: 75, bikes: 2 },
  { key: 'janus', brand: 'Yamaha', name: 'Janus 125', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: ['TRUNK'], prices: [150_000, 130_000, 110_000, 90_000], rating: 4.6, popularity: 60, bikes: 2 },
  { key: 'evo', brand: 'VinFast', name: 'Evo200', category: 'ELECTRIC', transmission: 'ELECTRIC', engineCc: null, features: ['USB'], prices: [200_000, 180_000, 160_000, 140_000], rating: 4.6, popularity: 40, bikes: 2 },
] as const;

let modelId = '';
let extraId = '';

function p95(ms: number[]): number {
  const sorted = [...ms].sort((a, b) => a - b);
  return sorted[Math.ceil(sorted.length * 0.95) - 1]!;
}

async function measure(fn: () => Promise<{ status: number }>): Promise<number> {
  await fn(); // прогрев
  const times: number[] = [];
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now();
    const res = await fn();
    times.push(performance.now() - t);
    expect(res.status).toBe(200);
  }
  return p95(times);
}

beforeAll(async () => {
  await prisma.$queryRaw`SELECT 1`;
  await resetDb(prisma);
  await createSettings(prisma);
  const loc = await createLocation(prisma);
  const user = await prisma.user.create({ data: { telegramId: 'perf' } });
  for (const [i, m] of SEED.entries()) {
    const { model, bikes } = await createModel(prisma, loc.id, { ...m, features: [...m.features], prices: [...m.prices], bikes: Array.from({ length: m.bikes }, () => ({})) }, i);
    if (i === 0) modelId = model.id;
    // Брони по 2 суток через сутки на каждом байке на ~180 дней
    for (const bike of bikes) {
      const data = Array.from({ length: 18 }, (_, k) => ({ start: T0 + k * 10 * 24 * H + (bike.id.charCodeAt(5) % 5) * 24 * H }));
      for (const { start } of data) await createBooking(prisma, { userId: user.id, modelId: model.id, locationId: loc.id, bikeId: bike.id, startAt: new Date(start), endAt: new Date(start + 48 * H) });
    }
  }
  for (const code of ['HELMET_2', 'RAINCOAT', 'PHONE_HOLDER', 'INSURANCE']) {
    const e = await prisma.extra.create({ data: { code, name: { en: code }, price: 20_000, per: 'DAY', maxQty: 2 } });
    extraId ||= e.id;
  }
  app = await createApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('производительность каталога и расчёта цены (p95 ≤ 300 мс)', () => {
  it('GET /models?from&to с фильтрами и сортировкой', async () => {
    const ms = await measure(() => request(app.getHttpServer()).get(`/api/models?from=${FROM}&to=${TO}&sort=price_asc&cc=110-125,150-160`));
    expect(ms).toBeLessThanOrEqual(300);
  });

  it('GET /models/{id}?from&to', async () => {
    const ms = await measure(() => request(app.getHttpServer()).get(`/api/models/${modelId}?from=${FROM}&to=${TO}`));
    expect(ms).toBeLessThanOrEqual(300);
  });

  it('POST /quotes с опциями', async () => {
    const ms = await measure(() =>
      request(app.getHttpServer()).post('/api/quotes').send({ modelId, startAt: FROM, endAt: TO, extras: [{ id: extraId, qty: 1 }] }),
    );
    expect(ms).toBeLessThanOrEqual(300);
  });

  it('GET /models/{id}/availability?month', async () => {
    const ms = await measure(() => request(app.getHttpServer()).get(`/api/models/${modelId}/availability?month=2027-02`));
    expect(ms).toBeLessThanOrEqual(300);
  });
});
