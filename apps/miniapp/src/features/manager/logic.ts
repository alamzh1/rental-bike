import { HANDOVER_PHOTOS_MAX, HANDOVER_PHOTOS_MIN } from '@rental/shared';

// Чистая логика режима менеджера: разбор QR, проверки форм, ключи ошибок. Без React — проверяется юнит-тестами.

export const PHOTOS_MIN = HANDOVER_PHOTOS_MIN;
export const PHOTOS_MAX = HANDOVER_PHOTOS_MAX;
export const FUEL_STEPS = [0, 25, 50, 75, 100] as const;

const CODE_RE = /BK-\d{5,}/i;

/**
 * Код брони из текста QR (код или ссылка с кодом) либо из ручного ввода: «bk-24117», «24117» → BK-24117.
 * Пусто → null. Прочее возвращается как есть: сервер ответит NOT_FOUND.
 */
export function extractBookingCode(raw: string): string | null {
  const text = raw.trim();
  if (!text) return null;
  const found = CODE_RE.exec(text);
  if (found) return found[0].toUpperCase();
  if (/^\d{5,}$/.test(text)) return `BK-${text}`;
  return text;
}

/** Целое из поля ввода: пробелы в разрядах допустимы; пусто, дробь, минус → null. */
export function parseWhole(raw: string): number | null {
  const s = raw.replace(/[\s\u00a0]/g, '');
  if (!/^\d{1,9}$/.test(s)) return null;
  return Number(s);
}

export type PhotoVerdict = 'few' | 'ok' | 'many';
export function photoVerdict(count: number): PhotoVerdict {
  return count < PHOTOS_MIN ? 'few' : count > PHOTOS_MAX ? 'many' : 'ok';
}

export interface ActDraft {
  mileage: string;
  fuel: number | null;
  photoCount: number;
  uploading: boolean;
}

const actReady = (d: ActDraft): boolean => parseWhole(d.mileage) !== null && d.fuel !== null && photoVerdict(d.photoCount) === 'ok' && !d.uploading;

export const canSubmitHandover = (d: ActDraft & { bikeId: string | null }): boolean => !!d.bikeId && actReady(d);

export interface DeductionDraft {
  amount: string;
  reason: string;
  uploading: boolean;
}

export const deductionsTotal = (list: DeductionDraft[]): number => list.reduce((s, d) => s + (parseWhole(d.amount) ?? 0), 0);

export function canSubmitReturn(d: ActDraft & { deductions: DeductionDraft[]; depositHeld: number }): boolean {
  if (!actReady(d)) return false;
  if (d.deductions.some((x) => x.uploading || parseWhole(x.amount) === null || parseWhole(x.amount) === 0 || !x.reason.trim())) return false;
  return deductionsTotal(d.deductions) <= d.depositHeld;
}

/** Депозит, который уже внесён: платежи сверх аренды, но не больше депозита (как на сервере). */
export const depositHeld = (paid: number, total: number, deposit: number): number => Math.min(deposit, Math.max(0, paid - total));

