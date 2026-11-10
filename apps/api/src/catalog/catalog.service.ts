import { Injectable } from '@nestjs/common';
import type { Banner, Brand, BikeModel, Location, Prisma, Tariff } from '@prisma/client';
import {
  CC_RANGE_BOUNDS,
  MODEL_CATEGORIES,
  fromLocationDateTime,
  toLocationDate,
  type BannerInfo,
  type BrandInfo,
  type CatalogSort,
  type HomeResponse,
  type I18nText,
  type LicenseCategory,
  type LocationInfo,
  type ModelCard,
  type ModelCategory,
  type ModelDetail,
  type ModelFeature,
  type ModelListResponse,
  type NowResponse,
  type Transmission,
} from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityService } from '../availability/availability.service';
import { PricingService, basePricePerDay, toBrackets } from '../pricing/pricing.service';
import { loadSettings } from '../pricing/settings';
import { notFound } from '../auth/api-errors';
import type { CatalogFilter, Period } from './query';
import { publicFileUrl, toPhotos } from './public-url';

type ModelRow = BikeModel & { brand: Brand; tariffs: Tariff[]; location: Location };

const POPULAR_LIMIT = 10;
const SLOT_MIN = 30;
const DAY_MS = 86_400_000;

const toBrand = (b: Brand): BrandInfo => ({ id: b.id, name: b.name, logoUrl: b.logoKey ? publicFileUrl(b.logoKey) : null });

export const toLocation = (l: Location): LocationInfo => ({
  id: l.id,
  name: l.name as I18nText,
  address: l.address,
  lat: l.lat,
  lng: l.lng,
  openTime: l.openTime,
  closeTime: l.closeTime,
  timezone: l.timezone,
  contact: l.contact,
});

const toBanner = (b: Banner): BannerInfo => ({
  id: b.id,
  title: b.title as I18nText,
  text: (b.text as I18nText | null) ?? null,
  imageUrl: b.imageKey ? publicFileUrl(b.imageKey) : null,
  link: b.link,
});

function compare(sort: CatalogSort) {
  return (a: ModelCard & { popularity: number }, b: ModelCard & { popularity: number }): number => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    let d = 0;
    if (sort === 'price_asc') d = a.pricePerDay - b.pricePerDay;
    else if (sort === 'price_desc') d = b.pricePerDay - a.pricePerDay;
    else if (sort === 'rating') d = (b.rating ?? 0) - (a.rating ?? 0);
    return d || b.popularity - a.popularity || a.name.localeCompare(b.name);
  };
}

