import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { RatesResponse } from '@rental/shared';
import { Clock } from '../jobs/clock';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { FALLBACK_RATES, type RatesProvider } from './rates.provider';

export const JOB_RATES_REFRESH = 'rates.refresh';
const DAY_MS = 24 * 3_600_000;
const FETCH_TIMEOUT_MS = 10_000;
/** Открытый источник без ключа: курсы относительно VND (поле rates.RUB / rates.USD — единиц валюты за 1 VND). */
export const RATES_SOURCE_URL = 'https://open.er-api.com/v6/latest/VND';

const isRate = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;

/** Курсы из Setting `rates`; ежедневное обновление из открытого источника, при сбое остаётся прежнее значение. */
@Injectable()
export class RatesService implements RatesProvider, OnApplicationBootstrap {
  private readonly log = new Logger('Rates');

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobsService,
    private readonly clock: Clock,
  ) {
    this.jobs.every(JOB_RATES_REFRESH, DAY_MS, async () => {
      await this.refresh();
    });
  }

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.VITEST) return;
    const { updatedAt } = await this.info().catch(() => ({ updatedAt: null }));
    if (!updatedAt || this.clock.now().getTime() - new Date(updatedAt).getTime() > DAY_MS) void this.refresh();
  }

  async info(): Promise<RatesResponse> {
    const row = await this.prisma.setting.findUnique({ where: { key: 'rates' } });
    const v = (row?.value && typeof row.value === 'object' ? row.value : {}) as Record<string, unknown>;
    return {
      RUB: isRate(v.RUB) ? v.RUB : FALLBACK_RATES.RUB,
      USD: isRate(v.USD) ? v.USD : FALLBACK_RATES.USD,
      updatedAt: typeof v.updatedAt === 'string' ? v.updatedAt : null,
    };
  }

  async get(): Promise<Record<'RUB' | 'USD', number>> {
    const { RUB, USD } = await this.info();
    return { RUB, USD };
  }

  /** Обновить курс из источника. Возвращает true, если значение записано; при любом сбое Setting не меняется; курс, заданный вручную, не трогается. */
  async refresh(): Promise<boolean> {
    try {
      const saved = await this.prisma.setting.findUnique({ where: { key: 'rates' } });
      if ((saved?.value as { manual?: unknown } | null)?.manual === true) return false;
      const res = await fetch(RATES_SOURCE_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { rates?: Record<string, unknown> };
      const { RUB, USD } = body.rates ?? {};
      if (!isRate(RUB) || !isRate(USD)) throw new Error('unexpected response');
      const value = { RUB, USD, updatedAt: this.clock.now().toISOString() } satisfies Prisma.InputJsonObject;
      await this.prisma.setting.upsert({ where: { key: 'rates' }, create: { key: 'rates', value }, update: { value, isDemo: false } });
      return true;
    } catch (e) {
      this.log.warn(`Курс не обновлён, остаётся прежний: ${(e as Error).message}`);
      return false;
    }
  }
}
