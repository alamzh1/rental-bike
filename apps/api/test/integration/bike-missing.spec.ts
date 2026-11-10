import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ADMIN_LOCATION_HEADER, type AdminActArchive, type AdminBookingDetail, type AdminSupervision, type AuthResponse, type Booking, type HomeResponse, type ManagerBookingDetail, type ModelListResponse } from '@rental/shared';
import { STORAGE, type Storage } from '../../src/documents/storage/storage';
import { BookingsService } from '../../src/bookings/bookings.service';
import { RateLimiter } from '../../src/bookings/rate-limit';
import { IncidentsService } from '../../src/bookings/incidents.service';
import { NotificationsService } from '../../src/notifications/notifications.service';
import { NOTIFIER, type LogNotifier } from '../../src/notifications/notifier';
import { createApp, createBooking, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Байка нет на месте, обязательные фото и контроль владельцев.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
let app: INestApplication;
const http = () => request(app.getHttpServer());
const H = 3_600_000;
const MUT = { 'x-admin-request': '1' };
const TG = { client: 9201, ownerA: 9202, ownerB: 9203, manager: 9204, admin: 9205 };
const auth: Record<string, Record<string, string>> = {};
const miniapp: Record<string, Record<string, string>> = {};

let locA = '';
let locB = '';
let visionId = '';
let cheapId = '';
let dearId = '';
let bigId = '';
let otherId = '';
let visionBikes: string[] = [];
let cheapBike = '';
let dearBike = '';
let bigBike = '';
let clientId = '';

const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, engineCc: 125, features: [], rating: 4.5, popularity: 1 };
const DAY = 400_000;

async function staffSession(telegramId: number): Promise<Record<string, string>> {
  const res = await http().post('/api/admin/auth/webapp').set(MUT).send({ initData: signInitData({ id: telegramId, first_name: 'S', language_code: 'en' }) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { Authorization: `Bearer ${(res.body as { token: string }).token}` };
}

async function bearer(telegramId: number): Promise<Record<string, string>> {
  const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: telegramId, first_name: 'C', language_code: 'ru' }) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { Authorization: `Bearer ${(res.body as AuthResponse).token}` };
}

/** Подтверждённая и оплаченная бронь; прежние брони этого байка убираются, чтобы периоды не пересекались. */
async function paidBooking(bikeId = visionBikes[0]!, startInHours = 1): Promise<string> {
  const startAt = new Date(Date.now() + startInHours * H);
  await prisma.booking.deleteMany({ where: { bikeId, status: { in: ['CONFIRMED', 'ISSUED', 'PROBLEM'] } } });
  const b = await createBooking(prisma, { userId: clientId, modelId: visionId, locationId: locA, bikeId, startAt, endAt: new Date(startAt.getTime() + 24 * H), status: 'CONFIRMED' });
  await prisma.booking.update({ where: { id: b.id }, data: { rentAmount: DAY, totalAmount: DAY, depositAmount: 1_000_000, paymentMethod: 'VIETQR' } });
  await prisma.payment.create({ data: { bookingId: b.id, kind: 'RENT', method: 'VIETQR', amount: DAY + 1_000_000, status: 'PAID', paidAt: new Date() } });
  return b.id;
}

