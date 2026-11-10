import { Injectable } from '@nestjs/common';
import type { Tariff } from '@prisma/client';
import { quote, rentalDays, type ExtraInput, type Quote, type QuoteExtraRequest, type SeasonRuleInput, type TariffBracket } from '@rental/shared';
import { PrismaService } from '../prisma/prisma.service';
import { badRequest, notFound } from '../auth/api-errors';
import { loadSettings } from './settings';

// Цена — только через shared.quote (одна функция для API и клиента). Здесь — загрузка тарифов, сезонов, опций и настроек.

export interface PricedModel {
  id: string;
  locationId: string;
  deposit: number;
  tariffs: Pick<Tariff, 'minDays' | 'maxDays' | 'pricePerDay'>[];
}

export interface QuoteOptions {
  delivery?: boolean;
}

export function toBrackets(tariffs: PricedModel['tariffs']): TariffBracket[] {
  return [...tariffs].sort((a, b) => a.minDays - b.minDays).map((t) => ({ minDays: t.minDays, maxDays: t.maxDays, pricePerDay: t.pricePerDay }));
}

/** Цена в день без дат — тариф на 1 сутки (или ближайший с меньшим minDays). */
export function basePricePerDay(tariffs: PricedModel['tariffs']): number {
  const sorted = toBrackets(tariffs);
  return (sorted.find((t) => t.minDays <= 1 && (t.maxDays === null || t.maxDays >= 1)) ?? sorted[0])?.pricePerDay ?? 0;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private async seasons(locationIds: string[]): Promise<Map<string, SeasonRuleInput[]>> {
    const rows = await this.prisma.seasonRule.findMany({ where: { OR: [{ locationId: null }, { locationId: { in: locationIds } }] } });
    const out = new Map<string, SeasonRuleInput[]>();
    for (const id of locationIds) {
      out.set(
        id,
        rows.filter((r) => r.locationId === null || r.locationId === id).map((r) => ({ from: ymd(r.from), to: ymd(r.to), coefficient: r.coefficient })),
      );
    }
    return out;
  }

  private async timezones(locationIds: string[]): Promise<Map<string, string>> {
    const rows = await this.prisma.location.findMany({ where: { id: { in: locationIds } }, select: { id: true, timezone: true } });
    return new Map(rows.map((r) => [r.id, r.timezone]));
  }

  /** Аренда без опций для списка моделей — для каталога: итог совпадает с POST /quotes без опций. */
  async rentQuotes(models: PricedModel[], startAt: Date, endAt: Date): Promise<Map<string, Quote>> {
    const locationIds = [...new Set(models.map((m) => m.locationId))];
    const [seasons, tz, settings] = await Promise.all([this.seasons(locationIds), this.timezones(locationIds), loadSettings(this.prisma, ['depositMode'])]);
    const out = new Map<string, Quote>();
    for (const m of models) {
      if (m.tariffs.length === 0) continue;
      out.set(
        m.id,
        quote({
          startAt,
          endAt,
          timezone: tz.get(m.locationId) ?? 'Asia/Ho_Chi_Minh',
          tariffs: toBrackets(m.tariffs),
          seasons: seasons.get(m.locationId) ?? [],
          extras: [],
          deposit: settings.depositMode === 'MONEY' ? m.deposit : 0,
        }),
      );
    }
    return out;
  }

  /** Полный расчёт: аренда × сутки (тариф по длительности, сезон), опции, доставка, депозит отдельной строкой. */
  async quoteFor(modelId: string, startAt: Date, endAt: Date, extras: QuoteExtraRequest[] = [], opts: QuoteOptions = {}): Promise<Quote> {
    if (!(endAt.getTime() > startAt.getTime())) throw badRequest('endAt must be after startAt');
    const model = await this.prisma.bikeModel.findFirst({
      where: { id: modelId, isActive: true },
      select: { id: true, locationId: true, deposit: true, tariffs: true, location: { select: { timezone: true } } },
    });
    if (!model) throw notFound('Model not found');
    if (model.tariffs.length === 0) throw badRequest('Model has no tariffs');

    const settings = await loadSettings(this.prisma, ['minRentDays', 'depositMode', 'deliveryFee']);
    if (rentalDays(startAt, endAt) < settings.minRentDays) throw badRequest(`Minimum rental is ${settings.minRentDays} day(s)`);

    const ids = extras.map((e) => e.id);
    if (new Set(ids).size !== ids.length) throw badRequest('Duplicate extras');
    const rows = ids.length ? await this.prisma.extra.findMany({ where: { id: { in: ids }, isActive: true } }) : [];
    const extraInputs: ExtraInput[] = extras.map((e) => {
      const row = rows.find((r) => r.id === e.id);
      if (!row) throw badRequest(`Unknown extra ${e.id}`);
      if (!Number.isInteger(e.qty) || e.qty < 0 || e.qty > row.maxQty) throw badRequest(`Extra ${row.code}: qty must be 0..${row.maxQty}`);
      return { id: row.id, price: row.price, per: row.per, qty: e.qty };
    });

    let delivery = 0;
    if (opts.delivery) {
      if (settings.deliveryFee === null) throw badRequest('Delivery is not available');
      delivery = settings.deliveryFee;
    }

    const seasons = (await this.seasons([model.locationId])).get(model.locationId) ?? [];
    return quote({
      startAt,
      endAt,
      timezone: model.location.timezone,
      tariffs: toBrackets(model.tariffs),
      seasons,
      extras: extraInputs,
      deposit: settings.depositMode === 'MONEY' ? model.deposit : 0,
      delivery,
    });
  }
}
