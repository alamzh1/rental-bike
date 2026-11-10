/**
 * Сид для локального запуска: точка выдачи, демо-парк из 6 моделей, опции, настройки, тестовые пользователи.
 * Идемпотентен (upsert). Всё, чего нет в ТЗ и PRODUCT.md (модели, цены, депозиты, характеристики, курсы,
 * почасовая доплата), помечено isDemo: true — владелец заменяет в админке.
 * Фото моделей привязывает таск 03 (prisma/seed-assets).
 */
import { uploadModelPhotos } from './seed-assets/upload';
import { Prisma, PrismaClient, type ModelCategory, type Transmission, type LicenseCategory, type ExtraPer } from '@prisma/client';

const prisma = new PrismaClient();

type I18n = { ru: string; en: string; vi: string };
const DEMO_DESCRIPTION: I18n = {
  ru: '[ДЕМО] Описание модели — замените в админке',
  en: '[DEMO] Model description — replace in the admin panel',
  vi: '[DEMO] Mô tả mẫu xe — thay thế trong trang quản trị',
};

// ---------- Точка выдачи (PRODUCT.md, Operating Context) ----------
const LOCATION_ID = 'loc_quy_nhon_1';
const location = {
  id: LOCATION_ID,
  name: { ru: 'Точка на Нгуен Хюэ', en: 'Nguyễn Huệ pickup point', vi: 'Điểm nhận xe Nguyễn Huệ' },
  address: '4c Nguyễn Huệ, Quy Nhơn, Gia Lai, Việt Nam',
  // Координаты — центр Куинёна, приблизительно: точный пин владелец ставит в админке
  lat: 13.7765,
  lng: 109.2237,
  // Часы не подтверждены: значение по умолчанию из ТЗ (§5.1)
  openTime: '08:00',
  closeTime: '20:00',
  timezone: 'Asia/Ho_Chi_Minh',
};

// ---------- Демо-парк (история 60). Цены, депозиты, характеристики — ДЕМО ----------
interface DemoModel {
  slug: string;
  brand: string;
  name: string;
  category: ModelCategory;
  transmission: Transmission;
  engineCc: number | null;
  year: number;
  fuelConsumption: number | null;
  tankLiters: number | null;
  maxSpeedKmh: number;
  features: string[];
  licenseRequired: LicenseCategory;
  deposit: number;
  rating: number;
  reviewsCount: number;
  popularity: number;
  prices: [number, number, number, number]; // 1–2, 3–6, 7–29, 30+ дней
  bikes: number;
}

const models: DemoModel[] = [
  { slug: 'honda-vision-110', brand: 'Honda', name: 'Vision 110', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 110, year: 2023, fuelConsumption: 1.9, tankLiters: 4.9, maxSpeedKmh: 90, features: ['USB', 'SMART_KEY'], licenseRequired: 'A1', deposit: 1_000_000, rating: 4.7, reviewsCount: 0, popularity: 90, prices: [150_000, 130_000, 110_000, 90_000], bikes: 3 },
  { slug: 'honda-air-blade-125', brand: 'Honda', name: 'Air Blade 125', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, year: 2023, fuelConsumption: 2.2, tankLiters: 4.4, maxSpeedKmh: 100, features: ['TRUNK', 'USB', 'SMART_KEY'], licenseRequired: 'A1', deposit: 1_500_000, rating: 4.8, reviewsCount: 0, popularity: 100, prices: [180_000, 160_000, 140_000, 120_000], bikes: 3 },
  { slug: 'honda-vario-160', brand: 'Honda', name: 'Vario 160', category: 'MAXI_SCOOTER', transmission: 'AUTOMATIC', engineCc: 160, year: 2024, fuelConsumption: 2.2, tankLiters: 5.5, maxSpeedKmh: 110, features: ['TRUNK', 'USB', 'ABS', 'SMART_KEY'], licenseRequired: 'A', deposit: 2_500_000, rating: 4.9, reviewsCount: 0, popularity: 70, prices: [250_000, 220_000, 200_000, 170_000], bikes: 2 },
  { slug: 'yamaha-nvx-155', brand: 'Yamaha', name: 'NVX 155', category: 'MAXI_SCOOTER', transmission: 'AUTOMATIC', engineCc: 155, year: 2023, fuelConsumption: 2.3, tankLiters: 5.5, maxSpeedKmh: 115, features: ['TRUNK', 'USB', 'ABS', 'SMART_KEY'], licenseRequired: 'A', deposit: 2_500_000, rating: 4.8, reviewsCount: 0, popularity: 75, prices: [250_000, 220_000, 200_000, 170_000], bikes: 2 },
  { slug: 'yamaha-janus-125', brand: 'Yamaha', name: 'Janus 125', category: 'SCOOTER', transmission: 'AUTOMATIC', engineCc: 125, year: 2023, fuelConsumption: 1.9, tankLiters: 4.2, maxSpeedKmh: 90, features: ['TRUNK'], licenseRequired: 'A1', deposit: 1_000_000, rating: 4.6, reviewsCount: 0, popularity: 60, prices: [150_000, 130_000, 110_000, 90_000], bikes: 2 },
  { slug: 'vinfast-evo200', brand: 'VinFast', name: 'Evo200', category: 'ELECTRIC', transmission: 'ELECTRIC', engineCc: null, year: 2024, fuelConsumption: null, tankLiters: null, maxSpeedKmh: 70, features: ['USB'], licenseRequired: 'A1', deposit: 2_000_000, rating: 4.6, reviewsCount: 0, popularity: 40, prices: [200_000, 180_000, 160_000, 140_000], bikes: 2 },
];