const clientBooking = async (id: string) => (await http().get(`/api/bookings/${id}`).set(miniapp.client!)).body as Booking;
const report = (id: string) => http().post(`/api/bookings/${id}/bike-missing`).set(miniapp.client!).send({ comment: 'нет на стоянке' });
const refunds = (id: string) => prisma.payment.findMany({ where: { bookingId: id, kind: 'REFUND' } });

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(TG.admin);
  process.env.NODE_ENV = 'test';
  await resetDb(prisma);
  await createSettings(prisma, { depositMode: 'DOCUMENT', maxUnpaidBookings: 3, maxActiveBookings: 5 });
  const a = await createLocation(prisma);
  // Проверки ниже не зависят от времени запуска; закрытая точка — в отдельном тесте
  await prisma.location.update({ where: { id: a.id }, data: { openTime: '00:00', closeTime: '23:59' } });
  const b = await prisma.location.create({ data: { name: { ru: 'Точка Б', en: 'Point B', vi: 'Điểm B' }, address: 'B street', lat: 1, lng: 1 } });
  locA = a.id;
  locB = b.id;
  const prices = (p: number): [number, number, number, number] => [p, p, p, p];
  const vision = await createModel(prisma, locA, { ...spec, key: 'v', name: 'Vision', prices: prices(DAY), bikes: [{}, {}] });
  const cheap = await createModel(prisma, locA, { ...spec, key: 'c', name: 'Cheap', prices: prices(150_000), bikes: [{}] });
  const dear = await createModel(prisma, locA, { ...spec, key: 'd', name: 'Dear', prices: prices(900_000), bikes: [{}] });
  const big = await createModel(prisma, locA, { ...spec, key: 'big', name: 'Big', prices: prices(100_000), bikes: [{}] });
  const other = await createModel(prisma, locB, { ...spec, key: 'o', name: 'Other', prices: prices(DAY), bikes: [{}] });
  visionId = vision.model.id;
  cheapId = cheap.model.id;
  dearId = dear.model.id;
  bigId = big.model.id;
  otherId = other.model.id;
  visionBikes = vision.bikes.map((x) => x.id);
  cheapBike = cheap.bikes[0]!.id;
  dearBike = dear.bikes[0]!.id;
  bigBike = big.bikes[0]!.id;
  await prisma.bikeModel.update({ where: { id: bigId }, data: { licenseRequired: 'A' } });
  app = await createApp();
  miniapp.client = await bearer(TG.client);
  clientId = (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG.client) } })).id;
  for (const [tg, role, locationId] of [[TG.ownerA, 'OWNER', locA], [TG.ownerB, 'OWNER', locB], [TG.manager, 'MANAGER', locA]] as const) {
    await prisma.user.create({ data: { telegramId: String(tg), firstName: 'Staff', role, locationId, lang: 'ru' } });
  }
  auth.ownerA = await staffSession(TG.ownerA);
  auth.ownerB = await staffSession(TG.ownerB);
  auth.admin = await staffSession(TG.admin);
  miniapp.manager = await bearer(TG.manager);
  miniapp.ownerB = await bearer(TG.ownerB);
});

