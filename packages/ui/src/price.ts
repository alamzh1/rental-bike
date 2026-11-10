import { formatPrice } from '@rental/i18n';
import type { Currency, Lang } from '@rental/shared';

export interface DisplayCurrency {
  currency: Currency;
  /** Единиц валюты за 1 VND (как в formatPrice). */
  rate: number;
}

/** Сумма в донгах и пересчёт («≈ 530 ₽») по отдельности, чтобы пересчёт шёл вторым цветом. */
export function splitPrice(vnd: number, lang: Lang, display?: DisplayCurrency): { main: string; approx: string | null } {
  const main = formatPrice(vnd, lang);
  if (!display || display.currency === 'VND') return { main, approx: null };
  const full = formatPrice(vnd, lang, display);
  const rest = full.slice(main.length).trim().replace(/^\(/, '').replace(/\)$/, '');
  return { main, approx: rest === '' ? null : rest };
}
