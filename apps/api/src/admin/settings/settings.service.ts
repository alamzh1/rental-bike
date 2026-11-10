import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LANGS, type AdminSettingKey, type AdminSettings, type AdminSettingsResponse, type Currency, type I18nText, type PublicSettings } from '@rental/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { RatesService } from '../../rates/rates.service';
import { loadRubOffer } from '../../payments/rub-transfer';
import { BOOKING_RULE_DEFAULTS } from '../../bookings/rules';
import { badRequest } from '../../auth/api-errors';
import { writeAudit } from '../../bookings/audit';
import { Clock } from '../../jobs/clock';
import type { AdminUser } from '../auth';
import { actorOf, asBody, int, num, oneOf, optI18nText, optStr } from '../fleet/input';

// Настройки (таблица Setting, ключ → JSON). Правила читают Setting на каждый запрос (loadBookingRules, loadSettings,
// RatesService), поэтому сохранённое действует сразу, без перезапуска. Сохранение владельцем снимает «ДЕМО» с ключа.

export const SETTING_KEYS: readonly AdminSettingKey[] = [
  'holdMinutes',
  'bufferMinutes',
  'minLeadMinutes',
  'minRentDays',
  'cancel',
  'late',
  'depositMode',
  'rates',
  'docRetentionDays',
  'noShowHours',
  'cashPrepayPercent',
  'rubTransfer',
  'deliveryFee',
  'defaultCurrencyByLang',
  'managerContact',
  'contractTemplate',
  'rulesText',
  'restrictionsText',
  'privacyText',
  'faq',
];

const CURRENCIES: readonly Currency[] = ['VND', 'RUB', 'USD'];
const TEXT_KEYS = new Set<AdminSettingKey>(['contractTemplate', 'rulesText', 'restrictionsText', 'privacyText', 'faq']);
const DEFAULT_CURRENCY: Record<'ru' | 'en' | 'vi', Currency> = { ru: 'RUB', en: 'USD', vi: 'VND' };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const n = (v: unknown, d: number) => (isNum(v) ? v : d);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown): I18nText | null => {
  const o = obj(v);
  return typeof o.en === 'string' || typeof o.ru === 'string' || typeof o.vi === 'string' ? (o as I18nText) : null;
};

const rubTransferOf = (v: unknown): AdminSettings['rubTransfer'] => {
  const o = obj(v);
  return typeof o.phone === 'string' && typeof o.bank === 'string' && typeof o.recipient === 'string' ? { phone: o.phone, bank: o.bank, recipient: o.recipient, markupPercent: n(o.markupPercent, 0) } : null;
};

/** Значения с умолчаниями из interfaces.md (те же, что у читателей правил). */
export function settingsFrom(raw: Map<string, unknown>, rates: { RUB: number; USD: number }): AdminSettings {
  const d = BOOKING_RULE_DEFAULTS;
  const cancel = obj(raw.get('cancel'));
  const late = obj(raw.get('late'));
  const cur = obj(raw.get('defaultCurrencyByLang'));
  const fee = raw.get('deliveryFee');
  const contact = raw.get('managerContact');
  return {
    holdMinutes: n(raw.get('holdMinutes'), d.holdMinutes),
    bufferMinutes: n(raw.get('bufferMinutes'), d.bufferMinutes),
    minLeadMinutes: n(raw.get('minLeadMinutes'), d.minLeadMinutes),
    minRentDays: n(raw.get('minRentDays'), d.minRentDays),
    cancel: { fullHours: n(cancel.fullHours, d.cancel.fullHours), halfHours: n(cancel.halfHours, d.cancel.halfHours), halfPercent: n(cancel.halfPercent, d.cancel.halfPercent) },
    late: { graceMinutes: n(late.graceMinutes, 60), hourlyFee: n(late.hourlyFee, 0), extraDayAfterHours: n(late.extraDayAfterHours, 4) },
    depositMode: raw.get('depositMode') === 'DOCUMENT' ? 'DOCUMENT' : 'MONEY',
    rates,
    ratesManual: obj(raw.get('rates')).manual === true,
    docRetentionDays: n(raw.get('docRetentionDays'), d.docRetentionDays),
    noShowHours: n(raw.get('noShowHours'), d.noShowHours),
    cashPrepayPercent: n(raw.get('cashPrepayPercent'), d.cashPrepayPercent),
    rubTransfer: rubTransferOf(raw.get('rubTransfer')),
    deliveryFee: isNum(fee) ? Math.round(fee) : null,
    defaultCurrencyByLang: Object.fromEntries(LANGS.map((l) => [l, CURRENCIES.includes(cur[l] as Currency) ? cur[l] : DEFAULT_CURRENCY[l]])) as AdminSettings['defaultCurrencyByLang'],
    managerContact: typeof contact === 'string' && contact.trim() ? contact : null,
    contractTemplate: text(raw.get('contractTemplate')),
    rulesText: text(raw.get('rulesText')),
    restrictionsText: text(raw.get('restrictionsText')),
    privacyText: text(raw.get('privacyText')),
    faq: text(raw.get('faq')),
  };
}