afterAll(async () => {
  await app?.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

beforeEach(async () => {
  await prisma.bookingIncident.deleteMany();
  app.get<LogNotifier>(NOTIFIER).sent.length = 0;
});

describe('фильтр каталога по точке', () => {
  it('главная отдаёт открытые точки с байками, каталог сужается до выбранной', async () => {
    const home = (await http().get('/api/home')).body as HomeResponse;
    expect(home.points.map((p) => p.id).sort()).toEqual([locA, locB].sort());
    const list = (await http().get('/api/models').query({ locationId: locB })).body as ModelListResponse;
    expect(list.items.map((m) => m.id)).toEqual([otherId]);
    expect((await http().get('/api/models/count').query({ locationId: locB })).body.count).toBe(1);
  });
});

describe('байка нет на месте: клиент', () => {
  it('раньше чем за 2 часа до выдачи сообщить нельзя', async () => {
    const id = await paidBooking(visionBikes[0], 30);
    const res = await report(id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BIKE_MISSING_TOO_EARLY');
  });

  it('точка и администратор узнают сразу, повторное нажатие не создаёт второй случай', async () => {
    const id = await paidBooking();
    expect((await report(id)).status).toBe(200);
    expect((await report(id)).status).toBe(200);
    expect(await prisma.bookingIncident.count({ where: { bookingId: id } })).toBe(1);
    await new Promise((r) => setTimeout(r, 50));
    const to = app.get<LogNotifier>(NOTIFIER).sent.filter((s) => s.key === 'bot.manager.bikeMissing').map((s) => s.telegramId);
    expect(to).toEqual(expect.arrayContaining([String(TG.ownerA), String(TG.manager), String(TG.admin)]));
    expect(to).not.toContain(String(TG.ownerB));
    expect((await clientBooking(id)).incident).toMatchObject({ proposal: null });
  });

  it('сразу отменить нельзя: у точки есть время ответить. После ожидания — полный возврат вне правил отмены', async () => {
    const id = await paidBooking();
    await report(id);
    const early = await http().post(`/api/bookings/${id}/bike-missing/cancel`).set(miniapp.client!);
    expect(early.body.code).toBe('INCIDENT_WAIT');
    await prisma.bookingIncident.updateMany({ where: { bookingId: id }, data: { clientReportedAt: new Date(Date.now() - 16 * 60_000) } });
    const done = await http().post(`/api/bookings/${id}/bike-missing/cancel`).set(miniapp.client!);
    expect(done.status, JSON.stringify(done.body)).toBe(200);
    expect(done.body).toMatchObject({ status: 'CANCELLED_BY_SYSTEM', cancelReason: 'BIKE_MISSING', refundAmount: DAY + 1_000_000 });
    expect((await refunds(id)).map((r) => [r.status, r.amount])).toEqual([['PENDING', DAY + 1_000_000]]);
    expect(await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: id } })).toMatchObject({ status: 'RESOLVED', resolution: 'CANCELLED' });
  });

  it('пока клиент ждёт ответа, точка не уйдёт от полного возврата: «не пришёл» и отмена по правилам закрыты', async () => {
    const id = await paidBooking();
    await report(id);
    expect((await http().post(`/api/manager/bookings/${id}/no-show`).set(miniapp.manager!)).body.code).toBe('INCIDENT_OPEN');
    for (const status of ['CANCELLED_BY_SYSTEM', 'CANCELLED_BY_CLIENT']) {
      expect((await http().patch(`/api/admin/bookings/${id}`).set({ ...auth.ownerA!, ...MUT }).send({ status })).body.code).toBe('INCIDENT_OPEN');
    }
    expect((await clientBooking(id)).status).toBe('CONFIRMED');
    await prisma.booking.update({ where: { id }, data: { startAt: new Date(Date.now() - 48 * H), endAt: new Date(Date.now() - 24 * H) } }).catch(() => undefined);
    await app.get(BookingsService).cancelNoShows();
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe('CONFIRMED');
  });

  it('если клиент всё же отменил обычной отменой, случай не остаётся висеть', async () => {
    const id = await paidBooking();
    await report(id);
    await http().post(`/api/bookings/${id}/cancel`).set(miniapp.client!).expect(200);
    expect(await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: id } })).toMatchObject({ status: 'RESOLVED', resolution: 'CANCELLED' });
  });

  it('чужую бронь нельзя ни сообщить, ни отменить', async () => {
    const id = await paidBooking();
    expect((await http().post(`/api/bookings/${id}/bike-missing`).set(miniapp.manager!).send({})).status).toBe(404);
  });

  it('точка не ответила 15 минут: администратор получает сообщение', async () => {
    const id = await paidBooking();
    await report(id);
    const row = await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: id } });
    await (app.get(NotificationsService) as unknown as { onIncidentEscalate(d: { incidentId: string }): Promise<void> }).onIncidentEscalate({ incidentId: row.id });
    const sent = app.get<LogNotifier>(NOTIFIER).sent;
    expect(sent.find((s) => s.key === 'bot.admin.incidentNoAnswer')?.telegramId).toBe(String(TG.admin));
    expect(sent.some((s) => s.key === 'bot.client.bikeMissingWait')).toBe(true);
    expect((await prisma.bookingIncident.findUniqueOrThrow({ where: { id: row.id } })).escalatedAt).not.toBeNull();
  });
});

