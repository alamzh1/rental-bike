import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AdminDocumentList, AdminListOf, AdminRubTransferRow, AuthResponse, Booking, CreateDocumentResponse, PayBookingResponse } from '@rental/shared';
import { AuthService } from '../../src/auth/auth.service';
import { BookingsService } from '../../src/bookings/bookings.service';
import { RateLimiter } from '../../src/bookings/rate-limit';
import { NOTIFIER, type LogNotifier } from '../../src/notifications/notifier';
import { createApp, createLocation, createModel, createSettings, resetDb, signInitData, TEST_BOT_TOKEN } from './support/catalog-fixture';

// Фото паспорта и прав обязательны до брони; язык, выбранный в админке, идёт в сообщения бота.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const envBackup = { ...process.env };
const H = 3_600_000;
const MUT = { 'x-admin-request': '1' };
const ADMIN_TG = 9601;
let app: INestApplication;
let modelId = '';
let mopedId = '';
let electricId = '';
let locationId = '';
let client: Record<string, string>;
let clientId = '';
let nextDay = 10;
const http = () => request(app.getHttpServer());

const pathOf = (url: string) => {
  const u = new URL(url);
  return `${u.pathname}${u.search}`;
};

/** Запись документа; с `file` — как в приложении, вместе с самим файлом. */
async function addDocument(type: 'PASSPORT' | 'LICENSE' | 'IDP', file = true): Promise<string> {
  const res = await http().post('/api/documents').set(client).send({ type, contentType: 'image/png', consent: true });
  expect(res.status, JSON.stringify(res.body)).toBe(201);
  const slot = res.body as CreateDocumentResponse;
  if (file) expect((await http().put(pathOf(slot.uploadUrl)).set(slot.headers).send(Buffer.from('photo'))).status).toBe(200);
  return slot.documentId;
}

function book(paymentMethod = 'VIETQR', model = modelId) {
  const start = new Date(Date.UTC(new Date().getUTCFullYear() + 3, 0, nextDay++, 3));
  return http().post('/api/bookings').set(client).send({ modelId: model, startAt: start.toISOString(), endAt: new Date(start.getTime() + 24 * H).toISOString(), paymentMethod, phone: '+84901234567', agreed: true });
}

async function staff(telegramId: number): Promise<Record<string, string>> {
  const res = await http().post('/api/admin/auth/webapp').set(MUT).send({ initData: signInitData({ id: telegramId, first_name: 'S', language_code: 'en' }) });
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  return { Authorization: `Bearer ${(res.body as { token: string }).token}`, ...MUT };
}

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TEST_BOT_TOKEN;
  process.env.ADMIN_TELEGRAM_IDS = String(ADMIN_TG);
  process.env.NODE_ENV = 'test';
  await resetDb(prisma);
  await createSettings(prisma, { requireDocuments: true });
  const location = await createLocation(prisma);
  modelId = (await createModel(prisma, location.id, { key: 'vision', name: 'Vision', brand: 'Honda', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, features: [], rating: 4.5, popularity: 1, prices: [100_000, 90_000, 80_000, 70_000], bikes: [{}, {}, {}] })).model.id;
  const spec = { brand: 'Honda', category: 'SCOOTER' as const, transmission: 'AUTOMATIC' as const, features: [], rating: 4.5, popularity: 1, prices: [100_000, 90_000, 80_000, 70_000] as [number, number, number, number], bikes: [{}, {}, {}] };
  mopedId = (await createModel(prisma, location.id, { ...spec, key: 'moped', name: 'Cub 50', engineCc: 50 })).model.id;
  electricId = (await createModel(prisma, location.id, { ...spec, key: 'evo', name: 'Evo', engineCc: null })).model.id;
  locationId = location.id;
  app = await createApp();
  const res = await http().post('/api/auth/telegram').send({ initData: signInitData({ id: 9600, first_name: 'C', language_code: 'ru' }) });
  client = { Authorization: `Bearer ${(res.body as AuthResponse).token}` };
  clientId = (res.body as AuthResponse).user.id;
});

afterAll(async () => {
  await app.close();
  await prisma.$disconnect();
  process.env = envBackup;
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { userId: clientId } });
  await prisma.document.deleteMany({ where: { userId: clientId } });
  await prisma.user.update({ where: { id: clientId }, data: { licenseCategory: null } });
  app.get(RateLimiter).reset();
});

