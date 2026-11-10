import { formatInTimeZone } from 'date-fns-tz';
import type { Currency, Lang } from '@rental/shared';

// Форматы по таблице ТЗ §7. Собраны вручную, а не через Intl: результат не зависит от версии ICU в Node/браузере.
const NB = ' ';

const GROUP: Record<Lang, string> = { ru: NB, en: ',', vi: '.' };
const DECIMAL: Record<Lang, string> = { ru: ',', en: '.', vi: ',' };

function formatNumber(value: number, lang: Lang, fractionDigits = 0): string {
  const fixed = Math.abs(value).toFixed(fractionDigits);
  const [int = '0', frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, GROUP[lang]);
  const sign = value < 0 ? '-' : '';
  return sign + (frac ? `${grouped}${DECIMAL[lang]}${frac}` : grouped);
}

function formatConverted(amount: number, currency: Exclude<Currency, 'VND'>, lang: Lang): string {
  if (currency === 'RUB') return `${formatNumber(Math.round(amount), lang)}${NB}₽`;
  const usd = formatNumber(amount, lang, 2);
  return lang === 'en' ? `$${usd}` : `${usd}${NB}$`;
}

/**
 * Сумма в VND по языку; при валюте отображения RUB/USD — пересчёт с «≈».
 * `rate` — сколько единиц валюты отображения в 1 VND. Пробелы — неразрывные.
 * «150 000 ₫ (≈ 530 ₽)» · «150,000 ₫ (≈ $5.70)» · «150.000 ₫»
 */
export function formatPrice(vnd: number, lang: Lang, display?: { currency: Currency; rate: number }): string {
  const main = `${formatNumber(Math.round(vnd), lang)}${NB}₫`;
  if (!display || display.currency === 'VND') return main;
  return `${main} (≈${NB}${formatConverted(vnd * display.rate, display.currency, lang)})`;
}

const DATE_PATTERN: Record<Lang, string> = { ru: 'dd.MM.yyyy', en: 'd MMM yyyy', vi: 'dd/MM/yyyy' };
const TIME_PATTERN: Record<Lang, string> = { ru: 'HH:mm', en: 'h:mm a', vi: 'HH:mm' };

/** 12.11.2026 / 12 Nov 2026 / 12/11/2026 — в часовом поясе точки. */
export function formatDate(d: Date, lang: Lang, tz: string): string {
  return formatInTimeZone(d, tz, DATE_PATTERN[lang]);
}

/** 14:30 / 2:30 PM / 14:30 — в часовом поясе точки. */
export function formatTime(d: Date, lang: Lang, tz: string): string {
  return formatInTimeZone(d, tz, TIME_PATTERN[lang]);
}