describe('защита от ложного сообщения', () => {
  it('пока точка закрыта, сообщить нельзя: отвечать некому, таймер возврата не запускается', async () => {
    const id = await paidBooking();
    const tz = (await prisma.location.findUniqueOrThrow({ where: { id: locA } })).timezone;
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', hourCycle: 'h23' }).format(new Date()));
    // Окно работы — час, который уже прошёл или ещё не наступил
    const other = (hour + 3) % 24;
    const pad = (n: number) => String(n).padStart(2, '0');
    const window = other === 23 ? { openTime: '22:00', closeTime: '23:00' } : { openTime: `${pad(other)}:00`, closeTime: `${pad(other + 1)}:00` };
    await prisma.location.update({ where: { id: locA }, data: window });
    const res = await report(id);
    await prisma.location.update({ where: { id: locA }, data: { openTime: '00:00', closeTime: '23:59' } });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('BIKE_MISSING_CLOSED');
    expect(await prisma.bookingIncident.count({ where: { bookingId: id } })).toBe(0);
  });

  it('после ответа «байк на месте» повторное сообщение не открывает возврат: решает администратор', async () => {
    const id = await paidBooking();
    await report(id);
    await http().post(`/api/manager/bookings/${id}/incident/dismiss`).set(miniapp.manager!).expect(200);
    await report(id).expect(200);
    const row = await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: id, status: 'OPEN' } });
    expect(row.disputed).toBe(true);
    expect((await clientBooking(id)).incident).toMatchObject({ disputed: true, cancelFreeAt: null });
    await prisma.bookingIncident.update({ where: { id: row.id }, data: { clientReportedAt: new Date(Date.now() - 60 * 60_000) } });
    expect((await http().post(`/api/bookings/${id}/bike-missing/cancel`).set(miniapp.client!)).body.code).toBe('INCIDENT_WAIT');
    // Администратор может решить в пользу клиента
    expect((await http().post(`/api/admin/bookings/${id}/incident/cancel`).set({ ...auth.admin!, ...MUT })).status).toBe(200);
    expect((await refunds(id)).map((r) => r.amount)).toEqual([DAY + 1_000_000]);
  });
});

describe('тестовая оплата в открытом запуске', () => {
  const pay = async (who: Record<string, string>) => {
    const b = await paidBooking();
    const created = await prisma.payment.create({ data: { bookingId: b, kind: 'RENT', method: 'VIETQR', provider: 'test', amount: 5, status: 'PENDING', externalId: `t-${b}` } });
    return http().post(`/api/dev/payments/${created.id}/pay`).set(who).send({});
  };

  it('клиенту закрыта; тестеру из списка открыта', async () => {
    process.env.RESTRICT_TEST_PAYMENTS = '1';
    const denied = await pay(miniapp.client!);
    expect(denied.status).toBe(403);
    expect(denied.body.code).toBe('TEST_PAYMENT_RESTRICTED');
    process.env.TEST_PAY_TELEGRAM_IDS = String(TG.client);
    expect((await pay(miniapp.client!)).status).not.toBe(403);
    delete process.env.RESTRICT_TEST_PAYMENTS;
    delete process.env.TEST_PAY_TELEGRAM_IDS;
  });
});

