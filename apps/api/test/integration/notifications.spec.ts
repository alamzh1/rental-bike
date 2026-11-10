import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { AuthResponse, Booking, PayBookingResponse, RatesResponse } from '@rental/shared';
import { Clock, JOB_REMINDER, JobsService } from '../../src/jobs';
import { BookingsService } from '../../src/bookings';
import { LogNotifier, NOTIFIER, NotificationsService, JOB_OVERDUE, JOB_RETURN_REMINDER } from '../../src/notifications';
import { PaymentsService } from '../../src/payments';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Таск 06: события §8.3 → сообщения нужному получателю на его языке с кнопкой startapp=booking_<id>; напоминания; сводка; чек; договор; курс.
// Бот — LogNotifier (токена нет). Время/суммы — вручную: 1 сутки = 200 000 ₫, депозит 1 000 000 ₫.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
let app: INestApplication;
let notifier: LogNotifier;
let jobs: JobsService;
let bookings: BookingsService;
let clock: Clock;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const realNow = Date.now();
// Выдача через 5 суток ровно в 10:00 по Вьетнаму (03:00 UTC)
const day0 = new Date(Math.floor(realNow / (24 * H)) * 24 * H + 5 * 24 * H + 3 * H);
let slot = 0;
const period = () => {
  const start = new Date(day0.getTime() + slot++ * 3 * 24 * H);
  return { start, startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString() };
};

interface Client {
  token: string;
  userId: string;
}
let ru: Client;
let en: Client;
let manager: Client;
let modelId = '';
let locationId = '';
const auth = (u: Client) => ({ Authorization: `Bearer ${u.token}` });

async function login(telegramId: number, lang: string): Promise<Client> {
  const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: telegramId, first_name: 'T', language_code: lang }) });
  const body = res.body as AuthResponse;
  return { token: body.token, userId: body.user.id };
}

async function book(u: Client, extra: Record<string, unknown> = {}): Promise<Booking> {
  const res = await http().post('/api/bookings').set(auth(u)).send({ modelId, paymentMethod: 'VIETQR', phone: '+84901234567', agreed: true, ...period(), ...extra });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  return res.body as Booking;
}

async function payOnline(u: Client, id: string, amount?: number): Promise<void> {
  const pay = (await http().post(`/api/bookings/${id}/pay`).set(auth(u))).body as PayBookingResponse;
  const r = await http().post(`/api/dev/payments/${pay.paymentId}/pay`).set(auth(u)).send(amount === undefined ? {} : { amount });
  expect(r.status, JSON.stringify(r.body)).toBe(200);
}

/** События рассылаются без ожидания — ждём появления сообщений. */
async function until<T>(fn: () => T | undefined | false, ms = 3000): Promise<T> {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) throw new Error('timeout waiting for notification');
    await new Promise((r) => setTimeout(r, 20));
  }
}
const norm = (t: string) => t.replace(/[\u00a0\u202f]/g, ' ');
const settle = () => new Promise((r) => setTimeout(r, 150));
const forBooking = (id: string) => notifier.sent.filter((m) => m.button?.startapp === `booking_${id}`);
const find = (id: string, key: string, to?: string) => forBooking(id).find((m) => m.key === key && (!to || m.telegramId === to));
const tg = async (u: Client) => (await prisma.user.findUniqueOrThrow({ where: { id: u.userId } })).telegramId;

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN; // для проверки initData; в тестах бот не поднимается (VITEST) — работает LogNotifier
  process.env.ADMIN_ALERT_CHAT_ID = '-100777';
  process.env.STORAGE_DRIVER = 'local';
  await resetDb(prisma);
  await createSettings(prisma, {
    holdMinutes: 15,
    cancel: { fullHours: 24, halfHours: 2, halfPercent: 50 },
    late: { graceMinutes: 60, hourlyFee: 30_000, extraDayAfterHours: 4 },
    noShowHours: 3,
    cashPrepayPercent: 0,
    managerContact: '@test_manager',
    rates: { RUB: 0.0035, USD: 0.000038, updatedAt: '2026-10-27T00:00:00.000Z' },
    contractTemplate: { ru: 'ТЕКСТ ДОГОВОРА ру', en: 'CONTRACT TEXT en', vi: 'NỘI DUNG HỢP ĐỒNG vi' },
  });
  const loc = await createLocation(prisma);
  locationId = loc.id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], prices: [200_000, 180_000, 160_000, 140_000] as [number, number, number, number], rating: 4.8, popularity: 1 };
  modelId = (await createModel(prisma, loc.id, { ...spec, key: 'n', name: 'Air Blade', bikes: Array.from({ length: 12 }, () => ({})) })).model.id;
  app = await createApp();
  notifier = app.get(NOTIFIER) as LogNotifier;
  jobs = app.get(JobsService);
  bookings = app.get(BookingsService);
  clock = app.get(Clock);
  ru = await login(7001, 'ru');
  en = await login(7002, 'en');
  manager = await login(7003, 'vi');
  await prisma.user.update({ where: { id: ru.userId }, data: { lang: 'ru', currency: 'RUB' } });
  await prisma.user.update({ where: { id: en.userId }, data: { lang: 'en', currency: 'VND' } });
  await prisma.user.update({ where: { id: manager.userId }, data: { role: 'MANAGER', locationId, lang: 'vi' } });
});

