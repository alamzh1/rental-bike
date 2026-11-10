import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminWebAppSession } from '@rental/shared';
import { createApp, createLocation, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Вход в админку внутри Telegram: подпись initData → сессия только для сотрудника.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());
const envBackup = { ...process.env };
const MUT = { 'x-admin-request': '1' };
const ADMIN = 7301;
const MANAGER = 7302;
const CLIENT = 7303;
const NEW_ADMIN = 7304;
const login = (initData: unknown) => http().post('/api/admin/auth/webapp').set(MUT).send({ initData });
const signed = (id: number, date?: number, token?: string) => signInitData({ id, first_name: 'T', language_code: 'ru' }, date, token);

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = `${ADMIN},${NEW_ADMIN}`;
  process.env.NODE_ENV = 'test';
  process.env.DEV_AUTH = '0';
  await resetDb(prisma);
  await createSettings(prisma, {});
  const loc = await createLocation(prisma);
  await prisma.user.create({ data: { telegramId: String(ADMIN), firstName: 'A' } });
  await prisma.user.create({ data: { telegramId: String(MANAGER), firstName: 'M', role: 'MANAGER', locationId: loc.id } });
  await prisma.user.create({ data: { telegramId: String(CLIENT), firstName: 'C' } });
  app = await createApp();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('POST /admin/auth/webapp', () => {
  it('администратор из ADMIN_TELEGRAM_IDS входит: cookie и токен, разделы администратора', async () => {
    const res = await login(signed(ADMIN));
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const body = res.body as AdminWebAppSession;
    expect(body.me.role).toBe('ADMIN');
    expect(body.me.sections).toContain('finance');
    expect(body.token).toBeTruthy();
    expect(String(res.headers['set-cookie'])).toContain('admin_session=');
  });

  it('токен работает без cookie (Telegram в браузере), изменения по-прежнему требуют заголовок', async () => {
    const { token } = (await login(signed(ADMIN))).body as AdminWebAppSession;
    const auth = { Authorization: `Bearer ${token}` };
    expect((await http().get('/api/admin/auth/me').set(auth)).status).toBe(200);
    expect((await http().get('/api/admin/finance/summary').set(auth)).status).toBe(200);
    expect((await http().post('/api/admin/finance/expenses').set(auth).send({})).status).toBe(403);
  });

  it('токен клиента Mini App к админке не подходит', async () => {
    const client = await http().post('/api/auth/telegram').send({ initData: signed(CLIENT) });
    expect(client.status).toBe(200);
    expect((await http().get('/api/admin/auth/me').set({ Authorization: `Bearer ${client.body.token}` })).status).toBe(401);
  });

  it('менеджер входит, но финансы ему закрыты', async () => {
    const { token, me } = (await login(signed(MANAGER))).body as AdminWebAppSession;
    expect(me.role).toBe('MANAGER');
    const auth = { Authorization: `Bearer ${token}` };
    expect((await http().get('/api/admin/tracking').set(auth)).status).toBe(200);
    expect((await http().get('/api/admin/finance/summary').set(auth)).status).toBe(403);
  });

  it('клиент не входит, незнакомый пользователь не создаётся', async () => {
    expect((await login(signed(CLIENT))).status).toBe(403);
    expect((await login(signed(7399))).status).toBe(403);
    expect(await prisma.user.count({ where: { telegramId: '7399' } })).toBe(0);
  });

  it('новый ID из ADMIN_TELEGRAM_IDS входит с первого раза', async () => {
    expect((await login(signed(NEW_ADMIN))).body.me.role).toBe('ADMIN');
  });

  it('чужая подпись, просрочка, пустое тело, нет заголовка', async () => {
    expect((await login(signed(ADMIN, undefined, '999:other'))).status).toBe(401);
    expect((await login(signed(ADMIN, Math.floor(Date.now() / 1000) - 2 * 86400))).status).toBe(401);
    expect((await login(undefined)).status).toBe(400);
    expect((await http().post('/api/admin/auth/webapp').send({ initData: signed(ADMIN) })).status).toBe(403);
  });
});