describe('байка нет на месте: замена', () => {
  const m = (id: string, path: string) => http().post(`/api/manager/bookings/${id}/incident${path}`).set(miniapp.manager!);
  const detail = async (id: string) => (await http().get(`/api/manager/bookings/${id}`).set(miniapp.manager!)).body as ManagerBookingDetail;

  it('в списке замены только свободные байки, которые клиенту разрешено водить', async () => {
    const id = await paidBooking();
    await report(id);
    const d = await detail(id);
    expect(d.incident?.source).toBe('CLIENT');
    expect(d.card.incidentOpen).toBe(true);
    const ids = d.replacements.map((r) => r.bikeId);
    expect(ids).toEqual(expect.arrayContaining([cheapBike, dearBike, bigBike]));
    // Без прав замена — только до 50 см³
    await prisma.user.update({ where: { id: clientId }, data: { licenseCategory: 'NONE' } });
    expect((await detail(id)).replacements.map((r) => r.bikeId)).toEqual([]);
    await prisma.user.update({ where: { id: clientId }, data: { licenseCategory: null } });
    expect(d.freeBikes.map((b) => b.id)).toContain(visionBikes[1]);
  });

  it('модель дешевле: разница уходит к возврату, цена брони снижается, модель меняется', async () => {
    const id = await paidBooking();
    await report(id);
    expect((await m(id, '/propose').send({ bikeId: cheapBike })).status).toBe(200);
    const offered = await clientBooking(id);
    expect(offered.incident?.proposal).toMatchObject({ modelName: 'Cheap', refund: DAY - 150_000 });
    const res = await http().post(`/api/bookings/${id}/bike-missing/accept`).set(miniapp.client!);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row).toMatchObject({ modelId: cheapId, bikeId: cheapBike, rentAmount: 150_000, totalAmount: 150_000, status: 'CONFIRMED' });
    expect((await refunds(id)).map((r) => r.amount)).toEqual([DAY - 150_000]);
    expect((await clientBooking(id)).incident).toBeNull();
    await prisma.booking.delete({ where: { id } });
  });

  it('модель дороже: клиент не доплачивает', async () => {
    const id = await paidBooking();
    await report(id);
    await m(id, '/propose').send({ bikeId: dearBike }).expect(200);
    await http().post(`/api/bookings/${id}/bike-missing/accept`).set(miniapp.client!).expect(200);
    expect(await prisma.booking.findUniqueOrThrow({ where: { id } })).toMatchObject({ modelId: dearId, bikeId: dearBike, rentAmount: DAY, totalAmount: DAY });
    expect(await refunds(id)).toEqual([]);
    await prisma.booking.delete({ where: { id } });
  });

  it('предложение не подошло: клиент отменяет с полным возвратом сразу', async () => {
    const id = await paidBooking();
    await report(id);
    await m(id, '/propose').send({ bikeId: cheapBike }).expect(200);
    const res = await http().post(`/api/bookings/${id}/bike-missing/cancel`).set(miniapp.client!);
    expect(res.body).toMatchObject({ cancelReason: 'BIKE_MISSING', refundAmount: DAY + 1_000_000 });
  });

  it('занятый байк предложить нельзя; другой байк той же модели в акте закрывает случай', async () => {
    const id = await paidBooking();
    await report(id);
    expect((await m(id, '/propose').send({ bikeId: visionBikes[1] })).body.code).toBe('REPLACEMENT_UNAVAILABLE');
    const keys = await Promise.all([0, 1, 2, 3].map(async () => {
      const up = await http().post(`/api/manager/bookings/${id}/photos`).set(miniapp.manager!).send({ contentType: 'image/jpeg' });
      await http().put(new URL(up.body.uploadUrl as string).pathname + new URL(up.body.uploadUrl as string).search).set(up.body.headers as Record<string, string>).send(Buffer.from('x'));
      return up.body.key as string;
    }));
    const act = await http().post(`/api/manager/bookings/${id}/handover`).set(miniapp.manager!).send({ bikeId: visionBikes[1], mileageKm: 10, fuelLevel: 50, photos: keys });
    expect(act.status, JSON.stringify(act.body)).toBe(201);
    expect(await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: id } })).toMatchObject({ status: 'RESOLVED', resolution: 'SAME_MODEL' });
    await prisma.booking.delete({ where: { id } });
  });

  it('«байк на месте» закрывает случай без возврата; чужой владелец решать не может', async () => {
    const id = await paidBooking();
    await report(id);
    expect((await http().post(`/api/manager/bookings/${id}/incident/dismiss`).set(miniapp.ownerB!)).status).toBe(403);
    expect((await http().post(`/api/admin/bookings/${id}/incident/cancel`).set({ ...auth.ownerB!, ...MUT })).status).toBe(404);
    await m(id, '/dismiss').expect(200);
    expect(await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: id } })).toMatchObject({ resolution: 'BIKE_PRESENT' });
    expect(await refunds(id)).toEqual([]);
    expect((await clientBooking(id)).status).toBe('CONFIRMED');
  });

  it('сотрудник отменяет сразу: полный возврат', async () => {
    const id = await paidBooking();
    await m(id, '').send({}).expect(200);
    expect((await clientBooking(id)).incident).toBeNull();
    const res = await http().post(`/api/admin/bookings/${id}/incident/cancel`).set({ ...auth.ownerA!, ...MUT });
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    expect((await refunds(id)).map((r) => r.amount)).toEqual([DAY + 1_000_000]);
  });
});

