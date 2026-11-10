import { createHash, createHmac } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient, type BookingStatus } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AdminBookingDetail, AdminReconciliationRow, AuthResponse, Booking } from '@rental/shared';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';
import { BookingsService } from '../../src/bookings';
import { LogNotifier, NOTIFIER } from '../../src/notifications';

// Исправленные ошибки: деньги, статусы, доступность, выход, файлы. Суммы разобраны вручную в каждом тесте.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const DAY = 24 * H;
const envBackup = { ...process.env };
const MUT = { 'x-admin-request': '1' };
const ADMIN = 7401;
const MANAGER = 7402;

let locationId = '';
let modelId = '';
let bikeId = '';
let soloModel = '';
let token = '';
let clientId = '';
let adminCookie = '';
let managerToken = '';
let adminId = '';
const auth = () => ({ Authorization: `Bearer ${token}` });

let seq = 0;
async function booking(p: { status?: BookingStatus; total?: number; deposit?: number; startAt?: Date; endAt?: Date; bike?: string; model?: string; user?: string }) {
  seq += 1;
  const startAt = p.startAt ?? new Date(Date.now() + (40 + seq * 4) * DAY);
  // Свой байк на каждую бронь: сроки в тестах могут пересекаться
  const bike = p.bike ?? (await prisma.bike.create({ data: { modelId: p.model ?? modelId, locationId, plate: `BF-${seq}` } })).id;
  return prisma.booking.create({
    data: { code: `BF-${seq}`, userId: p.user ?? clientId, modelId: p.model ?? modelId, locationId, bikeId: bike, startAt, endAt: p.endAt ?? new Date(startAt.getTime() + DAY), status: p.status ?? 'CONFIRMED', paymentMethod: 'VIETQR', lang: 'en', phone: '+84900000002', rentAmount: p.total ?? 0, totalAmount: p.total ?? 0, depositAmount: p.deposit ?? 0, quote: {} },
  });
}
const paid = (bookingId: string, amount: number, kind: 'RENT' | 'DEPOSIT' | 'REFUND' = 'RENT') => prisma.payment.create({ data: { bookingId, kind, method: 'VIETQR', amount, status: 'PAID', paidAt: new Date() } });

function widget(id: number): Record<string, string | number> {
  const f: Record<string, string | number> = { id, first_name: 'S', auth_date: Math.floor(Date.now() / 1000) };
  const dcs = Object.keys(f).sort().map((k) => `${k}=${f[k]}`).join('\n');
  return { ...f, hash: createHmac('sha256', createHash('sha256').update(TEST_BOT_TOKEN).digest()).update(dcs).digest('hex') };
}
const cookieOf = (res: request.Response) => (res.headers['set-cookie'] as unknown as string[]).find((s) => s.startsWith('admin_session='))!.split(';')[0]!;
const recon = async (id: string) => {
  const res = await http().get('/api/admin/payments/reconciliation').query({ from: new Date(Date.now() - 2 * DAY).toISOString(), to: new Date(Date.now() + 360 * DAY).toISOString() }).set('Cookie', adminCookie);
  return (res.body.items as AdminReconciliationRow[]).find((r) => r.bookingId === id);
};

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ADMIN);
  process.env.NODE_ENV = 'test';
  process.env.DEV_AUTH = '0';
  process.env.API_PUBLIC_URL = 'https://rent.example';
  process.env.FILES_SIGNING_SECRET = 'bugfix-secret';
  await resetDb(prisma);
  await createSettings(prisma, { cashPrepayPercent: 0, cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 } });
  locationId = (await createLocation(prisma)).id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [100_000, 100_000, 100_000, 100_000] as [number, number, number, number], rating: 4.5, popularity: 1 };
  const m = await createModel(prisma, locationId, { ...spec, key: 'bf', name: 'Air Blade', deposit: 500_000, bikes: [{}, {}] });
  modelId = m.model.id;
  bikeId = m.bikes[0]!.id;
  soloModel = (await createModel(prisma, locationId, { ...spec, key: 'bf-solo', name: 'Vision', deposit: 0, bikes: [{}] })).model.id;
  app = await createApp();
  const login = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 7403, first_name: 'C', language_code: 'en' }) });
  token = (login.body as AuthResponse).token;
  clientId = (login.body as AuthResponse).user.id;
  await prisma.user.create({ data: { telegramId: String(MANAGER), firstName: 'M', role: 'MANAGER', locationId } });
  managerToken = ((await http().post('/api/auth/telegram').send({ initData: signInitData({ id: MANAGER, first_name: 'M' }) })).body as AuthResponse).token;
  adminCookie = cookieOf(await http().post('/api/admin/auth/telegram').set(MUT).send(widget(ADMIN)));
  adminId = (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(ADMIN) } })).id;
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

