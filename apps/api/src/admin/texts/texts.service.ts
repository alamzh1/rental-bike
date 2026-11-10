import { Injectable } from '@nestjs/common';
import { HttpStatus } from '@nestjs/common';
import { flattenKeys, resources } from '@rental/i18n';
import { LANGS, type AdminTextList, type AdminTextRow, type Lang } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { badRequest } from '../../auth/api-errors';
import { apiError } from '../../bookings/errors';
import { writeAudit } from '../../bookings/audit';
import type { AdminUser } from '../auth';
import { actorOf, asBody, oneOf, str } from '../fleet/input';

// Тексты интерфейса: правки ключей (I18nOverride) поверх JSON packages/i18n; GET /i18n/{lang} отдаёт объединённый словарь.

const MAX_VALUE = 5000;

/** Плейсхолдеры ICU верхнего уровня: {name}, {count, plural, …}. */
export function placeholders(s: string): string[] {
  return [...new Set([...s.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)].map((m) => m[1]!))].sort();
}

let base: Record<Lang, Record<string, string>> | null = null;
function baseDictionary(): Record<Lang, Record<string, string>> {
  base ??= Object.fromEntries(LANGS.map((l) => [l, Object.fromEntries(Object.entries(flattenKeys(resources[l] as never)).filter(([k]) => !k.startsWith('bot.')))])) as Record<Lang, Record<string, string>>;
  return base;
}

@Injectable()
export class TextsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<AdminTextList> {
    const dict = baseDictionary();
    const overrides = await this.prisma.i18nOverride.findMany({ select: { lang: true, key: true, value: true } });
    const byKey = new Map<string, Partial<Record<Lang, string>>>();
    for (const o of overrides) byKey.set(o.key, { ...byKey.get(o.key), [o.lang]: o.value });
    const items: AdminTextRow[] = Object.keys(dict.en)
      .sort()
      .map((key) => ({ key, base: { ru: dict.ru[key] ?? '', en: dict.en[key] ?? '', vi: dict.vi[key] ?? '' }, override: byKey.get(key) ?? {} }));
    return { items, total: items.length };
  }

  /** Сохранить правку ключа; пустое значение удаляет её (вернётся текст из JSON). */
  async save(user: AdminUser, body: unknown): Promise<AdminTextRow> {
    const b = asBody(body);
    const lang = oneOf(b.lang, 'lang', LANGS);
    const key = str(b.key, 'key', 200);
    const dict = baseDictionary();
    if (dict.en[key] === undefined) throw apiError(HttpStatus.BAD_REQUEST, 'UNKNOWN_KEY', `Unknown key ${key}`);
    const value = typeof b.value === 'string' ? b.value.trim() : b.value === null || b.value === undefined ? '' : null;
    if (value === null) throw badRequest('value must be a string or null');
    if (value.length > MAX_VALUE) throw badRequest(`value is longer than ${MAX_VALUE}`);
    if (value) {
      const need = placeholders(dict[lang][key] || dict.en[key]!);
      const missing = need.filter((p) => !placeholders(value).includes(p));
      if (missing.length) throw badRequest(`value must keep placeholders: ${missing.map((p) => `{${p}}`).join(', ')}`);
      await this.prisma.i18nOverride.upsert({ where: { lang_key: { lang, key } }, create: { lang, key, value }, update: { value } });
    } else {
      await this.prisma.i18nOverride.deleteMany({ where: { lang, key } });
    }
    await writeAudit(this.prisma, actorOf(user), value ? 'text.override' : 'text.reset', 'I18nOverride', `${lang}:${key}`, { lang, key, value: value || null });
    const rows = await this.prisma.i18nOverride.findMany({ where: { key }, select: { lang: true, value: true } });
    return { key, base: { ru: dict.ru[key] ?? '', en: dict.en[key] ?? '', vi: dict.vi[key] ?? '' }, override: Object.fromEntries(rows.map((r) => [r.lang, r.value])) };
  }
}
