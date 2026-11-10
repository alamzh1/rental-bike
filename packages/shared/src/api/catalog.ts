// Типы API модуля `catalog` (+ доступность и избранное): каталог, карточка модели, главная, «Нужен байк сейчас».
import type { I18nText } from '../types.js';
import type { TariffBracket } from '../pricing.js';
import type { LicenseCategory } from './auth.js';

/** Категории-чипы главной (история 17). */
export const MODEL_CATEGORIES = ['SCOOTER', 'MAXI_SCOOTER', 'SEMI_AUTO', 'MOTORCYCLE', 'ELECTRIC'] as const;
export type ModelCategory = (typeof MODEL_CATEGORIES)[number];

/** Фильтр «тип»: автомат, полуавтомат, механика, электро (история 65). */
export const TRANSMISSIONS = ['AUTOMATIC', 'SEMI_AUTO', 'MANUAL', 'ELECTRIC'] as const;
export type Transmission = (typeof TRANSMISSIONS)[number];

/** Фильтр «объём», см³: 50 — до 50; 300+ — от 300. Электро (без объёма) под фильтр объёма не попадает. */
export const CC_RANGES = ['50', '110-125', '150-160', '300+'] as const;
export type CcRange = (typeof CC_RANGES)[number];
export const CC_RANGE_BOUNDS: Record<CcRange, { min: number; max: number | null }> = {
  '50': { min: 0, max: 50 },
  '110-125': { min: 110, max: 125 },
  '150-160': { min: 150, max: 160 },
  '300+': { min: 300, max: null },
};

/** Опции: багажник, USB-зарядка, ABS, Smart Key. */
export const MODEL_FEATURES = ['TRUNK', 'USB', 'ABS', 'SMART_KEY'] as const;
export type ModelFeature = (typeof MODEL_FEATURES)[number];

/** Сортировка: цена ↑↓, рейтинг, популярность. Свободные на даты модели всегда идут перед занятыми. */
export const CATALOG_SORTS = ['price_asc', 'price_desc', 'rating', 'popularity'] as const;
export type CatalogSort = (typeof CATALOG_SORTS)[number];

/**
 * Параметры GET /models и /models/count (query-строка). Списки — через запятую.
 * `from`/`to` — ISO UTC; без них доступность и итог не считаются. `priceMin/priceMax` — VND в день.
 * `brand` — названия брендов. `options` — модель должна иметь все перечисленные. `q` — поиск по модели и бренду.
 */
export interface ModelListQuery {
  from?: string;
  to?: string;
  category?: string;
  type?: string;
  cc?: string;
  priceMin?: string;
  priceMax?: string;
  brand?: string;
  options?: string;
  q?: string;
  sort?: CatalogSort;
  locationId?: string;
}

export interface PhotoSize {
  webp: string;
  avif?: string;
}
/** Фото модели: `url` — основной (WebP 800 или первый доступный), `sizes` — по ширине в px. */
export interface ModelPhoto {
  url: string;
  alt: I18nText | null;
  sizes: Record<string, PhotoSize>;
}

export interface BrandInfo {
  id: string;
  name: string;
  logoUrl: string | null;
}

/** Карточка в списке (история 64). Деньги — VND. */
export interface ModelCard {
  id: string;
  slug: string;
  name: string;
  brand: BrandInfo;
  category: ModelCategory;
  transmission: Transmission;
  engineCc: number | null;
  year: number | null;
  rating: number | null;
  reviewsCount: number;
  photo: ModelPhoto | null;
  features: ModelFeature[];
  licenseRequired: LicenseCategory;
  deposit: number;
  /** Цена в день по тарифу на длительность периода (без дат — тариф на 1 день) */
  pricePerDay: number;
  /** Сутки аренды и итог за период (аренда без опций и депозита) — как в POST /quotes; без дат — null */
  days: number | null;
  total: number | null;
  /** Есть свободный байк на даты (без дат — есть исправный байк в парке) */
  available: boolean;
  /** Модель занята: ISO-момент, когда освободится первый байк; null — свободна или срок неизвестен (ремонт без даты) */
  busyUntil: string | null;
  isFavorite: boolean;
  /** Название точки выдачи, когда точек несколько; при одной точке — null */
  pointName: I18nText | null;
  isDemo: boolean;
}

export interface ModelListResponse {
  items: ModelCard[];
  count: number;
}
export interface ModelCountResponse {
  count: number;
}

export interface ModelSpecs {
  engineCc: number | null;
  transmission: Transmission;
  fuelConsumption: number | null;
  tankLiters: number | null;
  maxSpeedKmh: number | null;
  seats: number;
}

export interface ExtraOption {
  id: string;
  code: string;
  name: I18nText;
  price: number;
  per: 'DAY' | 'ONCE';
  maxQty: number;
}

export interface LocationInfo {
  id: string;
  name: I18nText;
  address: string;
  lat: number;
  lng: number;
  openTime: string;
  closeTime: string;
  timezone: string;
  /** Контакт этой точки; null — общий из настроек */
  contact: string | null;
}

/** GET /models/{id}?from&to (история 21, 67). Тексты — I18nText, язык выбирает клиент (pickText). */
export interface ModelDetail extends ModelCard {
  photos: ModelPhoto[];
  description: I18nText;
  specs: ModelSpecs;
  tariffs: TariffBracket[];
  included: I18nText[];
  conditions: I18nText | null;
  depositMode: 'MONEY' | 'DOCUMENT';
  extras: ExtraOption[];
  /** Цена доставки в отель, VND; null — доставка недоступна */
  deliveryFee: number | null;
  location: LocationInfo;
}

/** GET /models/{id}/availability?month=YYYY-MM — даты (YYYY-MM-DD в tz точки), когда нет ни одного свободного байка. */
export interface AvailabilityResponse {
  busy: string[];
}

export interface BannerInfo {
  id: string;
  title: I18nText;
  text: I18nText | null;
  imageUrl: string | null;
  link: string | null;
}

export interface CategoryCount {
  category: ModelCategory;
  count: number;
}

/** GET /home?from&to. `banner: null` — блок не показывается. */
export interface HomeResponse {
  location: LocationInfo | null;
  /** Все открытые точки: фильтр каталога `locationId`, при одной точке он не показывается */
  points: LocationInfo[];
  banner: BannerInfo | null;
  categories: CategoryCount[];
  brands: BrandInfo[];
  popular: ModelCard[];
}

/** GET /now — модели, свободные с ближайшего слота (сейчас + мин. время до выдачи) на сутки. */
export interface NowResponse {
  from: string;
  to: string;
  items: ModelCard[];
}

/** GET /favorites?from&to */
export interface FavoritesResponse {
  items: ModelCard[];
}
export interface FavoriteStatus {
  modelId: string;
  favorite: boolean;
}
