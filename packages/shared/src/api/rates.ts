// Типы API модуля `rates`: GET /rates (без авторизации).
/** Курсы: единиц валюты за 1 VND (как `rate` в formatPrice). `updatedAt` — ISO момента последнего обновления из источника; null — используются запасные значения из настроек. */
export interface RatesResponse {
  RUB: number;
  USD: number;
  updatedAt: string | null;
}
