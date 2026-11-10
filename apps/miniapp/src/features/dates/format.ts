import type { Lang } from '@rental/shared';

const LOCALE: Record<Lang, string> = { ru: 'ru-RU', en: 'en-GB', vi: 'vi-VN' };

const dayMonth = (d: Date, lang: Lang, timeZone: string) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'long', timeZone }).format(d);

/** «12 ноября» · «12 Nov»: короткая дата для «Занят до …». */
export function formatShortDate(d: Date, lang: Lang, timeZone: string): string {
  return new Intl.DateTimeFormat(LOCALE[lang], { day: 'numeric', month: 'short', timeZone }).format(d);
}

/** «12–17 ноября» · «28 ноября – 3 декабря» · «12 ноября» — по календарю точки. */
export function formatRangeShort(from: Date, to: Date, lang: Lang, timeZone: string): string {
  const a = dayMonth(from, lang, timeZone);
  const b = dayMonth(to, lang, timeZone);
  if (a === b) return a;
  const [dayA, restA] = splitDay(a);
  const [, restB] = splitDay(b);
  if (restA === restB) return `${dayA}–${b}`;
  return `${a} – ${b}`;
}

function splitDay(s: string): [string, string] {
  const m = /^(\d+)\s*(.*)$/.exec(s);
  return [m?.[1] ?? s, m?.[2] ?? ''];
}
