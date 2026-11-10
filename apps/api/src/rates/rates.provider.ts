import type { RatesResponse } from '@rental/shared';

/** Курсы VND→RUB/USD: единиц валюты за 1 VND (как `rate` в formatPrice). */
export interface RatesProvider {
  get(): Promise<Record<'RUB' | 'USD', number>>;
}

export const RATES_PROVIDER = Symbol('RATES_PROVIDER');

/** Запасные значения, если в Setting `rates` пусто: демо из ТЗ §7 (150 000 ₫ ≈ 530 ₽ ≈ $5.70). Не рыночный курс. */
export const FALLBACK_RATES: Pick<RatesResponse, 'RUB' | 'USD'> = { RUB: 0.003533, USD: 0.000038 };
