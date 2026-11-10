import { HttpStatus } from '@nestjs/common';
import { DEDUCTION_PHOTOS_MAX, HANDOVER_PHOTOS_MAX, HANDOVER_PHOTOS_MIN } from '@rental/shared';
import { badRequest } from '../auth/api-errors';
import { apiError } from '../bookings/errors';

// Разбор и проверка входных данных режима менеджера.

export const photosCount = () => apiError(HttpStatus.BAD_REQUEST, 'PHOTOS_COUNT', `Photos: ${HANDOVER_PHOTOS_MIN}–${HANDOVER_PHOTOS_MAX} required`);
export const photoNotUploaded = () => apiError(HttpStatus.BAD_REQUEST, 'PHOTO_NOT_UPLOADED', 'A photo was not uploaded');
export const wrongLocation = () => apiError(HttpStatus.FORBIDDEN, 'WRONG_LOCATION', 'Booking belongs to another location');
export const bikeNotAvailable = () => apiError(HttpStatus.CONFLICT, 'BIKE_NOT_AVAILABLE', 'Bike is busy, in repair or of another model');
export const actExists = () => apiError(HttpStatus.CONFLICT, 'ACT_EXISTS', 'Handover act already exists');
export const deductionTooLarge = () => apiError(HttpStatus.BAD_REQUEST, 'DEDUCTION_TOO_LARGE', 'Deductions exceed the deposit held');
export const mileageLower = () => apiError(HttpStatus.BAD_REQUEST, 'MILEAGE_LOWER', 'Mileage is lower than at handover');

export const obj = (body: unknown): Record<string, unknown> => (body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {});

export function int(v: unknown, name: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) throw badRequest(`${name} must be an integer in ${min}..${max}`);
  return v;
}

export function text(v: unknown, name: string, max: number, required = false): string | null {
  if (v === undefined || v === null || v === '') {
    if (required) throw badRequest(`${name} is required`);
    return null;
  }
  if (typeof v !== 'string' || v.length > max) throw badRequest(`${name} must be a string up to ${max} chars`);
  const t = v.trim();
  if (required && !t) throw badRequest(`${name} is required`);
  return t || null;
}

/** Ключи фото принадлежат этой брони: `acts/<bookingId>/…`; чужой ключ нельзя подложить в акт. */
export function photoKeys(v: unknown, bookingId: string, min: number, max: number): string[] {
  if (v === undefined && min === 0) return [];
  if (!Array.isArray(v) || v.length < min || v.length > max) {
    if (max === HANDOVER_PHOTOS_MAX) throw photosCount();
    throw badRequest(`photos: up to ${max}`);
  }
  const prefix = `acts/${bookingId}/`;
  const keys = v.map((k) => {
    if (typeof k !== 'string' || !k.startsWith(prefix) || k.length > 200 || !/^[A-Za-z0-9._/-]+$/.test(k) || k.includes('..')) throw badRequest('photos: invalid key');
    return k;
  });
  if (new Set(keys).size !== keys.length) throw badRequest('photos: duplicates');
  return keys;
}

export const DEDUCTION_PHOTOS = DEDUCTION_PHOTOS_MAX;

export const isOverlap = (e: unknown): boolean => /23P01|bookings_bike_no_overlap/.test(`${(e as { message?: string })?.message ?? ''} ${JSON.stringify((e as { meta?: unknown })?.meta ?? '')}`);
