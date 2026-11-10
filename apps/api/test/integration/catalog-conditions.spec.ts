import type { INestApplication } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ModelDetail } from '@rental/shared';
import { createApp, createLocation, createModel, createSettings, resetDb } from './support/catalog-fixture';

// История 21: ограничения (пробег, поездки между провинциями) в «Условиях» берутся из настроек, а не выдумываются.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
let modelId = '';
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  await resetDb(prisma);
  await createSettings(prisma);
  const loc = await createLocation(prisma);
  modelId = (await createModel(prisma, loc.id, { key: 'air', brand: 'Honda', name: 'Air Blade 125', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: [], prices: [180_000, 160_000, 140_000, 120_000], rating: 4.5, popularity: 1, bikes: [{}] })).model.id;
  await prisma.bikeModel.update({ where: { id: modelId }, data: { conditions: Prisma.DbNull } });
  app = await createApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('условия карточки модели', () => {
  it('ограничения не заданы → conditions = null (клиент покажет заглушку)', async () => {
    const res = await http().get(`/api/models/${modelId}`);
    expect(res.status).toBe(200);
    expect((res.body as ModelDetail).conditions).toBeNull();
  });

  it('ограничения заданы в настройках → приходят в conditions', async () => {
    const text = { ru: 'Не более 200 км в сутки; в другую провинцию — по согласованию', en: 'Up to 200 km a day' };
    await createSettings(prisma, { restrictionsText: text });
    const res = await http().get(`/api/models/${modelId}`);
    expect((res.body as ModelDetail).conditions).toEqual(text);
  });

  it('собственные условия модели главнее настройки', async () => {
    const own = { ru: 'Только по городу', en: 'City only' };
    await prisma.bikeModel.update({ where: { id: modelId }, data: { conditions: own } });
    const res = await http().get(`/api/models/${modelId}`);
    expect((res.body as ModelDetail).conditions).toEqual(own);
  });
});
