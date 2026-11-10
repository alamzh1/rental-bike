import { describe, expect, it } from 'vitest';
import { flattenKeys, resources } from '@rental/i18n';
import { BOOKING_ERROR_CODES, DOCUMENT_ERROR_CODES, MANAGER_ERROR_CODES, PAYMENT_ERROR_CODES } from '@rental/shared';
import { errorKey } from '../src/features/checkout/errors';

// Один errorKey для всего Mini App: коды из констант @rental/shared → errors.* или manager.error.*,
// неизвестный код → errors.UNKNOWN. У каждого кода есть перевод во всех трёх языках.
const SHARED_CODES = [...BOOKING_ERROR_CODES, ...PAYMENT_ERROR_CODES, ...DOCUMENT_ERROR_CODES, ...MANAGER_ERROR_CODES];
const flat = { ru: flattenKeys(resources.ru), en: flattenKeys(resources.en), vi: flattenKeys(resources.vi) };

describe('errorKey', () => {
  it.each(SHARED_CODES.map((c) => [c]))('%s — свой ключ (не UNKNOWN) с переводом ru/en/vi', (code) => {
    const key = errorKey(code);
    expect(key).not.toBe('errors.UNKNOWN');
    for (const lang of ['ru', 'en', 'vi'] as const) expect(flat[lang][key], `${lang}: ${key}`).toBeTruthy();
  });

  it.each([['NETWORK'], ['UNAUTHORIZED'], ['FORBIDDEN'], ['NOT_FOUND'], ['VALIDATION'], ['PAYMENT_PROVIDER_ERROR'], ['FILE_TOO_LARGE']])(
    '%s — общий код транспорта и API → errors.*',
    (code) => {
      expect(errorKey(code)).toBe(`errors.${code}`);
      for (const lang of ['ru', 'en', 'vi'] as const) expect(flat[lang][`errors.${code}`]).toBeTruthy();
    },
  );

  it('коды режима менеджера → manager.error.*', () => {
    expect(errorKey('PHOTOS_COUNT')).toBe('manager.error.PHOTOS_COUNT');
    expect(errorKey('WRONG_LOCATION')).toBe('manager.error.WRONG_LOCATION');
  });

  it('неизвестный код и служебные имена → errors.UNKNOWN', () => {
    expect(errorKey('BOOM')).toBe('errors.UNKNOWN');
    expect(errorKey('toString')).toBe('errors.UNKNOWN');
    expect(errorKey('')).toBe('errors.UNKNOWN');
  });
});