/** Проверка одного ключа → JSON для Setting.value (null — сбросить значение). */
function parseSetting(key: AdminSettingKey, v: unknown, now: Date): Prisma.InputJsonValue | null {
  switch (key) {
    case 'holdMinutes':
      return int(v, key, 5, 24 * 60);
    case 'bufferMinutes':
      return int(v, key, 0, 24 * 60);
    case 'minLeadMinutes':
      return int(v, key, 0, 14 * 24 * 60);
    case 'minRentDays':
      return int(v, key, 1, 60);
    case 'docRetentionDays':
      return int(v, key, 1, 3650);
    case 'noShowHours':
      return int(v, key, 1, 72);
    case 'cashPrepayPercent':
      return int(v, key, 0, 100);
    case 'rubTransfer': {
      if (v === null) return null;
      const o = obj(v);
      const required = (x: unknown, name: string) => {
        const s = optStr(x, name, 100)?.trim();
        if (!s) throw badRequest(`${name} is required`);
        return s;
      };
      return { phone: required(o.phone, 'rubTransfer.phone'), bank: required(o.bank, 'rubTransfer.bank'), recipient: required(o.recipient, 'rubTransfer.recipient'), markupPercent: num(o.markupPercent, 'rubTransfer.markupPercent', 0, 20) };
    }
    case 'deliveryFee':
      return v === null ? null : int(v, key, 0, 100_000_000);
    case 'depositMode':
      return oneOf(v, key, ['MONEY', 'DOCUMENT'] as const);
    case 'cancel': {
      const o = obj(v);
      const c = { fullHours: int(o.fullHours, 'cancel.fullHours', 0, 24 * 30), halfHours: int(o.halfHours, 'cancel.halfHours', 0, 24 * 30), halfPercent: int(o.halfPercent, 'cancel.halfPercent', 0, 100) };
      if (c.halfHours > c.fullHours) throw badRequest('cancel.halfHours must not exceed cancel.fullHours');
      return c;
    }
    case 'late': {
      const o = obj(v);
      return { graceMinutes: int(o.graceMinutes, 'late.graceMinutes', 0, 24 * 60), hourlyFee: int(o.hourlyFee, 'late.hourlyFee', 0, 100_000_000), extraDayAfterHours: int(o.extraDayAfterHours, 'late.extraDayAfterHours', 1, 24) };
    }
    case 'rates': {
      const o = obj(v);
      const RUB = num(o.RUB, 'rates.RUB', 1e-9, 1);
      const USD = num(o.USD, 'rates.USD', 1e-9, 1);
      if (RUB === 0 || USD === 0) throw badRequest('rates must be positive');
      // Сохранённый владельцем курс не перезаписывается ежедневным обновлением, пока он сам его не вернёт
      return { RUB, USD, updatedAt: now.toISOString(), manual: o.auto !== true };
    }
    case 'defaultCurrencyByLang': {
      const o = obj(v);
      return Object.fromEntries(LANGS.map((l) => [l, oneOf(o[l], `defaultCurrencyByLang.${l}`, CURRENCIES)]));
    }
    case 'managerContact':
      return optStr(v, key, 200);
    case 'contractTemplate':
    case 'rulesText':
    case 'restrictionsText':
    case 'privacyText':
    case 'faq':
      return optI18nText(v, key, { max: 50_000 }) as Prisma.InputJsonObject | null;
  }
}

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rates: RatesService,
    private readonly clock: Clock,
  ) {}

  private async read(keys: readonly string[]): Promise<{ values: AdminSettings; demo: AdminSettingKey[] }> {
    const [rows, rates] = await Promise.all([this.prisma.setting.findMany({ where: { key: { in: [...keys] } } }), this.rates.info()]);
    const values = settingsFrom(new Map(rows.map((r) => [r.key, r.value])), { RUB: rates.RUB, USD: rates.USD });
    return { values, demo: rows.filter((r) => r.isDemo).map((r) => r.key as AdminSettingKey) };
  }

  get(): Promise<AdminSettingsResponse> {
    return this.read(SETTING_KEYS);
  }

  /** Частичное сохранение: каждый переданный ключ проверяется и пишется с isDemo = false; неизвестный ключ → 400. */
  async patch(user: AdminUser, body: unknown): Promise<AdminSettingsResponse> {
    const b = asBody(body);
    const keys = Object.keys(b).filter((k) => b[k] !== undefined);
    if (!keys.length) throw badRequest('Nothing to save');
    const unknown = keys.filter((k) => !SETTING_KEYS.includes(k as AdminSettingKey));
    if (unknown.length) throw badRequest(`Unknown settings: ${unknown.join(', ')}`);
    const now = this.clock.now();
    const parsed = keys.map((k) => [k, parseSetting(k as AdminSettingKey, b[k], now)] as const);
    const before = await this.prisma.setting.findMany({ where: { key: { in: keys } } });
    await this.prisma.$transaction(async (tx) => {
      for (const [key, v] of parsed) {
        const value = v === null ? Prisma.JsonNull : v;
        await tx.setting.upsert({ where: { key }, create: { key, value, isDemo: false }, update: { value, isDemo: false } });
      }
      const diff = Object.fromEntries(
        parsed.map(([k, v]) => [k, TEXT_KEYS.has(k as AdminSettingKey) ? { changed: true } : { from: before.find((r) => r.key === k)?.value ?? null, to: v }]),
      );
      await writeAudit(tx, actorOf(user), 'settings.update', 'Setting', null, diff);
    });
    return this.get();
  }

  /** GET /settings/public — тексты, контакт, доставка, предоплата наличных, валюты по языку, курсы (RatesService.info()). */
  async publicSettings(): Promise<PublicSettings> {
    const keys = ['faq', 'rulesText', 'privacyText', 'managerContact', 'deliveryFee', 'cashPrepayPercent', 'defaultCurrencyByLang'];
    const [rows, rates, offer] = await Promise.all([this.prisma.setting.findMany({ where: { key: { in: keys } } }), this.rates.info(), loadRubOffer(this.prisma, this.clock.now())]);
    const v = settingsFrom(new Map(rows.map((r) => [r.key, r.value])), { RUB: rates.RUB, USD: rates.USD });
    return {
      faq: v.faq,
      rulesText: v.rulesText,
      privacyText: v.privacyText,
      managerContact: v.managerContact,
      deliveryFee: v.deliveryFee,
      cashPrepayPercent: v.cashPrepayPercent,
      defaultCurrencyByLang: v.defaultCurrencyByLang,
      rates,
      rubTransfer: offer ? { rubPerVnd: offer.rubPerVnd } : null,
    };
  }
}
