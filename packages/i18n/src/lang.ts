import type { I18nText, Lang } from '@rental/shared';

const RU_GROUP = new Set(['ru', 'uk', 'be', 'kk']);

/** Язык по language_code из Telegram (ТЗ §7): ru, uk, be, kk → ru; vi → vi; остальные → en. */
export function detectLang(languageCode?: string): Lang {
  const base = (languageCode ?? '').toLowerCase().split(/[-_]/)[0] ?? '';
  if (RU_GROUP.has(base)) return 'ru';
  if (base === 'vi') return 'vi';
  return 'en';
}

/** Текст из админки на нужном языке; нет перевода — EN. */
export function pickText(t: I18nText, lang: Lang): string {
  const own = t[lang];
  if (own && own.trim() !== '') return own;
  return t.en ?? '';
}