describe('возвраты', () => {
  it('оплата после отмены создаёт запись «к возврату»', async () => {
    const created = (await http().post('/api/bookings').set(auth()).send({ modelId: soloModel, startAt: new Date(Date.now() + 30 * DAY).toISOString(), endAt: new Date(Date.now() + 31 * DAY).toISOString(), paymentMethod: 'VIETQR', phone: '+84900000002', agreed: true })).body as Booking;
    const pay = (await http().post(`/api/bookings/${created.id}/pay`).set(auth())).body as { paymentId: string };
    await http().post(`/api/bookings/${created.id}/cancel`).set(auth()).expect(200);
    // Платёж отменён вместе с бронью, но деньги всё равно пришли
    await prisma.payment.update({ where: { id: pay.paymentId }, data: { status: 'PENDING' } });
    expect((await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth()).send({})).status).toBe(200);
    const refunds = await prisma.payment.findMany({ where: { bookingId: created.id, kind: 'REFUND' } });
    expect(refunds.map((r) => [r.status, r.amount])).toEqual([['PENDING', 100_000]]);
    expect((await recon(created.id))?.state).toBe('REFUND_DUE');
  });

  it('повторная отмена не возвращает уже возвращённое', async () => {
    const b = await booking({ total: 2_000_000 });
    await paid(b.id, 2_000_000);
    await paid(b.id, 500_000, 'REFUND');
    const r = await app.get(BookingsService).cancel(b.id, { id: null, role: 'SYSTEM' }, 'CLIENT');
    expect(r.refundAmount).toBe(1_500_000);
  });

  it('излишек возвращается полностью, процент отмены его не касается', async () => {
    const b = await booking({ total: 1_000_000, deposit: 1_000_000, startAt: new Date(Date.now() + H) });
    await paid(b.id, 3_000_000);
    const r = await app.get(BookingsService).cancel(b.id, { id: null, role: 'SYSTEM' }, 'CLIENT');
    // меньше 2 ч до выдачи: аренда 0 %, депозит 1 000 000 и излишек 1 000 000 — полностью
    expect(r.refundAmount).toBe(2_000_000);
  });
});

describe('сверка', () => {
  it('после возврата излишка бронь больше не «переплата»', async () => {
    const b = await booking({ status: 'ISSUED', total: 1_000_000, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + 200 * DAY) });
    await paid(b.id, 1_200_000);
    expect((await recon(b.id))?.state).toBe('OVERPAID');
    await paid(b.id, 200_000, 'REFUND');
    expect((await recon(b.id))?.state).toBe('OK');
  });

  it('возврат по доброй воле не превращается в «недоплату»', async () => {
    const b = await booking({ status: 'ISSUED', total: 1_000_000, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + 240 * DAY) });
    await paid(b.id, 1_000_000);
    await paid(b.id, 100_000, 'REFUND');
    expect((await recon(b.id))?.state).toBe('OK');
  });

  it('завершённая: депозит за вычетом удержаний вернули — расхождений нет', async () => {
    const b = await booking({ status: 'COMPLETED', total: 1_000_000, deposit: 500_000 });
    await prisma.booking.update({ where: { id: b.id }, data: { refundAmount: 300_000 } });
    await paid(b.id, 1_500_000);
    await prisma.depositDeduction.create({ data: { bookingId: b.id, amount: 200_000, reason: 'scratch', createdById: adminId } });
    await paid(b.id, 300_000, 'REFUND');
    const row = await recon(b.id);
    expect(row).toMatchObject({ state: 'OK', expected: 1_200_000, difference: 0 });
  });
});

describe('наличные', () => {
  it('нельзя записать больше остатка: двойное нажатие не даёт второй платёж', async () => {
    const b = await booking({ total: 300_000 });
    const m = { Authorization: `Bearer ${managerToken}` };
    expect((await http().post(`/api/manager/bookings/${b.id}/cash`).set(m).send({ amount: 300_000 })).status).toBe(201);
    const again = await http().post(`/api/manager/bookings/${b.id}/cash`).set(m).send({ amount: 300_000 });
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('CASH_EXCEEDS_DUE');
    expect(await prisma.payment.count({ where: { bookingId: b.id, status: 'PAID' } })).toBe(1);
  });
});