beforeEach(() => {
  clock.now = () => new Date();
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
});

describe('подтверждение и оплата', () => {
  it('наличные: клиенту подтверждение с суммой при выдаче на его языке, менеджеру — пометка «оплата при выдаче» на вьетнамском', async () => {
    const b = await book(ru, { paymentMethod: 'CASH' });
    const toClient = await until(() => find(b.id, 'bot.client.confirmedCash', undefined));
    expect(toClient.telegramId).toBe(await tg(ru));
    expect(toClient.params.lang).toBe('ru');
    expect(toClient.text).toContain('подтверждена');
    expect(norm(toClient.text)).toContain('1 200 000 ₫ (≈ 4 200 ₽)'); // 200 000 + депозит 1 000 000; курс 0.0035 ₽ за ₫
    expect(toClient.text).toContain('@test_manager');
    expect(toClient.button).toEqual({ textKey: 'bot.open', startapp: `booking_${b.id}` });
    const toManager = await until(() => find(b.id, 'bot.manager.newBookingCash', await_tg.manager));
    expect(toManager.text).toContain('Đơn mới');
    expect(toManager.text).toContain(b.code);
    expect(toManager.params.lang).toBe('vi');
  });

  it('VietQR: пока не оплачено — тишина; после оплаты — подтверждение, чек и новая бронь менеджеру; напоминания запланированы', async () => {
    const b = await book(en);
    await settle();
    expect(forBooking(b.id)).toHaveLength(0);
    await payOnline(en, b.id);
    const confirmed = await until(() => find(b.id, 'bot.client.confirmed'));
    expect(confirmed.text).toContain('is confirmed');
    expect(confirmed.text).toContain('Address:');
    const receipt = await until(() => find(b.id, 'bot.client.receipt'));
    expect(receipt.text).toContain(b.code);
    expect(receipt.text).toContain('1,200,000'); // всего оплачено
    expect(receipt.text).toContain('VietQR');
    await until(() => find(b.id, 'bot.manager.newBooking'));
    expect(jobs.hasTimer(`reminder-24h-${b.id}`)).toBe(true);
    expect(jobs.hasTimer(`reminder-2h-${b.id}`)).toBe(true);
  });

  it('несовпадение суммы: менеджеру сообщение, администратору — алерт в ADMIN_ALERT_CHAT_ID', async () => {
    const b = await book(en);
    await payOnline(en, b.id, 100_000);
    await until(() => find(b.id, 'bot.manager.paymentMismatch'));
    const alert = await until(() => notifier.sent.find((m) => m.key === 'bot.alert' && m.telegramId === '-100777' && m.text.includes(b.code)));
    expect(alert.text).toContain('Payment mismatch');
  });
});