describe('предыдущий клиент не вернул байк', () => {
  async function overdueThenNext() {
    await prisma.booking.deleteMany({ where: { modelId: visionId } });
    const end = new Date(Date.now() - 2 * H);
    const late = await createBooking(prisma, { userId: clientId, modelId: visionId, locationId: locA, bikeId: visionBikes[0]!, startAt: new Date(end.getTime() - 24 * H), endAt: end, status: 'ISSUED' });
    const start = new Date(Date.now() + 3 * H);
    const next = await createBooking(prisma, { userId: clientId, modelId: visionId, locationId: locA, bikeId: visionBikes[0]!, startAt: start, endAt: new Date(start.getTime() + 24 * H), status: 'CONFIRMED' });
    return { late, next };
  }

  it('следующая бронь сама переходит на свободный байк той же модели', async () => {
    const { late, next } = await overdueThenNext();
    await app.get(IncidentsService).handleOverdue(late.id);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id: next.id } })).bikeId).toBe(visionBikes[1]);
    expect(await prisma.bookingIncident.count({ where: { bookingId: next.id } })).toBe(0);
  });

  it('свободного нет: сотрудники узнают заранее, клиента случай пока не пугает', async () => {
    const { late, next } = await overdueThenNext();
    await prisma.bike.update({ where: { id: visionBikes[1] }, data: { status: 'REPAIR' } });
    await app.get(IncidentsService).handleOverdue(late.id);
    await prisma.bike.update({ where: { id: visionBikes[1] }, data: { status: 'ACTIVE' } });
    expect(await prisma.bookingIncident.findFirstOrThrow({ where: { bookingId: next.id } })).toMatchObject({ source: 'SYSTEM', status: 'OPEN' });
    await new Promise((r) => setTimeout(r, 50));
    expect(app.get<LogNotifier>(NOTIFIER).sent.some((s) => s.key === 'bot.manager.bikeNotReturned')).toBe(true);
    expect((await clientBooking(next.id)).incident).toBeNull();
    await prisma.booking.deleteMany({ where: { modelId: visionId } });
  });
});

describe('фото обязательны', () => {
  it('ключи без загруженных файлов не принимаются', async () => {
    const id = await paidBooking();
    const photos = [0, 1, 2, 3].map((i) => `acts/${id}/fake${i}`);
    const res = await http().post(`/api/manager/bookings/${id}/handover`).set(miniapp.manager!).send({ bikeId: visionBikes[0], mileageKm: 1, fuelLevel: 50, photos });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('PHOTO_NOT_UPLOADED');
    expect(await app.get<Storage>(STORAGE).exists(photos[0]!)).toBe(false);
  });

  it('выдать бронь статусом в обход акта нельзя', async () => {
    const id = await paidBooking();
    const d = (await http().get(`/api/admin/bookings/${id}`).set(auth.admin!)).body as AdminBookingDetail;
    expect(d.nextStatuses).not.toContain('ISSUED');
    const res = await http().patch(`/api/admin/bookings/${id}`).set({ ...auth.admin!, ...MUT }).send({ status: 'ISSUED' });
    expect(res.status).toBe(409);
    expect((await prisma.booking.findUniqueOrThrow({ where: { id } })).status).toBe('CONFIRMED');
  });

  it('архив: у владельца только своя точка, у администратора все или выбранная', async () => {
    const id = await paidBooking();
    await prisma.handoverAct.create({ data: { bookingId: id, bikeId: visionBikes[0]!, kind: 'ISSUE', mileageKm: 5, fuelLevel: 50, photos: [`acts/${id}/a`], managerId: (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(TG.manager) } })).id } });
    const own = (await http().get('/api/admin/acts').set(auth.ownerA!)).body as AdminActArchive;
    expect(own.items.find((r) => r.bookingId === id)?.before?.photoCount).toBe(1);
    expect(own.items.find((r) => r.bookingId === id)?.after).toBeNull();
    expect(((await http().get('/api/admin/acts').set(auth.ownerB!)).body as AdminActArchive).total).toBe(0);
    expect(((await http().get('/api/admin/acts').set(auth.admin!).set(ADMIN_LOCATION_HEADER, locB)).body as AdminActArchive).total).toBe(0);
    expect(((await http().get('/api/admin/acts').set(auth.admin!)).body as AdminActArchive).total).toBeGreaterThan(0);
    expect((await http().get(`/api/admin/bookings/${id}/acts/x/photos`).set(auth.ownerB!)).status).toBe(404);
    await prisma.handoverAct.deleteMany({ where: { bookingId: id } });
  });
});