const BRACKETS: [number, number | null][] = [[1, 2], [3, 6], [7, 29], [30, null]];

// Что входит бесплатно — ТЗ §4.4
const INCLUDED: I18n[] = [
  { ru: '2 шлема', en: '2 helmets', vi: '2 mũ bảo hiểm' },
  { ru: 'Замок', en: 'Lock', vi: 'Khóa xe' },
  { ru: 'Дождевик', en: 'Raincoat', vi: 'Áo mưa' },
];

// Опции оформления — история 24; цены ДЕМО
const extras: { code: string; name: I18n; price: number; per: ExtraPer; maxQty: number }[] = [
  { code: 'HELMET_2', name: { ru: 'Второй шлем', en: 'Second helmet', vi: 'Mũ bảo hiểm thứ hai' }, price: 20_000, per: 'DAY', maxQty: 1 },
  { code: 'RAINCOAT', name: { ru: 'Дождевик', en: 'Raincoat', vi: 'Áo mưa' }, price: 30_000, per: 'ONCE', maxQty: 2 },
  { code: 'PHONE_HOLDER', name: { ru: 'Держатель телефона', en: 'Phone holder', vi: 'Giá đỡ điện thoại' }, price: 10_000, per: 'DAY', maxQty: 1 },
  { code: 'INSURANCE', name: { ru: 'Страховка', en: 'Insurance', vi: 'Bảo hiểm' }, price: 40_000, per: 'DAY', maxQty: 1 },
];

const placeholder = (what: { ru: string; en: string; vi: string }) => ({
  ru: `[${what.ru} — впиши]`,
  en: `[${what.en} — fill in]`,
  vi: `[${what.vi} — điền vào]`,
});

// Настройки — interfaces.md «Конфигурируемые правила». isDemo — значение не подтверждено владельцем.
const settings: { key: string; value: Prisma.InputJsonValue | null; isDemo?: boolean }[] = [
  { key: 'holdMinutes', value: 15 },
  { key: 'bufferMinutes', value: 60 },
  { key: 'minLeadMinutes', value: 60 },
  { key: 'minRentDays', value: 1 },
  { key: 'cancel', value: { fullHours: 24, halfHours: 2, halfPercent: 50 } },
  // Почасовая доплата не задана в ТЗ — демо-значение
  { key: 'late', value: { graceMinutes: 60, hourlyFee: 30_000, extraDayAfterHours: 4 }, isDemo: true },
  { key: 'depositMode', value: 'MONEY' },
  // Запасные курсы (сколько RUB/USD в 1 VND) — по примеру из ТЗ §7: 150 000 ₫ ≈ 530 ₽ ≈ $5.70
  { key: 'rates', value: { RUB: 0.003533, USD: 0.000038, updatedAt: null }, isDemo: true },
  { key: 'docRetentionDays', value: 90 },
  { key: 'contractTemplate', value: placeholder({ ru: 'ТЕКСТ ДОГОВОРА', en: 'CONTRACT TEXT', vi: 'NỘI DUNG HỢP ĐỒNG' }), isDemo: true },
  { key: 'rulesText', value: placeholder({ ru: 'ПРАВИЛА АРЕНДЫ', en: 'RENTAL RULES', vi: 'QUY ĐỊNH THUÊ XE' }), isDemo: true },
  { key: 'privacyText', value: placeholder({ ru: 'ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ', en: 'PRIVACY POLICY', vi: 'CHÍNH SÁCH BẢO MẬT' }), isDemo: true },
  { key: 'faq', value: placeholder({ ru: 'ВОПРОСЫ И ОТВЕТЫ', en: 'FAQ', vi: 'CÂU HỎI THƯỜNG GẶP' }), isDemo: true },
  // Telegram-username менеджера — не известен
  { key: 'managerContact', value: '[КОНТАКТ МЕНЕДЖЕРА — впиши]', isDemo: true },
  // Ограничения по пробегу и поездкам между провинциями в ТЗ не заданы — видимая заглушка (читает карточка модели)
  { key: 'restrictionsText', value: placeholder({ ru: 'ОГРАНИЧЕНИЯ ПО ПРОБЕГУ И ПОЕЗДКАМ МЕЖДУ ПРОВИНЦИЯМИ', en: 'MILEAGE AND INTER-PROVINCE TRAVEL RESTRICTIONS', vi: 'GIỚI HẠN QUÃNG ĐƯỜNG VÀ DI CHUYỂN GIỮA CÁC TỈNH' }), isDemo: true },
  { key: 'noShowHours', value: 3 },
  { key: 'cashPrepayPercent', value: 0 },
  // Цена доставки в отель не известна: null — доставка недоступна, пока владелец не задаст сумму
  { key: 'deliveryFee', value: null, isDemo: true },
  { key: 'defaultCurrencyByLang', value: { ru: 'RUB', en: 'USD', vi: 'VND' } },
];