describe('напоминания', () => {
  it('за 24 ч: клиенту напоминание с адресом и картой; документы не загружены — просьба загрузить; с документом — без просьбы', async () => {
    const b = await book(en, { paymentMethod: 'CASH' });
    await until(() => find(b.id, 'bot.client.confirmedCash'));
    notifier.sent.length = 0;
    await jobs.run(JOB_REMINDER, { bookingId: b.id, kind: '24h' });
    const r = await until(() => find(b.id, 'bot.client.reminder24h'));
    expect(r.text).toContain('4c Nguyễn Huệ');
    expect(r.text).toContain('https://www.google.com/maps');
    expect(find(b.id, 'bot.client.docs')).toBeDefined();

    await prisma.document.create({ data: { userId: en.userId, type: 'PASSPORT', fileKey: 'documents/x/1' } });
    notifier.sent.length = 0;
    await jobs.run(JOB_REMINDER, { bookingId: b.id, kind: '24h' });
    expect(find(b.id, 'bot.client.reminder24h')).toBeDefined();
    expect(find(b.id, 'bot.client.docs')).toBeUndefined();
    notifier.sent.length = 0;
    await jobs.run(JOB_REMINDER, { bookingId: b.id, kind: '2h' });
    expect(find(b.id, 'bot.client.reminder2h')).toBeDefined();
    await prisma.document.deleteMany({ where: { userId: en.userId } });
  });

  it('при отмене все напоминания сняты и задача уже ничего не шлёт', async () => {
    const b = await book(en, { paymentMethod: 'CASH' });
    await until(() => find(b.id, 'bot.client.confirmedCash'));
    expect(jobs.hasTimer(`reminder-24h-${b.id}`)).toBe(true);
    const res = await http().post(`/api/bookings/${b.id}/cancel`).set(auth(en));
    expect(res.status).toBe(200);
    expect(jobs.hasTimer(`reminder-24h-${b.id}`)).toBe(false);
    expect(jobs.hasTimer(`reminder-2h-${b.id}`)).toBe(false);
    await until(() => find(b.id, 'bot.client.cancelled'));
    await until(() => find(b.id, 'bot.manager.cancelled', await_tg.manager)); // сообщение менеджеру идёт после клиентского
    notifier.sent.length = 0;
    await jobs.run(JOB_REMINDER, { bookingId: b.id, kind: '24h' });
    expect(forBooking(b.id)).toHaveLength(0);
  });
});

describe('отмена, возврат', () => {
  it('отмена оплаченной брони: клиенту сумма возврата, менеджеру — байк освобождён; затем возврат депозита', async () => {
    const b = await book(ru);
    await payOnline(ru, b.id);
    await until(() => find(b.id, 'bot.manager.newBooking'));
    const res = await http().post(`/api/bookings/${b.id}/cancel`).set(auth(ru));
    expect(res.status).toBe(200);
    const refund = (res.body as { refundAmount: number }).refundAmount;
    expect(refund).toBe(1_200_000); // больше 24 ч до выдачи: 100%
    const c = await until(() => find(b.id, 'bot.client.cancelledRefund'));
    expect(c.text).toContain('Сумма возврата');
    expect(norm(c.text)).toContain('1 200 000 ₫ (≈ 4 200 ₽)');
    const m = await until(() => find(b.id, 'bot.manager.cancelled'));
    expect(m.text).toContain('xe đã trống');
    const payment = await prisma.payment.findFirstOrThrow({ where: { bookingId: b.id, kind: 'REFUND' } });
    await app.get(PaymentsService).completeRefund(payment.id, { id: manager.userId, role: 'ADMIN' });
    const r = await until(() => find(b.id, 'bot.client.refunded'));
    expect(r.text).toContain('Возврат');
    expect(r.button?.startapp).toBe(`booking_${b.id}`);
  });
});

