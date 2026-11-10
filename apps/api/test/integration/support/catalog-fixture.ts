import { createHmac } from 'node:crypto';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import type { BikeStatus, BookingStatus, ModelCategory, PrismaClient, Transmission } from '@prisma/client';
import { AppModule } from '../../../src/app.module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { configureApp } from '../../../src/app.setup';
import { applyTrustProxy } from '../../../src/auth/trust-proxy';

// Фикстура каталога для интеграционных тестов (таск 04). Тестовый токен бота — не секрет.
export const TEST_BOT_TOKEN = '123456:test-bot-token';
export const TZ = 'Asia/Ho_Chi_Minh';

export async function createApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const nest = moduleRef.createNestApplication<NestExpressApplication>();
  applyTrustProxy(nest);
  const app = configureApp(nest);
  await app.init();
  return app;
}

export async function resetDb(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE users, locations, brands, bike_models, bikes, bookings, tariffs, season_rules, extras, settings, banners, favorites, analytics_events, i18n_overrides CASCADE',
  );
}

/** initData, подписанный по алгоритму Telegram тестовым токеном. */
export function signInitData(user: Record<string, unknown>, authDate = Math.floor(Date.now() / 1000), token = TEST_BOT_TOKEN): string {
  const fields: Record<string, string> = { auth_date: String(authDate), query_id: 'AAH-test', user: JSON.stringify(user) };
  const dcs = Object.keys(fields)
    .sort()
    .map((k) => `${k}=${fields[k]}`)
    .join('\n');
  const secret = createHmac('sha256', 'WebAppData').update(token).digest();
  const hash = createHmac('sha256', secret).update(dcs).digest('hex');
  return new URLSearchParams({ ...fields, hash }).toString();
}

export interface ModelSpec {
  key: string;
  brand: string;
  name: string;
  category: ModelCategory;
  transmission: Transmission;
  engineCc: number | null;
  features: string[];
  prices: [number, number, number, number];
  rating: number;
  popularity: number;
  licenseRequired?: 'A1' | 'A';
  deposit?: number;
  isActive?: boolean;
  bikes: { status?: BikeStatus; readyAt?: Date }[];
}

export const BRACKETS: [number, number | null][] = [[1, 2], [3, 6], [7, 29], [30, null]];

export async function createLocation(prisma: PrismaClient) {
  return prisma.location.create({
    data: { name: { ru: 'Точка', en: 'Point', vi: 'Điểm' }, address: '4c Nguyễn Huệ', lat: 13.77, lng: 109.22, timezone: TZ },
  });
}

export async function createModel(prisma: PrismaClient, locationId: string, m: ModelSpec, sortOrder = 0) {
  const brand = await prisma.brand.upsert({ where: { name: m.brand }, create: { name: m.brand, sortOrder }, update: {} });
  const model = await prisma.bikeModel.create({
    data: {
      locationId,
      brandId: brand.id,
      name: m.name,
      slug: `${m.key}-${Math.random().toString(36).slice(2, 8)}`,
      category: m.category,
      transmission: m.transmission,
      engineCc: m.engineCc,
      year: 2024,
      description: { en: `${m.name} description` },
      photos: [{ key: `models/${m.key}/1`, sizes: { '400': { webp: `models/${m.key}/1-400.webp`, avif: `models/${m.key}/1-400.avif` }, '800': { webp: `models/${m.key}/1-800.webp` } } }],
      fuelConsumption: 2,
      tankLiters: 5,
      maxSpeedKmh: 100,
      seats: 2,
      features: m.features,
      included: [{ en: '2 helmets' }],
      conditions: { en: 'Passport or deposit' },
      licenseRequired: m.licenseRequired ?? 'A1',
      deposit: m.deposit ?? 1_000_000,
      rating: m.rating,
      popularity: m.popularity,
      isActive: m.isActive ?? true,
      tariffs: { create: BRACKETS.map(([minDays, maxDays], i) => ({ minDays, maxDays, pricePerDay: m.prices[i]! })) },
    },
  });
  const bikes = [];
  for (const [i, b] of m.bikes.entries()) {
    bikes.push(
      await prisma.bike.create({
        data: { modelId: model.id, locationId, plate: `${m.key}-${i}-${Math.random().toString(36).slice(2, 8)}`, status: b.status ?? 'ACTIVE', readyAt: b.readyAt ?? null },
      }),
    );
  }
  return { model, bikes };
}

let seq = 0;
export async function createBooking(
  prisma: PrismaClient,
  p: { userId: string; modelId: string; locationId: string; bikeId: string; startAt: Date; endAt: Date; status?: BookingStatus },
) {
  seq += 1;
  return prisma.booking.create({
    data: {
      code: `T04-${Date.now()}-${seq}`,
      userId: p.userId,
      modelId: p.modelId,
      locationId: p.locationId,
      bikeId: p.bikeId,
      startAt: p.startAt,
      endAt: p.endAt,
      status: p.status ?? 'CONFIRMED',
      paymentMethod: 'VIETQR',
      lang: 'en',
      rentAmount: 0,
      totalAmount: 0,
      quote: {},
    },
  });
}

export async function createSettings(prisma: PrismaClient, overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    bufferMinutes: 60,
    minLeadMinutes: 60,
    minRentDays: 1,
    depositMode: 'MONEY',
    deliveryFee: 100_000,
    defaultCurrencyByLang: { ru: 'RUB', en: 'USD', vi: 'VND' },
    // Сценарии создают много броней одним клиентом; сами лимиты проверяются в bike-missing.spec
    maxUnpaidBookings: 1000,
    maxActiveBookings: 1000,
    // Сценарии про брони; обязательные документы проверяются в required-documents.spec
    requireDocuments: false,
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: value as object }, update: { value: value as object } });
  }
}
