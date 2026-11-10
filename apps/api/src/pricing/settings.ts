import type { Currency, Lang } from '@rental/shared';
import type { PrismaService } from '../prisma/prisma.service';

// Чтение правил из таблицы Setting (ключ → JSON) со значениями по умолчанию из interfaces.md.
export interface RuleSettings {
  bufferMinutes: number;
  minLeadMinutes: number;
  minRentDays: number;
  depositMode: 'MONEY' | 'DOCUMENT';
  /** VND; null — доставка недоступна */
  deliveryFee: number | null;
  defaultCurrencyByLang: Record<Lang, Currency>;
}

export const RULE_DEFAULTS: RuleSettings = {
  bufferMinutes: 60,
  minLeadMinutes: 60,
  minRentDays: 1,
  depositMode: 'MONEY',
  deliveryFee: null,
  defaultCurrencyByLang: { ru: 'RUB', en: 'USD', vi: 'VND' },
};

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;

export async function loadSettings<K extends keyof RuleSettings>(prisma: PrismaService, keys: K[]): Promise<Pick<RuleSettings, K>> {
  const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
  const out = {} as Pick<RuleSettings, K>;
  for (const key of keys) {
    const raw = rows.find((r) => r.key === key)?.value as unknown;
    const fallback = RULE_DEFAULTS[key];
    let value: unknown = fallback;
    switch (key) {
      case 'depositMode':
        value = raw === 'DOCUMENT' || raw === 'MONEY' ? raw : fallback;
        break;
      case 'deliveryFee':
        value = isNum(raw) ? Math.round(raw) : null;
        break;
      case 'defaultCurrencyByLang':
        value = raw && typeof raw === 'object' ? { ...RULE_DEFAULTS.defaultCurrencyByLang, ...(raw as object) } : fallback;
        break;
      default:
        value = isNum(raw) ? raw : fallback;
    }
    (out as Record<string, unknown>)[key] = value;
  }
  return out;
}
