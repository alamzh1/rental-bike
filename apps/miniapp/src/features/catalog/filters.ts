import {
  CATALOG_SORTS,
  CC_RANGES,
  MODEL_CATEGORIES,
  MODEL_FEATURES,
  TRANSMISSIONS,
  type CatalogSort,
} from '@rental/shared';

// Фильтры каталога живут в URL теми же именами, что в GET /models (ModelListQuery), — один формат на двоих.

export interface CatalogFilters {
  q?: string;
  category: string[];
  type: string[];
  cc: string[];
  /** VND в день */
  priceMin?: number;
  priceMax?: number;
  brand: string[];
  options: string[];
  sort?: CatalogSort;
  /** Точка выдачи */
  locationId?: string;
}

export const EMPTY_FILTERS: CatalogFilters = { category: [], type: [], cc: [], brand: [], options: [] };

const list = (raw: string | null, allowed?: readonly string[]): string[] =>
  (raw ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '' && (!allowed || allowed.includes(s)));

const num = (raw: string | null): number | undefined => {
  if (raw === null || raw.trim() === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

export function parseFilters(params: URLSearchParams): CatalogFilters {
  const sort = params.get('sort');
  const q = params.get('q')?.trim();
  const priceMin = num(params.get('priceMin'));
  const priceMax = num(params.get('priceMax'));
  return {
    ...(q ? { q } : {}),
    category: list(params.get('category'), MODEL_CATEGORIES),
    type: list(params.get('type'), TRANSMISSIONS),
    cc: list(params.get('cc'), CC_RANGES),
    ...(priceMin !== undefined ? { priceMin } : {}),
    ...(priceMax !== undefined ? { priceMax } : {}),
    brand: list(params.get('brand')),
    options: list(params.get('options'), MODEL_FEATURES),
    ...(params.get('locationId') ? { locationId: params.get('locationId') as string } : {}),
    ...(sort && (CATALOG_SORTS as readonly string[]).includes(sort) ? { sort: sort as CatalogSort } : {}),
  };
}

/** Фильтры → query-строка (для URL и для API). Пустые значения не пишутся. */
export function toParams(f: CatalogFilters, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const k of ['q', 'category', 'type', 'cc', 'priceMin', 'priceMax', 'brand', 'options', 'sort', 'locationId']) params.delete(k);
  if (f.q) params.set('q', f.q);
  if (f.category.length) params.set('category', f.category.join(','));
  if (f.type.length) params.set('type', f.type.join(','));
  if (f.cc.length) params.set('cc', f.cc.join(','));
  if (f.priceMin !== undefined) params.set('priceMin', String(f.priceMin));
  if (f.priceMax !== undefined) params.set('priceMax', String(f.priceMax));
  if (f.brand.length) params.set('brand', f.brand.join(','));
  if (f.options.length) params.set('options', f.options.join(','));
  if (f.sort) params.set('sort', f.sort);
  if (f.locationId) params.set('locationId', f.locationId);
  return params;
}

/** Число включённых значений в шторке (для метки на кнопке): каждое значение, цена как один, сортировка. */
export function activeCount(f: CatalogFilters): number {
  return f.type.length + f.cc.length + f.brand.length + f.options.length + (f.priceMin !== undefined || f.priceMax !== undefined ? 1 : 0) + (f.sort ? 1 : 0);
}
