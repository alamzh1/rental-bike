import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { Clock } from '../../src/jobs/clock';
import { AdminLoginLinks } from '../../src/notifications/admin-login-links';
import { NOTIFIER, type LogNotifier } from '../../src/notifications/notifier';
import { createApp, createLocation, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Вход в админку через бота: браузер получает сессию только после подтверждения в чате и только по своему секрету.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
let app: INestApplication;
const http = () => request(app.getHttpServer());
const MUT = { 'x-admin-request': '1' };
const OWNER = { id: '9301', firstName: 'Owner', lastName: null, username: null, photoUrl: null };

const start = async () => {
  const res = await http().post('/api/admin/auth/link').set(MUT);
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  const code = /start=login_([\w-]+)$/.exec(res.body.url as string)![1]!;
  return { code, secret: res.body.secret as string, url: res.body.url as string };
};
const poll = (secret: string) => http().post('/api/admin/auth/link/status').set(MUT).send({ secret });

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.TELEGRAM_BOT_USERNAME = 'rent_test_bot';
  process.env.ADMIN_TELEGRAM_IDS = '';
  await resetDb(prisma);
  await createSettings(prisma);
  const loc = await createLocation(prisma);
  await prisma.user.create({ data: { telegramId: OWNER.id, role: 'OWNER', locationId: loc.id, firstName: 'Owner', lang: 'ru' } });
  app = await createApp();
});

afterAll(async () => {
  vi.restoreAllMocks();
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('вход через бота', () => {
  it('ссылка ведёт в бота, секрета в ней нет; до подтверждения сессии нет', async () => {
    const l = await start();
    expect(l.url.startsWith('https://t.me/rent_test_bot?start=login_')).toBe(true);
    expect(l.url).not.toContain(l.secret);
    const res = await poll(l.secret);
    expect(res.body).toEqual({ status: 'pending' });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('подтверждение в боте → cookie сессии и данные сотрудника; секрет срабатывает один раз', async () => {
    const l = await start();
    expect(app.get(AdminLoginLinks).confirm(l.code, OWNER)).toBe(true);
    const res = await poll(l.secret);
    expect(res.body.status).toBe('confirmed');
    expect(res.body.me.role).toBe('OWNER');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).find((c) => c.startsWith('admin_session='))!;
    expect((await http().get('/api/admin/auth/me').set('Cookie', cookie.split(';')[0]!)).status).toBe(200);
    expect((await poll(l.secret)).body).toEqual({ status: 'expired' });
  });

  it('код из ссылки вместо секрета сессию не даёт', async () => {
    const l = await start();
    app.get(AdminLoginLinks).confirm(l.code, OWNER);
    expect((await poll(l.code)).body).toEqual({ status: 'expired' });
    expect((await poll(l.secret)).body.status).toBe('confirmed');
  });

  it('повторно подтвердить той же ссылкой нельзя', async () => {
    const l = await start();
    const links = app.get(AdminLoginLinks);
    expect(links.confirm(l.code, OWNER)).toBe(true);
    expect(links.confirm(l.code, { ...OWNER, id: '1' })).toBe(false);
  });

  it('отказ доходит до браузера; роль снята до выдачи сессии — вход закрыт', async () => {
    const l = await start();
    app.get(AdminLoginLinks).deny(l.code);
    expect((await poll(l.secret)).body).toEqual({ status: 'denied' });
    const s = await start();
    app.get(AdminLoginLinks).confirm(s.code, { ...OWNER, id: '9999' });
    expect((await poll(s.secret)).status).toBe(403);
  });

  it('через 5 минут ссылка не работает', async () => {
    const l = await start();
    const clock = app.get(Clock);
    const later = new Date(Date.now() + 6 * 60_000);
    const spy = vi.spyOn(clock, 'now').mockReturnValue(later);
    expect(app.get(AdminLoginLinks).confirm(l.code, OWNER)).toBe(false);
    expect((await poll(l.secret)).body).toEqual({ status: 'expired' });
    spy.mockRestore();
  });

  it('без заголовка x-admin-request запрос отклоняется', async () => {
    expect((await http().post('/api/admin/auth/link')).status).toBe(403);
  });
});

describe('защита входа', () => {
  const ORIGIN = { 'x-forwarded-for': '203.0.113.7', 'cf-ipcountry': 'VN', 'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36' };

  it('бот знает, откуда открыта страница; после входа сотрудник получает уведомление', async () => {
    const notifier = app.get<LogNotifier>(NOTIFIER);
    notifier.sent.length = 0;
    const res = await http().post('/api/admin/auth/link').set(MUT).set(ORIGIN);
    const code = /start=login_([\w-]+)$/.exec(res.body.url as string)![1]!;
    const links = app.get(AdminLoginLinks);
    expect(links.origin(code)).toEqual({ ip: '203.0.113.7', country: 'VN', device: 'Chrome, Mac' });
    links.confirm(code, OWNER);
    await poll(res.body.secret as string).expect(200);
    const notice = notifier.sent.find((s) => s.key === 'bot.admin.loginNotice');
    expect(notice?.telegramId).toBe(OWNER.id);
    expect(notice?.text).toContain('203.0.113.7');
    expect(notice?.text).toContain('/logout');
  });

  it('один адрес не может закрыть вход остальным', async () => {
    const flood = { 'x-forwarded-for': '198.51.100.9' };
    let limited = 0;
    for (let i = 0; i < 25; i++) if ((await http().post('/api/admin/auth/link').set(MUT).set(flood)).status === 429) limited++;
    expect(limited).toBe(5);
    expect((await http().post('/api/admin/auth/link').set(MUT).set({ 'x-forwarded-for': '198.51.100.10' })).status).toBe(200);
  });

  it('cookie защищён при входе по HTTPS и остаётся рабочим на localhost', async () => {
    const dev = (proto?: Record<string, string>) => http().post('/api/admin/auth/dev').set(MUT).set(proto ?? {}).send({ role: 'manager' });
    process.env.DEV_AUTH = '1';
    const secure = await dev({ 'x-forwarded-proto': 'https' });
    expect(String(secure.headers['set-cookie'])).toContain('Secure');
    expect(String((await dev()).headers['set-cookie'])).not.toContain('Secure');
    delete process.env.DEV_AUTH;
  });
});

describe('выбор языка', () => {
  it('новый клиент сначала выбирает язык; выбор запоминается', async () => {
    const login = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 9302, first_name: 'C', language_code: 'vi' }) });
    expect(login.body.user).toMatchObject({ lang: 'vi', langChosen: false });
    const res = await http().patch('/api/me').set({ Authorization: `Bearer ${login.body.token as string}` }).send({ lang: 'ru' });
    expect(res.body).toMatchObject({ lang: 'ru', langChosen: true });
    const again = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 9302, first_name: 'C', language_code: 'vi' }) });
    expect(again.body.user).toMatchObject({ lang: 'ru', langChosen: true });
  });
});
