import { Prisma, PrismaClient, type BookingStatus } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// Exclusion constraint bookings_bike_no_overlap (история 35): интервалы [start_at, end_at + буфер)
// одного байка не пересекаются среди броней, держащих байк. Проверка на настоящем PostgreSQL.

const prisma = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const H = 3_600_000;
const t0 = new Date('2026-12-01T03:00:00Z');
const at = (hours: number) => new Date(t0.getTime() + hours * H);

let ids: { userId: string; modelId: string; locationId: string; bikeA: string; bikeB: string };
let seq = 0;

function booking(bikeId: string, from: number, to: number, status: BookingStatus = 'PENDING_PAYMENT', bufferMinutes?: number) {
  seq += 1;
  return prisma.booking.create({
    data: {
      code: `IT-${seq}`,
      userId: ids.userId,
      modelId: ids.modelId,
      locationId: ids.locationId,
      bikeId,
      startAt: at(from),
      endAt: at(to),
      status,
      paymentMethod: 'VIETQR',
      lang: 'en',
      rentAmount: 0,
      totalAmount: 0,
      quote: {},
      ...(bufferMinutes === undefined ? {} : { bufferMinutes }),
    },
  });
}

async function expectOverlapRejected(p: Promise<unknown>) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err, 'вставка должна быть отклонена БД').not.toBeNull();
  // Prisma не знает exclusion constraint: ошибка приходит как неизвестная, с SQLSTATE 23P01 в тексте
  const text = err instanceof Error ? err.message : String(err);
  expect(text).toMatch(/23P01|bookings_bike_no_overlap/);
}

beforeAll(async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    throw new Error(
      'PostgreSQL недоступен по DATABASE_URL — запустите тесты через `pnpm test:integration` (поднимает БД из docker compose).',
    );
  }
  const user = await prisma.user.create({ data: { telegramId: `it-${Date.now()}` } });
  const location = await prisma.location.create({ data: { name: { en: 'IT' }, address: 'IT', lat: 0, lng: 0 } });
  const brand = await prisma.brand.create({ data: { name: `IT-${Date.now()}` } });
  const model = await prisma.bikeModel.create({
    data: {
      locationId: location.id,
      brandId: brand.id,
      name: 'IT',
      slug: `it-${Date.now()}`,
      category: 'SCOOTER',
      transmission: 'AUTOMATIC',
      description: { en: 'IT' },
      deposit: 0,
    },
  });
  const [a, b] = await Promise.all(
    ['IT-A', 'IT-B'].map((plate) =>
      prisma.bike.create({ data: { modelId: model.id, locationId: location.id, plate: `${plate}-${Date.now()}` } }),
    ),
  );
  ids = { userId: user.id, modelId: model.id, locationId: location.id, bikeA: a!.id, bikeB: b!.id };
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { modelId: ids.modelId } });
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('exclusion constraint броней байка', () => {
  it('пересекающиеся интервалы одного байка отклоняются', async () => {
    await booking(ids.bikeA, 0, 24);
    await expectOverlapRejected(booking(ids.bikeA, 12, 36));
  });

  it('бронь, начинающаяся внутри буфера 1 ч после предыдущей, отклоняется', async () => {
    await booking(ids.bikeA, 0, 24);
    await expectOverlapRejected(booking(ids.bikeA, 24.5, 48));
  });

  it('бронь сразу после буфера проходит', async () => {
    await booking(ids.bikeA, 0, 24);
    await expect(booking(ids.bikeA, 25, 48)).resolves.toMatchObject({ bikeId: ids.bikeA });
  });

  it('blocked_until = end_at + буфер считается в БД', async () => {
    const b = await booking(ids.bikeA, 0, 24, 'CONFIRMED', 90);
    expect(b.blockedUntil?.toISOString()).toBe(at(25.5).toISOString());
  });

  it('другой байк той же модели на те же даты — можно', async () => {
    await booking(ids.bikeA, 0, 24);
    await expect(booking(ids.bikeB, 0, 24)).resolves.toBeTruthy();
  });

  it('отменённая и завершённая брони не держат байк', async () => {
    await booking(ids.bikeA, 0, 24, 'CANCELLED_BY_SYSTEM');
    await booking(ids.bikeA, 0, 24, 'COMPLETED');
    await expect(booking(ids.bikeA, 0, 24, 'CONFIRMED')).resolves.toBeTruthy();
  });

  it('продление брони на занятый интервал отклоняется (UPDATE тоже проверяется)', async () => {
    const first = await booking(ids.bikeA, 0, 24);
    await booking(ids.bikeA, 30, 48);
    await expectOverlapRejected(prisma.booking.update({ where: { id: first.id }, data: { endAt: at(29.5) } }));
  });

  it('две одновременные вставки на один байк — ровно одна успешна', async () => {
    const results = await Promise.allSettled([booking(ids.bikeA, 0, 24), booking(ids.bikeA, 2, 26)]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(String(rejected?.reason)).toMatch(/23P01|bookings_bike_no_overlap/);
  });

  it('конец раньше начала отклоняется CHECK', async () => {
    const err = await booking(ids.bikeA, 10, 5).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Prisma.PrismaClientUnknownRequestError);
  });
});