describe('договор и лимиты', () => {
  it('договор видят клиент и сотрудники точки брони, чужой владелец — нет', async () => {
    const id = await paidBooking();
    expect((await http().get(`/api/bookings/${id}/contract`).set(miniapp.client!)).status).toBe(200);
    expect((await http().get(`/api/bookings/${id}/contract`).set(miniapp.manager!)).status).toBe(200);
    expect((await http().get(`/api/bookings/${id}/contract`).set(miniapp.ownerB!)).status).toBe(404);
    expect((await http().post(`/api/bookings/${id}/file-link`).set(miniapp.ownerB!).send({ file: 'contract' })).status).toBe(404);
    expect((await http().post(`/api/bookings/${id}/file-link`).set(miniapp.manager!).send({ file: 'contract' })).status).toBe(200);
    expect(await prisma.auditLog.count({ where: { action: 'contract.read', entityId: id } })).toBeGreaterThan(0);
  });

  it('документов не больше 10; брошенные загрузки освобождают место', async () => {
    const tg = 9290;
    const who = await bearer(tg);
    const uid = (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tg) } })).id;
    app.get(RateLimiter).reset();
    const create = () => http().post('/api/documents').set(who).send({ type: 'PASSPORT', contentType: 'image/jpeg', consent: true });
    for (let i = 0; i < 10; i++) expect((await create()).status).toBe(201);
    app.get(RateLimiter).reset();
    // Только что созданные ссылки ещё действуют: место не освобождается
    const limited = await create();
    expect(limited.status).toBe(409);
    expect(limited.body.code).toBe('DOCUMENT_LIMIT');
    await prisma.document.updateMany({ where: { userId: uid }, data: { createdAt: new Date(Date.now() - H) } });
    expect((await create()).status).toBe(201);
    expect(await prisma.document.count({ where: { userId: uid } })).toBe(1);
  });

  it('создавать документы быстрее 10 в минуту нельзя', async () => {
    const who = await bearer(9291);
    app.get(RateLimiter).reset();
    let limited = 0;
    for (let i = 0; i < 11; i++) if ((await http().post('/api/documents').set(who).send({ type: 'PASSPORT', contentType: 'image/jpeg', consent: true })).status === 429) limited++;
    expect(limited).toBe(1);
  });

  it('один аккаунт не может удержать весь парк', async () => {
    const tg = 9292;
    const who = await bearer(tg);
    const uid = (await prisma.user.findUniqueOrThrow({ where: { telegramId: String(tg) } })).id;
    const bike = await prisma.bike.findFirstOrThrow({ where: { modelId: otherId } });
    const make = async (status: 'PENDING_PAYMENT' | 'CONFIRMED', n: number) => {
      for (let i = 0; i < n; i++) {
        const s = new Date(Date.now() + (200 + 100 * plus++) * 24 * H);
        await createBooking(prisma, { userId: uid, modelId: otherId, locationId: locB, bikeId: bike.id, startAt: s, endAt: new Date(s.getTime() + 24 * H), status });
      }
    };
    let plus = 0;
    const start = new Date(Date.UTC(new Date().getUTCFullYear() + 3, 0, 15, 3));
    const attempt = () => http().post('/api/bookings').set(who).send({ modelId: cheapId, startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString(), paymentMethod: 'VIETQR', phone: '+84901234567', agreed: true });
    await make('PENDING_PAYMENT', 3);
    expect((await attempt()).body.code).toBe('TOO_MANY_BOOKINGS');
    await prisma.booking.updateMany({ where: { userId: uid }, data: { status: 'CONFIRMED' } });
    await make('CONFIRMED', 2);
    expect((await attempt()).body.code).toBe('TOO_MANY_BOOKINGS');
    await prisma.booking.deleteMany({ where: { userId: uid } });
    app.get(RateLimiter).reset();
    const ok = await attempt();
    expect(ok.status, JSON.stringify(ok.body)).toBe(201);
    await prisma.booking.deleteMany({ where: { userId: uid } });
  });
});

