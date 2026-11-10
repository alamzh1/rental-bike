import type { I18nText } from '@rental/shared';
import { badRequest } from '../../auth/api-errors';
import type { AdminUser } from '../auth';
import type { Actor } from '../../bookings/audit';

// Разбор тел запросов разделов таска 11: явные проверки без DTO-классов (как в разделах таска 10).

export type Body = Record<string, unknown>;

export function asBody(body: unknown): Body {
  return body && typeof body === 'object' && !Array.isArray(body) ? (body as Body) : {};
}

export const actorOf = (u: AdminUser): Actor => ({ id: u.id, role: u.role });

const MAX_TEXT = 20_000;

/** I18nText: en обязателен (фолбэк), ru/vi — по желанию; пустые строки отбрасываются. */
export function i18nText(v: unknown, name: string, opts: { max?: number } = {}): I18nText {
  const max = opts.max ?? MAX_TEXT;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw badRequest(`${name} must be { ru?, en, vi? }`);
  const o = v as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const lang of ['ru', 'en', 'vi'] as const) {
    const s = o[lang];
    if (s === undefined || s === null) continue;
    if (typeof s !== 'string') throw badRequest(`${name}.${lang} must be a string`);
    const t = s.trim();
    if (t.length > max) throw badRequest(`${name}.${lang} is longer than ${max}`);
    if (t) out[lang] = t;
  }
  if (!out.en) throw badRequest(`${name}.en is required`);
  return out as I18nText;
}

export function optI18nText(v: unknown, name: string, opts: { max?: number } = {}): I18nText | null {
  if (v === null) return null;
  if (v && typeof v === 'object' && !Object.values(v as object).some((s) => typeof s === 'string' && s.trim())) return null;
  return i18nText(v, name, opts);
}

export function str(v: unknown, name: string, max = 200): string {
  if (typeof v !== 'string' || !v.trim()) throw badRequest(`${name} is required`);
  const t = v.trim();
  if (t.length > max) throw badRequest(`${name} is longer than ${max}`);
  return t;
}

export function optStr(v: unknown, name: string, max = 200): string | null {
  if (v === null || v === undefined || v === '' || (typeof v === 'string' && !v.trim())) return null;
  return str(v, name, max);
}

export function int(v: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw badRequest(`${name} must be an integer ${min}…${max}`);
  return v;
}

export function optInt(v: unknown, name: string, min = 0, max = Number.MAX_SAFE_INTEGER): number | null {
  return v === null ? null : int(v, name, min, max);
}

export function num(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw badRequest(`${name} must be a number ${min}…${max}`);
  return v;
}

export function optNum(v: unknown, name: string, min: number, max: number): number | null {
  return v === null ? null : num(v, name, min, max);
}

export function bool(v: unknown, name: string): boolean {
  if (typeof v !== 'boolean') throw badRequest(`${name} must be boolean`);
  return v;
}

export function oneOf<T extends string>(v: unknown, name: string, list: readonly T[]): T {
  if (typeof v !== 'string' || !(list as readonly string[]).includes(v)) throw badRequest(`${name} must be one of ${list.join(', ')}`);
  return v as T;
}

/** ISO-момент или null. */
export function optInstant(v: unknown, name: string): Date | null {
  if (v === null || v === '') return null;
  if (typeof v !== 'string') throw badRequest(`${name} must be an ISO date`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) throw badRequest(`${name} must be an ISO date`);
  return d;
}

/** YYYY-MM-DD → Date (UTC полночь, колонка @db.Date). */
export function ymd(v: unknown, name: string): Date {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) throw badRequest(`${name} must be YYYY-MM-DD`);
  const d = new Date(`${v}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v) throw badRequest(`${name} must be a valid date`);
  return d;
}

export const has = (b: Body, key: string): boolean => Object.prototype.hasOwnProperty.call(b, key) && b[key] !== undefined;

export function pageOf(v: unknown): number {
  const n = Number(v ?? 1);
  return Number.isInteger(n) && n >= 1 ? n : 1;
}
