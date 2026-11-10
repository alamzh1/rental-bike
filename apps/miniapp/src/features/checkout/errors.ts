import { BOOKING_ERROR_CODES, DOCUMENT_ERROR_CODES, MANAGER_ERROR_CODES, PAYMENT_ERROR_CODES } from '@rental/shared';
import { ApiRequestError } from '../../app/session/api';

// Единственное место, где код ошибки API превращается в ключ перевода (весь Mini App: оформление, брони,
// оплата, документы, режим менеджера, экраны входа и онбординга). Коды доменов — из констант @rental/shared.

/**
 * Общие коды, которых нет в доменных константах shared: транспорт клиента (NETWORK, UNKNOWN), охрана API
 * (auth/api-errors: UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION), сбой провайдера оплаты и размер файла.
 */
const COMMON_ERROR_CODES = ['UNKNOWN', 'NETWORK', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'VALIDATION', 'PAYMENT_PROVIDER_ERROR', 'FILE_TOO_LARGE'] as const;

const ERRORS_NS: ReadonlySet<string> = new Set([...COMMON_ERROR_CODES, ...BOOKING_ERROR_CODES, ...PAYMENT_ERROR_CODES, ...DOCUMENT_ERROR_CODES]);
const MANAGER_NS: ReadonlySet<string> = new Set(MANAGER_ERROR_CODES);

/** Ключ перевода: коды режима менеджера — manager.error.*, остальные известные — errors.*, иначе errors.UNKNOWN. */
export function errorKey(code: string): string {
  if (MANAGER_NS.has(code)) return `manager.error.${code}`;
  return ERRORS_NS.has(code) ? `errors.${code}` : 'errors.UNKNOWN';
}

export function errorCode(e: unknown): string {
  return e instanceof ApiRequestError ? e.code : 'UNKNOWN';
}

/** Ошибки правил дат (минимальный срок, время до выдачи): «Повторить» не поможет — ведём к выбору дат. */
const DATE_RULE_CODES: ReadonlySet<string> = new Set(['MIN_RENT_DAYS', 'LEAD_TIME']);

/** Действие на экране ошибки расчёта цены: выбор дат или повтор запроса. */
export function quoteErrorAction(code: string): 'dates' | 'retry' {
  return DATE_RULE_CODES.has(code) ? 'dates' : 'retry';
}