describe('контроль владельцев', () => {
  it('сводка только у администратора', async () => {
    expect((await http().get('/api/admin/supervision').set(auth.ownerA!)).status).toBe(403);
    const id = await paidBooking();
    await report(id);
    const res = await http().get('/api/admin/supervision').set(auth.admin!);
    expect(res.status, JSON.stringify(res.body)).toBe(200);
    const d = res.body as AdminSupervision;
    const a = d.points.find((p) => p.locationId === locA)!;
    expect(a.owners).toEqual(['S']);
    expect(a.openIncidents).toBe(1);
    expect(a.bikes).toBeGreaterThan(0);
    expect(d.openIncidents.map((i) => i.bookingId)).toEqual([id]);
  });

  it('выдача без фотоакта видна как нарушение', async () => {
    await prisma.booking.deleteMany({ where: { modelId: otherId } });
    const bike = await prisma.bike.findFirstOrThrow({ where: { modelId: otherId } });
    const start = new Date(Date.now() - 2 * H);
    const b = await createBooking(prisma, { userId: clientId, modelId: otherId, locationId: locB, bikeId: bike.id, startAt: start, endAt: new Date(start.getTime() + 24 * H), status: 'ISSUED' });
    await prisma.booking.update({ where: { id: b.id }, data: { actualStartAt: start } });
    const d = (await http().get('/api/admin/supervision').set(auth.admin!)).body as AdminSupervision;
    expect(d.points.find((p) => p.locationId === locB)!.withoutPhotoAct).toBe(1);
    await prisma.booking.delete({ where: { id: b.id } });
  });

  it('журнал по выбранной точке показывает только её сотрудников', async () => {
    await http().patch(`/api/admin/locations/${locB}`).set({ ...auth.ownerB!, ...MUT }).send({ contact: '@b' }).expect(200);
    const rows = (await http().get('/api/admin/audit').set(auth.admin!).set(ADMIN_LOCATION_HEADER, locA)).body.items as { action: string }[];
    expect(rows.map((r) => r.action)).not.toContain('location.update');
    const b = (await http().get('/api/admin/audit').set(auth.admin!).set(ADMIN_LOCATION_HEADER, locB)).body.items as { action: string }[];
    expect(b.map((r) => r.action)).toContain('location.update');
  });

  it('владелец сменил счёт оплаты: администратор получает сообщение', async () => {
    process.env.PAYMENT_KEYS_SECRET = 'x';
    process.env.API_PUBLIC_URL = 'http://localhost';
    await http().put(`/api/admin/locations/${locB}/payos`).set({ ...auth.ownerB!, ...MUT }).send({ clientId: 'c', apiKey: 'k', checksumKey: 's' }).expect(200);
    const sent = app.get<LogNotifier>(NOTIFIER).sent.filter((s) => s.key === 'bot.admin.payosChanged');
    expect(sent.map((s) => s.telegramId)).toEqual([String(TG.admin)]);
    await prisma.location.update({ where: { id: locB }, data: { payosClientId: null, payosApiKey: null, payosChecksumKey: null } });
  });
});
