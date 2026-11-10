// Типы API модуля `analytics`: события воронки (POST /events).

/** Воронка: открытие → выбор дат → карточка → оформление → оплата (+ «Нужен байк сейчас», фильтры, избранное). */
export const ANALYTICS_EVENTS = [
  'open',
  'dates_selected',
  'model_viewed',
  'checkout_opened',
  'paid',
  'now_clicked',
  'filters_applied',
  'favorite_added',
] as const;
export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

/** POST /events → 204. `source` — источник (deeplink startapp, метка рекламы). */
export interface TrackEventRequest {
  name: AnalyticsEventName;
  props?: Record<string, string | number | boolean | null>;
  source?: string;
}
