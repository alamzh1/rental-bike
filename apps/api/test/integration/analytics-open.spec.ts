import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminDashboard } from '@rental/shared';
import { createApp, createLocation, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// История 57 (R50): открытие Mini App → событие `open` с источником → счётчик «открыли приложение» на дашборде админки.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());
const envBackup = { ...process.env };

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.NODE_ENV = 'test';
  process.env.DEV_AUTH = '1';
  await resetDb(prisma);
  await createSettings(prisma);
  await createLocation(prisma);
  app = await createApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = { ...envBackup };
});

describe('воронка: открытие приложения', () => {
  it('POST /events open с источником увеличивает счётчик открытий и попадает в источники дашборда', async () => {
    const admin = await http().post('/api/admin/auth/dev').set({ 'x-admin-request': '1' }).send({ role: 'admin' });
    const cookie = ((admin.headers['set-cookie'] as unknown as string[]).find((s) => s.startsWith('admin_session=')) ?? '').split(';')[0]!;
    const dash = async () => (await http().get('/api/admin/dashboard').set('Cookie', cookie)).body as AdminDashboard;
    const opens = (d: AdminDashboard) => d.funnel.steps.find((s) => s.name === 'open')!.count;
    const before = await dash();

    const login = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 9101, first_name: 'T', language_code: 'ru' }) });
    expect(login.status).toBe(200);
    const token = (login.body as { token: string }).token;
    const res = await http().post('/api/events').set('Authorization', `Bearer ${token}`).send({ name: 'open', source: 'startapp:ad_spring' });
    expect(res.status).toBe(204);

    const after = await dash();
    expect(opens(after)).toBe(opens(before) + 1);
    expect(after.funnel.sources).toContainEqual({ source: 'startapp:ad_spring', count: 1 });
  });
});