// Тестовые пользователи для DEV_AUTH=1 (клиент, менеджер, админ). Создаются только при явном
// NODE_ENV=development|test: их Telegram ID — обычные числа, и в production реальный аккаунт
// с таким ID получил бы роль менеджера или администратора.
const testUsersAllowed = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const users = [
  { telegramId: '100000001', firstName: 'Test', lastName: 'Client', username: 'test_client', role: 'CLIENT' as const, lang: 'ru' as const, currency: 'RUB' as const },
  { telegramId: '100000002', firstName: 'Test', lastName: 'Manager', username: 'test_manager', role: 'MANAGER' as const, lang: 'ru' as const, currency: 'VND' as const },
  { telegramId: '100000003', firstName: 'Test', lastName: 'Admin', username: 'test_admin', role: 'ADMIN' as const, lang: 'ru' as const, currency: 'VND' as const },
  { telegramId: '100000004', firstName: 'Test', lastName: 'Owner', username: 'test_owner', role: 'OWNER' as const, lang: 'ru' as const, currency: 'VND' as const },
];

async function main(): Promise<void> {
  await prisma.location.upsert({ where: { id: LOCATION_ID }, create: location, update: location });

  if (!testUsersAllowed) console.log(`[seed] NODE_ENV=${process.env.NODE_ENV ?? ''}: тестовые пользователи не создаются`);
  for (const u of testUsersAllowed ? users : []) {
    const data = { ...u, isDemo: true, onboardedAt: new Date(), locationId: u.role === 'CLIENT' ? null : LOCATION_ID };
    await prisma.user.upsert({ where: { telegramId: u.telegramId }, create: data, update: data });
  }

  for (const [i, m] of models.entries()) {
    const brand = await prisma.brand.upsert({ where: { name: m.brand }, create: { name: m.brand, sortOrder: i }, update: {} });
    const data = {
      locationId: LOCATION_ID,
      brandId: brand.id,
      name: m.name,
      category: m.category,
      transmission: m.transmission,
      engineCc: m.engineCc,
      year: m.year,
      description: DEMO_DESCRIPTION,
      fuelConsumption: m.fuelConsumption,
      tankLiters: m.tankLiters,
      maxSpeedKmh: m.maxSpeedKmh,
      seats: 2,
      features: m.features,
      included: INCLUDED,
      licenseRequired: m.licenseRequired,
      deposit: m.deposit,
      rating: m.rating,
      reviewsCount: m.reviewsCount,
      popularity: m.popularity,
      isDemo: true,
      photos: await uploadModelPhotos(m.slug, `${m.brand} ${m.name}`),
    };
    const model = await prisma.bikeModel.upsert({ where: { slug: m.slug }, create: { slug: m.slug, ...data }, update: data });

    for (const [j, [minDays, maxDays]] of BRACKETS.entries()) {
      const tariff = { minDays, maxDays, pricePerDay: m.prices[j]!, isDemo: true };
      await prisma.tariff.upsert({
        where: { modelId_minDays: { modelId: model.id, minDays } },
        create: { modelId: model.id, ...tariff },
        update: tariff,
      });
    }

    for (let n = 1; n <= m.bikes; n++) {
      const plate = `DEMO-${m.slug.toUpperCase()}-${n}`;
      const bike = { modelId: model.id, locationId: LOCATION_ID, isDemo: true };
      await prisma.bike.upsert({ where: { plate }, create: { plate, ...bike }, update: bike });
    }
  }

  for (const [i, e] of extras.entries()) {
    const data = { ...e, sortOrder: i, isDemo: true };
    await prisma.extra.upsert({ where: { code: e.code }, create: data, update: data });
  }

  // Настройки не перезаписываются при повторном сиде — их правит владелец
  for (const s of settings) {
    const value = s.value ?? Prisma.JsonNull;
    await prisma.setting.upsert({ where: { key: s.key }, create: { key: s.key, value, isDemo: s.isDemo ?? false }, update: {} });
  }

  const counts = {
    models: await prisma.bikeModel.count(),
    bikes: await prisma.bike.count(),
    tariffs: await prisma.tariff.count(),
    extras: await prisma.extra.count(),
    settings: await prisma.setting.count(),
    users: await prisma.user.count(),
  };
  console.log('seed: done', counts);
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