describe('статусы', () => {
  it('админка не завершает бронь в обход акта приёма', async () => {
    const b = await booking({ status: 'ISSUED', total: 100, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + 210 * DAY) });
    const res = await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', adminCookie).send({ status: 'COMPLETED' });
    expect(res.status).toBe(409);
    expect(((await http().get(`/api/admin/bookings/${b.id}`).set('Cookie', adminCookie)).body as AdminBookingDetail).nextStatuses).not.toContain('COMPLETED');
  });

  it('«Проблема» помнит выдачу: выданный байк нельзя подтвердить снова или отменить', async () => {
    const b = await booking({ status: 'PROBLEM', total: 100, startAt: new Date(Date.now() - DAY), endAt: new Date(Date.now() + 220 * DAY) });
    await prisma.booking.update({ where: { id: b.id }, data: { actualStartAt: new Date() } });
    const d = (await http().get(`/api/admin/bookings/${b.id}`).set('Cookie', adminCookie)).body as AdminBookingDetail;
    expect(d.nextStatuses).toEqual(['ISSUED']);
    expect((await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', adminCookie).send({ status: 'CONFIRMED' })).status).toBe(409);
    expect((await http().patch(`/api/admin/bookings/${b.id}`).set(MUT).set('Cookie', adminCookie).send({ status: 'CANCELLED_BY_SYSTEM' })).status).toBe(409);
  });

  it('о проблеме нельзя сообщить по неоплаченной брони', async () => {
    const b = await booking({ status: 'PENDING_PAYMENT', total: 100 });
    expect((await http().post(`/api/bookings/${b.id}/problem`).set(auth()).send({})).status).toBe(409);
  });

  it('неявка не отменяет бронь с актом выдачи', async () => {
    const b = await booking({ status: 'CONFIRMED', total: 100, startAt: new Date(Date.now() - 5 * H), endAt: new Date(Date.now() + 230 * DAY) });
    await prisma.handoverAct.create({ data: { bookingId: b.id, bikeId: b.bikeId, kind: 'ISSUE', mileageKm: 1, fuelLevel: 50, managerId: adminId } });
    await app.get(BookingsService).cancelNoShows();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: b.id } })).status).toBe('CONFIRMED');
  });

  it('повторное подтверждение после проблемы не шлёт клиенту второе «подтверждена»', async () => {
    const b = await booking({ status: 'PENDING_PAYMENT', total: 100 });
    const service = app.get(BookingsService);
    const notifier = app.get(NOTIFIER) as LogNotifier;
    await service.transition(b.id, 'CONFIRMED', { id: adminId, role: 'ADMIN' });
    await service.transition(b.id, 'PROBLEM', { id: adminId, role: 'ADMIN' });
    await new Promise((r) => setTimeout(r, 100));
    notifier.sent.length = 0;
    await service.transition(b.id, 'CONFIRMED', { id: adminId, role: 'ADMIN' });
    await new Promise((r) => setTimeout(r, 100));
    expect(notifier.sent.filter((m) => m.key.startsWith('bot.client.confirmed'))).toHaveLength(0);
  });
});