/** Модель в продаже: сама активна, и её точка не закрыта. */
const ACTIVE_MODEL = { isActive: true, location: { isActive: true } } satisfies Prisma.BikeModelWhereInput;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly pricing: PricingService,
  ) {}

  private where(f: Partial<CatalogFilter>): Prisma.BikeModelWhereInput {
    const and: Prisma.BikeModelWhereInput[] = [ACTIVE_MODEL];
    if (f.locationId) and.push({ locationId: f.locationId });
    if (f.categories?.length) and.push({ category: { in: f.categories } });
    if (f.types?.length) and.push({ transmission: { in: f.types } });
    if (f.options?.length) and.push({ features: { hasEvery: f.options } });
    if (f.cc?.length) {
      and.push({ OR: f.cc.map((r) => ({ engineCc: { gte: CC_RANGE_BOUNDS[r].min, ...(CC_RANGE_BOUNDS[r].max === null ? {} : { lte: CC_RANGE_BOUNDS[r].max }) } })) });
    }
    if (f.brands?.length) and.push({ OR: f.brands.map((name) => ({ brand: { name: { equals: name, mode: 'insensitive' as const } } })) });
    if (f.q) and.push({ OR: [{ name: { contains: f.q, mode: 'insensitive' } }, { brand: { name: { contains: f.q, mode: 'insensitive' } } }] });
    return { AND: and };
  }

  /** Карточки для моделей: доступность и итог на период (если задан), избранное пользователя. */
  private async cards(rows: ModelRow[], period: Period | null, userId: string | null): Promise<(ModelCard & { popularity: number })[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);
    const [avail, quotes, serviceable, favorites] = await Promise.all([
      period ? this.availability.availabilityFor(ids, period.from, period.to) : null,
      period ? this.pricing.rentQuotes(rows, period.from, period.to) : null,
      period ? null : this.availability.hasServiceableBike(ids),
      userId ? this.prisma.favorite.findMany({ where: { userId, modelId: { in: ids } }, select: { modelId: true } }) : [],
    ]);
    const fav = new Set(favorites.map((f) => f.modelId));
    const manyPoints = (await this.prisma.location.count({ where: { isActive: true } })) > 1;
    return rows.map((m) => {
      const q = quotes?.get(m.id);
      const a = avail?.get(m.id);
      return {
        id: m.id,
        slug: m.slug,
        name: m.name,
        brand: toBrand(m.brand),
        category: m.category as ModelCategory,
        transmission: m.transmission as Transmission,
        engineCc: m.engineCc,
        year: m.year,
        rating: m.rating,
        reviewsCount: m.reviewsCount,
        photo: toPhotos(m.photos)[0] ?? null,
        features: m.features as ModelFeature[],
        licenseRequired: m.licenseRequired as LicenseCategory,
        deposit: m.deposit,
        pricePerDay: q?.pricePerDay ?? basePricePerDay(m.tariffs),
        days: q?.days ?? null,
        total: q?.total ?? null,
        available: a ? a.freeCount > 0 : (serviceable?.has(m.id) ?? false),
        busyUntil: a?.busyUntil?.toISOString() ?? null,
        isFavorite: fav.has(m.id),
        pointName: manyPoints ? (m.location.name as I18nText) : null,
        isDemo: m.isDemo,
        popularity: m.popularity,
      };
    });
  }

  private strip(cards: (ModelCard & { popularity: number })[]): ModelCard[] {
    return cards.map(({ popularity: _p, ...card }) => card);
  }

  private loadRows(where: Prisma.BikeModelWhereInput): Promise<ModelRow[]> {
    return this.prisma.bikeModel.findMany({ where, include: { brand: true, tariffs: true, location: true } });
  }

  /** GET /models: фильтры, доступность на даты, итог через shared.quote; свободные — первыми. */
  async listModels(filter: CatalogFilter, userId: string | null = null): Promise<ModelListResponse> {
    const rows = await this.loadRows(this.where(filter));
    const cards = (await this.cards(rows, filter.period, userId))
      .filter((c) => (filter.priceMin === null || c.pricePerDay >= filter.priceMin) && (filter.priceMax === null || c.pricePerDay <= filter.priceMax))
      .sort(compare(filter.sort));
    return { items: this.strip(cards), count: cards.length };
  }

  /** Карточки по id в заданном порядке (для избранного). Неактивные модели пропускаются. */
  async cardsByIds(ids: string[], period: Period | null, userId: string | null): Promise<ModelCard[]> {
    const rows = await this.loadRows({ id: { in: ids }, ...ACTIVE_MODEL });
    const cards = await this.cards(rows, period, userId);
    return this.strip(ids.map((id) => cards.find((c) => c.id === id)).filter((c): c is ModelCard & { popularity: number } => !!c));
  }

  async exists(id: string): Promise<boolean> {
    return (await this.prisma.bikeModel.count({ where: { id, ...ACTIVE_MODEL } })) > 0;
  }

  /** GET /models/{id}: галерея, характеристики, тарифная сетка, что входит, условия, опции оформления. */
  async getModel(id: string, period: Period | null = null, userId: string | null = null): Promise<ModelDetail> {
    const row = await this.prisma.bikeModel.findFirst({ where: { id, ...ACTIVE_MODEL }, include: { brand: true, tariffs: true, location: true } });
    if (!row) throw notFound('Model not found');
    const [[card], extras, settings, restrictions] = await Promise.all([
      this.cards([row], period, userId),
      this.prisma.extra.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] }),
      loadSettings(this.prisma, ['depositMode', 'deliveryFee']),
      this.prisma.setting.findUnique({ where: { key: 'restrictionsText' } }),
    ]);
    const { popularity: _p, ...base } = card!;
    return {
      ...base,
      photos: toPhotos(row.photos),
      description: row.description as I18nText,
      specs: {
        engineCc: row.engineCc,
        transmission: row.transmission as Transmission,
        fuelConsumption: row.fuelConsumption,
        tankLiters: row.tankLiters,
        maxSpeedKmh: row.maxSpeedKmh,
        seats: row.seats,
      },
      tariffs: toBrackets(row.tariffs),
      included: Array.isArray(row.included) ? (row.included as I18nText[]) : [],
      // Условия модели главнее; иначе общие ограничения (пробег, поездки между провинциями) из настроек
      conditions: (row.conditions as I18nText | null) ?? (restrictions?.value as I18nText | null | undefined) ?? null,
      depositMode: settings.depositMode,
      extras: extras.map((e) => ({ id: e.id, code: e.code, name: e.name as I18nText, price: e.price, per: e.per, maxQty: e.maxQty })),
      deliveryFee: settings.deliveryFee,
      location: toLocation(row.location),
    };
  }

  private defaultLocation(): Promise<Location | null> {
    return this.prisma.location.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'asc' } });
  }

  /** GET /home: точка, баннер, чипы категорий со счётчиками, бренды из парка, популярные. */
  async home(period: Period | null, userId: string | null): Promise<HomeResponse> {
    const [location, points, banner, grouped, brands, popularRows] = await Promise.all([
      this.defaultLocation(),
      this.prisma.location.findMany({ where: { isActive: true, models: { some: { isActive: true } } }, orderBy: { createdAt: 'asc' } }),
      this.prisma.banner.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } }),
      this.prisma.bikeModel.groupBy({ by: ['category'], where: ACTIVE_MODEL, _count: { _all: true } }),
      this.prisma.brand.findMany({ where: { models: { some: ACTIVE_MODEL } }, orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
      this.prisma.bikeModel.findMany({ where: ACTIVE_MODEL, include: { brand: true, tariffs: true, location: true }, orderBy: [{ popularity: 'desc' }, { name: 'asc' }], take: POPULAR_LIMIT }),
    ]);
    const popular = await this.cards(popularRows, period, userId);
    return {
      location: location ? toLocation(location) : null,
      points: points.map(toLocation),
      banner: banner ? toBanner(banner) : null,
      categories: MODEL_CATEGORIES.map((category) => ({ category, count: grouped.find((g) => g.category === category)?._count._all ?? 0 })),
      brands: brands.map(toBrand),
      popular: this.strip(popular),
    };
  }

  /** Ближайший слот выдачи: сейчас + minLeadMinutes, вверх до 30 мин, в часы работы точки. */
  async nearestSlot(now = new Date()): Promise<Period> {
    const [{ minLeadMinutes }, location] = await Promise.all([loadSettings(this.prisma, ['minLeadMinutes']), this.defaultLocation()]);
    const slotMs = SLOT_MIN * 60_000;
    let from = new Date(Math.ceil((now.getTime() + minLeadMinutes * 60_000) / slotMs) * slotMs);
    if (location) {
      const { timezone: tz, openTime, closeTime } = location;
      const date = toLocationDate(from, tz);
      const open = fromLocationDateTime(date, openTime, tz);
      const close = fromLocationDateTime(date, closeTime, tz);
      if (from < open) from = open;
      else if (from > close) {
        const next = toLocationDate(new Date(open.getTime() + DAY_MS), tz);
        from = fromLocationDateTime(next, openTime, tz);
      }
    }
    return { from, to: new Date(from.getTime() + DAY_MS) };
  }

  /** GET /now: модели, свободные с ближайшего слота на сутки. */
  async now(userId: string | null): Promise<NowResponse> {
    const period = await this.nearestSlot();
    const rows = await this.loadRows(ACTIVE_MODEL);
    const cards = (await this.cards(rows, period, userId)).filter((c) => c.available).sort(compare('popularity'));
    return { from: period.from.toISOString(), to: period.to.toISOString(), items: this.strip(cards) };
  }
}