describe('фото документов до брони', () => {
  it('без документов бронь не создаётся', async () => {
    const res = await book();
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('DOCUMENTS_REQUIRED');
    expect(await prisma.booking.count({ where: { userId: clientId } })).toBe(0);
  });

  it('одного паспорта мало; с правами бронь создаётся', async () => {
    await addDocument('PASSPORT');
    expect((await book()).body.code).toBe('DOCUMENTS_REQUIRED');
    await addDocument('LICENSE');
    expect((await book()).status).toBe(201);
  });

  it('международное удостоверение заменяет права', async () => {
    await addDocument('PASSPORT');
    await addDocument('IDP');
    expect((await book()).status).toBe(201);
  });

  it('категория «Нет прав»: хватает паспорта', async () => {
    await http().patch('/api/me').set(client).send({ licenseCategory: 'NONE' });
    await addDocument('PASSPORT');
    expect((await book('VIETQR', mopedId)).status).toBe(201);
  });

  it('запись без файла не считается и не видна в списке', async () => {
    await addDocument('PASSPORT');
    await addDocument('LICENSE', false);
    expect((await book()).body.code).toBe('DOCUMENTS_REQUIRED');
    const list = await http().get('/api/documents').set(client);
    expect((list.body.items as { type: string }[]).map((d) => d.type)).toEqual(['PASSPORT']);
  });

  it('отклонённый документ не считается, новое фото закрывает его', async () => {
    await addDocument('PASSPORT');
    const license = await addDocument('LICENSE');
    await prisma.document.update({ where: { id: license }, data: { status: 'REJECTED' } });
    expect((await book()).body.code).toBe('DOCUMENTS_REQUIRED');
    await addDocument('LICENSE');
    expect((await book()).status).toBe(201);
  });
});

