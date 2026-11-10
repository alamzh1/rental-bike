import type { Lang } from '@rental/shared';

const LOCALE: Record<Lang, string> = { ru: 'ru-RU', en: 'en-US', vi: 'vi-VN' };

/** Точная сумма перевода в рублях: без пересчётов и знака «≈». */
export function formatRub(rub: number, lang: Lang): string {
  return `${new Intl.NumberFormat(LOCALE[lang]).format(rub)}\u00a0₽`;
}