describe('бронирование', () => {
  it('просроченный и не возвращённый байк не продаётся на сейчас, но продаётся на будущее', async () => {
    const solo = await prisma.bike.findFirstOrThrow({ where: { modelId: soloModel } });
    const b = await booking({ status: 'ISSUED', total: 100, bike: solo.id, model: soloModel, startAt: new Date(Date.now() - 5 * DAY), endAt: new Date(Date.now() - 3 * DAY) });
    const body = (start: number) => ({ modelId: soloModel, startAt: new Date(Date.now() + start).toISOString(), endAt: new Date(Date.now() + start + DAY).toISOString(), paymentMethod: 'CASH', phone: '+84900000002', agreed: true });
    const soon = await http().post('/api/bookings').set(auth()).send(body(0.2 * H));
    expect([409, 400]).toContain(soon.status);
    expect((await http().post('/api/bookings').set(auth()).send(body(3 * DAY))).status).toBe(201);
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED' } });
  });

  it('закрытая точка: модели не продаются', async () => {
    const other = await prisma.location.create({ data: { name: { en: 'Closed' }, address: 'x', lat: 1, lng: 1, isActive: false } });
    const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [100_000, 100_000, 100_000, 100_000] as [number, number, number, number], rating: 4.5, popularity: 1 };
    const m = (await createModel(prisma, other.id, { ...spec, key: 'bf-closed', name: 'Closed', bikes: [{}] })).model;
    expect((await http().get(`/api/models/${m.id}`)).status).toBe(404);
    const res = await http().post('/api/bookings').set(auth()).send({ modelId: m.id, startAt: new Date(Date.now() + 5 * DAY).toISOString(), endAt: new Date(Date.now() + 6 * DAY).toISOString(), paymentMethod: 'CASH', phone: '+84900000002', agreed: true });
    expect(res.status).toBe(404);
  });

  it('байк нельзя списать с действующей бронью', async () => {
    const second = (await prisma.bike.findMany({ where: { modelId }, orderBy: { id: 'asc' } })).find((x) => x.id !== bikeId)!;
    const b = await booking({ status: 'CONFIRMED', total: 100, bike: second.id });
    const res = await http().patch(`/api/admin/bikes/${second.id}`).set(MUT).set('Cookie', adminCookie).send({ status: 'RETIRED' });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BIKE_HAS_ACTIVE_BOOKING');
    await prisma.booking.update({ where: { id: b.id }, data: { status: 'COMPLETED' } });
  });
});

describe('сессии, файлы, ввод', () => {
  it('выход из админки отзывает токен', async () => {
    const cookie = cookieOf(await http().post('/api/admin/auth/telegram').set(MUT).send(widget(ADMIN)));
    await new Promise((r) => setTimeout(r, 1100));
    await http().post('/api/admin/auth/logout').set(MUT).set('Cookie', cookie).expect(204);
    await new Promise((r) => setTimeout(r, 1100));
    expect((await http().get('/api/admin/auth/me').set('Cookie', cookie)).status).toBe(401);
    adminCookie = cookieOf(await http().post('/api/admin/auth/telegram').set(MUT).send(widget(ADMIN)));
    expect((await http().get('/api/admin/auth/me').set('Cookie', adminCookie)).status).toBe(200);
  });

  it('вход по настоящей подписи снимает роль тестового пользователя', async () => {
    await prisma.user.create({ data: { telegramId: '7490', firstName: 'Demo', role: 'ADMIN', isDemo: true } });
    const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 7490, first_name: 'Real' }) });
    expect((res.body as AuthResponse).role).toBe('CLIENT');
  });

  it('ссылка на файл брони: подпись и срок; чужую бронь не выдаёт', async () => {
    const b = await booking({ total: 100 });
    const other = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 7491, first_name: 'O' }) });
    expect((await http().post(`/api/bookings/${b.id}/file-link`).set({ Authorization: `Bearer ${other.body.token}` }).send({ file: 'calendar' })).status).toBe(404);
    const link = await http().post(`/api/bookings/${b.id}/file-link`).set(auth()).send({ file: 'calendar', lang: 'en' });
    expect(link.status).toBe(200);
    const url = new URL(link.body.url as string);
    expect(url.origin).toBe('https://rent.example');
    const ok = await http().get(url.pathname + url.search);
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('BEGIN:VCALENDAR');
    expect((await http().get(url.pathname + url.search.replace(/sig=../, 'sig=00'))).status).toBe(404);
    url.searchParams.set('exp', '1000');
    expect((await http().get(url.pathname + url.search)).status).toBe(404);
  });

  it('нулевой байт и знак % дают понятный ответ, а не 500', async () => {
    expect((await http().get('/api/models').query({ q: 'a\0' })).status).toBe(400);
    expect((await http().post('/api/events').send({ name: 'open', props: { a: 'x\0' } })).status).toBe(400);
    expect((await http().get('/api/files/public/%25')).status).toBe(404);
  });

  it('курс, заданный вручную, не перезаписывается; автообновление можно вернуть', async () => {
    const save = await http().patch('/api/admin/settings').set(MUT).set('Cookie', adminCookie).send({ rates: { RUB: 0.003, USD: 0.00004 } });
    expect(save.status, JSON.stringify(save.body)).toBe(200);
    expect(save.body.values.ratesManual).toBe(true);
    const back = await http().patch('/api/admin/settings').set(MUT).set('Cookie', adminCookie).send({ rates: { RUB: 0.003, USD: 0.00004, auto: true } });
    expect(back.body.values.ratesManual).toBe(false);
  });
});