describe('выдача, просрочка, оценка', () => {
  it('выдана: напоминание о возврате и тревога о просрочке (клиенту — доплата, менеджеру — контакт); завершена — просьба оценить', async () => {
    const b = await book(en, { paymentMethod: 'CASH' });
    await until(() => find(b.id, 'bot.client.confirmedCash'));
    const staff = { id: manager.userId, role: 'MANAGER' as const };
    await bookings.transition(b.id, 'ISSUED', staff);
    await until(() => jobs.hasTimer(`overdue-${b.id}`));
    expect(jobs.hasTimer(`return-12h-${b.id}`)).toBe(true);
    notifier.sent.length = 0;

    await jobs.run(JOB_RETURN_REMINDER, { bookingId: b.id });
    expect(find(b.id, 'bot.client.returnReminder')?.text).toContain('return the bike in 12 hours');

    await jobs.run(JOB_OVERDUE, { bookingId: b.id });
    const toClient = find(b.id, 'bot.client.overdue');
    expect(toClient?.text).toContain('30,000'); // почасовая доплата
    const toManager = find(b.id, 'bot.manager.overdue', await_tg.manager);
    expect(toManager?.text).toContain('+84901234567');
    expect(toManager?.text).toContain('CẢNH BÁO');

    await bookings.transition(b.id, 'COMPLETED', staff);
    await until(() => find(b.id, 'bot.client.rate'));
    expect(jobs.hasTimer(`overdue-${b.id}`)).toBe(false);
    expect(jobs.hasTimer(`return-12h-${b.id}`)).toBe(false);
    // после завершения задача просрочки молчит
    notifier.sent.length = 0;
    await jobs.run(JOB_OVERDUE, { bookingId: b.id });
    expect(forBooking(b.id)).toHaveLength(0);
  });
});

describe('сводка выдач на завтра', () => {
  it('в 20:00 по точке менеджеру уходит список выдач на завтра, повторный запуск не дублирует', async () => {
    const p = period();
    const b = await book(en, { paymentMethod: 'CASH', startAt: p.startAt, endAt: p.endAt });
    await until(() => find(b.id, 'bot.client.confirmedCash'));
    const mgr = await tg(manager);
    const summaryFor = () => notifier.sent.filter((m) => m.key === 'bot.manager.summary' && m.telegramId === mgr && m.text.includes(b.code));
    // накануне 19:59 по Вьетнаму (12:59 UTC) — рано; 20:05 (13:05 UTC) — отправка
    const eve = new Date(p.start.getTime() - 24 * H - 3 * H); // полночь UTC-дня выдачи минус... вычислим явно ниже
    const evening = (h: number, m: number) => new Date(Date.UTC(p.start.getUTCFullYear(), p.start.getUTCMonth(), p.start.getUTCDate() - 1, h, m));
    expect(eve).toBeInstanceOf(Date);
    const svc = app.get(NotificationsService);
    clock.now = () => evening(12, 59);
    await svc.runTomorrowSummary();
    expect(summaryFor()).toHaveLength(0);
    clock.now = () => evening(13, 5);
    await svc.runTomorrowSummary();
    await svc.runTomorrowSummary();
    const sent = summaryFor();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.text).toContain('Lịch nhận xe ngày mai');
    expect(sent[0]!.text).toContain('10:00'); // выдача в 10:00 по Вьетнаму
    expect(sent[0]!.button).toEqual({ textKey: 'bot.openToday', startapp: 'manager' });
  });
});

describe('курс и договор', () => {
  it('GET /api/rates без авторизации: курсы из настроек и дата', async () => {
    const res = await http().get('/api/rates');
    expect(res.status).toBe(200);
    expect(res.body as RatesResponse).toEqual({ RUB: 0.0035, USD: 0.000038, updatedAt: '2026-10-27T00:00:00.000Z' });
  });

  it('GET /bookings/{id}/contract: владельцу PDF, постороннему клиенту 404', async () => {
    const b = await book(ru, { paymentMethod: 'CASH' });
    const res = await http().get(`/api/bookings/${b.id}/contract?lang=ru`).set(auth(ru)).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(2); // ru + vi
    expect((await http().get(`/api/bookings/${b.id}/contract`).set(auth(en))).status).toBe(404);
    expect((await http().get(`/api/bookings/${b.id}/contract`)).status).toBe(401);
  });
});

const await_tg = { manager: '' };
beforeAll(async () => {
  await_tg.manager = await tg(manager);
});