describe('язык, выбранный в админке', () => {
  async function session(): Promise<Record<string, string>> {
    const res = await http().post('/api/admin/auth/webapp').set(MUT).send({ initData: signInitData({ id: ADMIN_TG, first_name: 'A', language_code: 'en' }) });
    expect(res.status).toBe(200);
    return { Authorization: `Bearer ${(res.body as { token: string }).token}`, ...MUT };
  }

  it('сохраняется для бота и один раз сообщает о смене', async () => {
    const who = await session();
    const listener = vi.fn();
    app.get(AuthService).onLangChanged(listener);
    await prisma.user.update({ where: { telegramId: String(ADMIN_TG) }, data: { lang: 'ru' } });
    expect((await http().post('/api/admin/auth/lang').set(who).send({ lang: 'vi' })).status).toBe(204);
    const user = await prisma.user.findUniqueOrThrow({ where: { telegramId: String(ADMIN_TG) } });
    expect(user.lang).toBe('vi');
    expect(user.langChosenAt).not.toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
    // Тот же язык: кнопки в чате уже верные, лишнего сообщения нет
    expect((await http().post('/api/admin/auth/lang').set(who).send({ lang: 'vi' })).status).toBe(204);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('неверный язык и запрос без сессии отклоняются', async () => {
    const who = await session();
    expect((await http().post('/api/admin/auth/lang').set(who).send({ lang: 'de' })).status).toBe(400);
    expect((await http().post('/api/admin/auth/lang').set(MUT).send({ lang: 'vi' })).status).toBe(401);
  });
});

describe('без прав — только до 50 см³', () => {
  beforeEach(async () => {
    await http().patch('/api/me').set(client).send({ licenseCategory: 'NONE' });
    await addDocument('PASSPORT');
  });

  it('байк 125 см³ и электробайк недоступны, 50 см³ доступен', async () => {
    for (const m of [modelId, electricId]) {
      const res = await book('VIETQR', m);
      expect(res.status).toBe(409);
      expect(res.body.code).toBe('LICENSE_REQUIRED');
    }
    expect((await book('VIETQR', mopedId)).status).toBe(201);
  });

  it('с правами любой байк, в том числе категории A при правах A1', async () => {
    await prisma.bikeModel.update({ where: { id: modelId }, data: { licenseRequired: 'A', engineCc: 160 } });
    await http().patch('/api/me').set(client).send({ licenseCategory: 'A1' });
    await addDocument('LICENSE');
    expect((await book()).status).toBe(201);
    await prisma.bikeModel.update({ where: { id: modelId }, data: { licenseRequired: 'A1', engineCc: 125 } });
  });
});

describe('документы проверяет администратор', () => {
  it('очередь и решение — только у администратора; отклонение закрывает бронь до нового фото', async () => {
    const admin = await staff(ADMIN_TG);
    await addDocument('PASSPORT');
    const license = await addDocument('LICENSE');
    await prisma.user.create({ data: { telegramId: '9610', role: 'OWNER', locationId } });
    await prisma.user.create({ data: { telegramId: '9611', role: 'MANAGER', locationId } });
    for (const tg of [9610, 9611]) {
      const who = await staff(tg);
      expect((await http().get('/api/admin/documents').set(who)).status).toBe(403);
      expect((await http().post(`/api/admin/documents/${license}/verify`).set(who).send({ status: 'VERIFIED' })).status).toBe(403);
    }
    const list = await http().get('/api/admin/documents').set(admin);
    expect((list.body as AdminDocumentList).items.map((d) => d.id)).toContain(license);
    const res = await http().post(`/api/admin/documents/${license}/verify`).set(admin).send({ status: 'REJECTED', rejectReason: 'не читается' });
    expect(res.status).toBe(200);
    const sent = app.get<LogNotifier>(NOTIFIER).sent.at(-1)!;
    expect(sent.key).toBe('bot.client.documentRejectedReason');
    expect(sent.text).toContain('не читается');
    expect((await book()).body.code).toBe('DOCUMENTS_REQUIRED');
    await prisma.user.deleteMany({ where: { telegramId: { in: ['9610', '9611'] } } });
  });
});

describe('перевод в рублях', () => {
  const RATE = 0.0035;
  const enable = async (updatedAt = new Date().toISOString()) => {
    await createSettings(prisma, { requireDocuments: false, rubTransfer: { phone: '+79001234567', bank: 'Тестбанк', recipient: 'Иван И.', markupPercent: 2 }, rates: { RUB: RATE, USD: 0.00004, updatedAt } });
  };
  const disable = () => prisma.setting.deleteMany({ where: { key: 'rubTransfer' } });
  const created = async () => {
    const res = await book('RUB_TRANSFER');
    expect(res.status, JSON.stringify(res.body)).toBe(201);
    const pay = await http().post(`/api/bookings/${res.body.id}/pay`).set(client);
    expect(pay.status, JSON.stringify(pay.body)).toBe(200);
    return { id: res.body.id as string, pay: pay.body as PayBookingResponse };
  };
  const statusOf = async (id: string) => ((await http().get(`/api/bookings/${id}`).set(client)).body as Booking).status;

  it('без реквизитов и при устаревшем курсе способ недоступен', async () => {
    await enable();
    await disable();
    expect((await book('RUB_TRANSFER')).body.code).toBe('PAYMENT_NOT_AVAILABLE');
    expect(((await http().get('/api/settings/public')).body as { rubTransfer: unknown }).rubTransfer).toBeNull();
    await enable(new Date(Date.now() - 10 * 24 * H).toISOString());
    expect((await book('RUB_TRANSFER')).body.code).toBe('PAYMENT_NOT_AVAILABLE');
  });

  it('сумма в рублях с наценкой зафиксирована, реквизиты получает клиент брони', async () => {
    await enable();
    const { id, pay } = await created();
    expect(pay.rub?.phone).toBe('+79001234567');
    expect(pay.rub?.amount).toBe(Math.ceil(pay.amount * (RATE * (1 + 2 / 100))));
    await createSettings(prisma, { rates: { RUB: RATE * 2, USD: 0.00004, updatedAt: new Date().toISOString() } });
    const again = await http().post(`/api/bookings/${id}/pay`).set(client);
    expect((again.body as PayBookingResponse).rub?.amount).toBe(pay.rub?.amount);
    expect(((await http().get('/api/settings/public')).body as { rubTransfer: { rubPerVnd: number } }).rubTransfer.rubPerVnd).toBeCloseTo(RATE * 2 * 1.02);
  });

  it('в перевод входит только аренда: клиент узнаёт о депозите наличными, в чеке депозита нет', async () => {
    await enable();
    const { id, pay } = await created();
    const b = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(b.depositAmount).toBe(1_000_000);
    expect(pay.amount).toBe(b.totalAmount);
    expect(pay.rub?.depositCash).toBe(1_000_000);
    await http().post(`/api/bookings/${id}/pay/claim`).set(client);
    const admin = await staff(ADMIN_TG);
    await http().post(`/api/admin/payments/${pay.paymentId}/rub-confirm`).set(admin);
    expect(await statusOf(id)).toBe('CONFIRMED');
    const notifier = app.get<LogNotifier>(NOTIFIER);
    await vi.waitFor(() => expect(notifier.sent.some((m) => m.key === 'bot.client.confirmedDepositCash')).toBe(true));
    const receipt = notifier.sent.filter((m) => m.key === 'bot.client.receipt').at(-1)!;
    expect(receipt.text).not.toContain('Депозит');
  });

  it('«Я перевёл» продлевает удержание и пишет администратору, деньги считает только его подтверждение', async () => {
    await enable();
    const { id, pay } = await created();
    const notifier = app.get<LogNotifier>(NOTIFIER);
    const res = await http().post(`/api/bookings/${id}/pay/claim`).set(client);
    expect(res.status).toBe(200);
    expect((res.body as PayBookingResponse).rub?.claimedAt).not.toBeNull();
    expect(new Date((res.body as PayBookingResponse).expiresAt).getTime() - Date.now()).toBeGreaterThan(5 * H);
    await vi.waitFor(() => expect(notifier.sent.some((m) => m.key === 'bot.admin.rubTransferClaimed' && m.telegramId === String(ADMIN_TG))).toBe(true));
    expect(await statusOf(id)).toBe('PENDING_PAYMENT');

    await prisma.user.create({ data: { telegramId: '9612', role: 'OWNER', locationId } });
    const owner = await staff(9612);
    expect((await http().post(`/api/admin/payments/${pay.paymentId}/rub-confirm`).set(owner)).status).toBe(403);
    await prisma.user.delete({ where: { telegramId: '9612' } });

    const admin = await staff(ADMIN_TG);
    const list = (await http().get('/api/admin/payments/rub-transfers').set(admin)).body as AdminListOf<AdminRubTransferRow>;
    expect(list.items.map((r) => r.paymentId)).toContain(pay.paymentId);
    expect((await http().post(`/api/admin/payments/${pay.paymentId}/rub-confirm`).set(admin)).status).toBe(204);
    expect(await statusOf(id)).toBe('CONFIRMED');
    const row = await prisma.payment.findUniqueOrThrow({ where: { id: pay.paymentId } });
    expect([row.status, row.receivedAmount, row.amount]).toEqual(['PAID', pay.amount, pay.amount]);
    expect((await http().post(`/api/admin/payments/${pay.paymentId}/rub-confirm`).set(admin)).status).toBe(404);
  });

  it('перевода нет: отметка снимается, клиент получает сообщение и может нажать снова', async () => {
    await enable();
    const { id, pay } = await created();
    await http().post(`/api/bookings/${id}/pay/claim`).set(client);
    const admin = await staff(ADMIN_TG);
    expect((await http().post(`/api/admin/payments/${pay.paymentId}/rub-reject`).set(admin)).status).toBe(204);
    expect(await statusOf(id)).toBe('PENDING_PAYMENT');
    const again = (await http().post(`/api/bookings/${id}/pay`).set(client)).body as PayBookingResponse;
    expect(again.rub?.claimedAt).toBeNull();
    await vi.waitFor(() => expect(app.get<LogNotifier>(NOTIFIER).sent.some((m) => m.key === 'bot.client.rubTransferNotFound')).toBe(true));
  });

  it('бронь отменилась, а деньги пришли: подтверждение создаёт возврат', async () => {
    await enable();
    const { id, pay } = await created();
    await http().post(`/api/bookings/${id}/pay/claim`).set(client);
    await prisma.booking.update({ where: { id }, data: { holdExpiresAt: new Date(Date.now() - 1000) } });
    await app.get(BookingsService).expireHold(id);
    const admin = await staff(ADMIN_TG);
    expect((await http().post(`/api/admin/payments/${pay.paymentId}/rub-confirm`).set(admin)).status).toBe(204);
    const refund = await prisma.payment.findFirstOrThrow({ where: { bookingId: id, kind: 'REFUND' } });
    expect([refund.status, refund.amount]).toEqual(['PENDING', pay.amount]);
  });
});
