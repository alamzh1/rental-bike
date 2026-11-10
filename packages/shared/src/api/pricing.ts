// Типы API модуля `pricing`: POST /quotes → Quote (расчёт shared.quote).
import type { Quote } from '../pricing.js';

export interface QuoteExtraRequest {
  id: string;
  qty: number;
}

/** POST /quotes. Даты — ISO UTC. `delivery: true` — доставка в отель по цене из настроек. */
export interface QuoteRequest {
  modelId: string;
  startAt: string;
  endAt: string;
  extras?: QuoteExtraRequest[];
  delivery?: boolean;
}

export type QuoteResponse = Quote;
