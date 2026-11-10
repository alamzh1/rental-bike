import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { APIRequestContext, Page } from '@playwright/test';
import { E2E } from '../ports.mjs';

export type Lang = 'ru' | 'en' | 'vi';
export const LANGS: Lang[] = ['ru', 'en', 'vi'];

const localesDir = fileURLToPath(new URL('../../packages/i18n/locales', import.meta.url));
const dict: Record<Lang, Record<string, unknown>> = { ru: {}, en: {}, vi: {} };
for (const lang of LANGS) {
  for (const file of readdirSync(join(localesDir, lang))) {
    dict[lang][file.replace(/\.json$/, '')] = JSON.parse(readFileSync(join(localesDir, lang, file), 'utf8'));
  }
}

/** Текст ключа из packages/i18n (тот же источник, что у приложения). */
export function tx(lang: Lang, key: string): string {
  const value = key.split('.').reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], dict[lang]);
  if (typeof value !== 'string') throw new Error(`нет ключа ${lang}:${key}`);
  return value;
}

/** Неизменяемая часть ICU-строки до первого параметра: «Оплатить {amount}» → «Оплатить». */
export function txPrefix(lang: Lang, key: string): string {
  return tx(lang, key).split('{')[0]!.trim();
}

export const apiUrl = (path: string) => `http://localhost:${E2E.apiPort}/api${path}`;

/** Вход тестовым клиентом через API (DEV_AUTH=1) — для подготовки состояния, не для проверяемого пути. */
export async function devToken(request: APIRequestContext, devUser: 'client' | 'manager' = 'client'): Promise<string> {
  const res = await request.post(apiUrl('/auth/telegram'), { data: { devUser } });
  if (!res.ok()) throw new Error(`auth ${res.status()}`);
  return ((await res.json()) as { token: string }).token;
}

export async function patchMe(request: APIRequestContext, token: string, data: Record<string, unknown>): Promise<void> {
  const res = await request.patch(apiUrl('/me'), { data, headers: { authorization: `Bearer ${token}` } });
  if (!res.ok()) throw new Error(`PATCH /me ${res.status()}`);
}

/** Фото документов через API, как их загружает приложение: без них бронь не создаётся. */
export async function uploadDocuments(request: APIRequestContext, token: string): Promise<void> {
  for (const type of ['PASSPORT', 'LICENSE']) {
    const res = await request.post(apiUrl('/documents'), { headers: { authorization: `Bearer ${token}` }, data: { type, contentType: 'image/png', consent: true } });
    if (!res.ok()) throw new Error(`POST /documents ${res.status()}`);
    const slot = (await res.json()) as { uploadUrl: string; headers: Record<string, string> };
    const put = await request.put(slot.uploadUrl, { headers: slot.headers, data: Buffer.from('e2e-document') });
    if (!put.ok()) throw new Error(`PUT документа ${put.status()}`);
  }
}

/**
 * Обрезанный текст на экране: элементы с текстом, у которых содержимое шире/выше бокса при скрытом
 * переполнении, или многоточие. Исключение по DESIGN.md — название модели в сетке (data-allow-truncate).
 */
export async function clippedText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    const vw = document.documentElement.clientWidth;
    for (const el of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
      if (!el.childNodes.length || el.closest('[aria-hidden="true"], .sr-only, [data-allow-truncate]')) continue;
      const ownText = Array.from(el.childNodes).some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim() !== '');
      if (!ownText) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const label = `${el.tagName.toLowerCase()} «${el.textContent!.trim().slice(0, 60)}»`;
      const hides = (v: string) => v === 'hidden' || v === 'clip';
      if ((hides(cs.overflowX) || cs.textOverflow === 'ellipsis') && el.scrollWidth > el.clientWidth + 1) out.push(`${label}: ширина ${el.scrollWidth} > ${el.clientWidth}`);
      else if (hides(cs.overflowY) && el.scrollHeight > el.clientHeight + 1 && cs.webkitLineClamp === 'none') out.push(`${label}: высота ${el.scrollHeight} > ${el.clientHeight}`);
      else if (cs.webkitLineClamp !== 'none' && el.scrollHeight > el.clientHeight + 1) out.push(`${label}: line-clamp`);
      // Не в горизонтальной ленте (overflow-x: auto у предка) — текст не должен выходить за экран.
      if (rect.right > vw + 1 || rect.left < -1) {
        let p: HTMLElement | null = el.parentElement;
        let inScroller = false;
        while (p) {
          const o = getComputedStyle(p).overflowX;
          if (o === 'auto' || o === 'scroll') inScroller = true;
          p = p.parentElement;
        }
        if (!inScroller) out.push(`${label}: за краем экрана (${Math.round(rect.left)}…${Math.round(rect.right)} из ${vw})`);
      }
    }
    if (document.documentElement.scrollWidth > vw + 1) out.push(`страница: горизонтальная прокрутка ${document.documentElement.scrollWidth} > ${vw}`);
    return out;
  });
}
