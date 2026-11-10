import {
  CATALOG_SORTS,
  CC_RANGES,
  MODEL_CATEGORIES,
  MODEL_FEATURES,
  TRANSMISSIONS,
  type CatalogSort,
  type CcRange,
  type ModelCategory,
  type ModelFeature,
  type Transmission,
} from '@rental/shared';
import { badRequest } from '../auth/api-errors';

// Разбор query-параметров каталога (история 65). Неизвестные значения — 400, а не тихое игнорирование.

export interface Period {
  from: Date;
  to: Date;
}

export interface CatalogFilter {
  period: Period | null;
  categories: ModelCategory[];
  types: Transmission[];
  cc: CcRange[];
  brands: string[];
  options: ModelFeature[];
  priceMin: number | null;
  priceMax: number | null;
  q: string | null;
  sort: CatalogSort;
  locationId: string | null;
}

type Query = Record<string, unknown>;

const MAX_PERIOD_MS = 366 * 86_400_000;

export function parseInstant(v: unknown, name: string): Date {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(v)) throw badRequest(`${name} must be an ISO date-time`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest(`${name} must be an ISO date-time`);
  return d;
}

/** from/to — оба или ни одного; to > from; не длиннее года. */
export function parsePeriod(q: Query): Period | null {
  if (q.from === undefined && q.to === undefined) return null;
  const from = parseInstant(q.from, 'from');
  const to = parseInstant(q.to, 'to');
  if (to.getTime() <= from.getTime()) throw badRequest('to must be after from');
  if (to.getTime() - from.getTime() > MAX_PERIOD_MS) throw badRequest('Period is too long');
  return { from, to };
}

function list<T extends string>(v: unknown, allowed: readonly T[], name: string): T[] {
  if (v === undefined || v === '') return [];
  if (typeof v !== 'string') throw badRequest(`${name} must be a comma-separated list`);
  const items = v.split(',').map((s) => s.trim()).filter(Boolean);
  for (const item of items) if (!allowed.includes(item as T)) throw badRequest(`Unknown ${name}: ${item}`);
  return items as T[];
}

function money(v: unknown, name: string): number | null {
  if (v === undefined || v === '') return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw badRequest(`${name} must be a non-negative integer (VND)`);
  return n;
}

export function parseCatalogFilter(q: Query): CatalogFilter {
  const sort = (q.sort ?? 'popularity') as CatalogSort;
  if (!CATALOG_SORTS.includes(sort)) throw badRequest(`Unknown sort: ${String(q.sort)}`);
  const text = typeof q.q === 'string' ? q.q.trim().slice(0, 50) : '';
  const brands = typeof q.brand === 'string' ? q.brand.split(',').map((s) => s.trim()).filter(Boolean) : [];
  return {
    period: parsePeriod(q),
    categories: list(q.category, MODEL_CATEGORIES, 'category'),
    types: list(q.type, TRANSMISSIONS, 'type'),
    cc: list(q.cc, CC_RANGES, 'cc'),
    brands,
    options: list(q.options, MODEL_FEATURES, 'options'),
    priceMin: money(q.priceMin, 'priceMin'),
    priceMax: money(q.priceMax, 'priceMax'),
    q: text || null,
    sort,
    locationId: typeof q.locationId === 'string' && q.locationId ? q.locationId : null,
  };
}
