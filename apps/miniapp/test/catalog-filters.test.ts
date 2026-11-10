import { describe, expect, it } from 'vitest';
import { activeCount, EMPTY_FILTERS, parseFilters, toParams } from '../src/features/catalog/filters';
import { parseRange, rangeToParams, isRangeUsable } from '../src/features/dates/range';
import { formatRangeShort } from '../src/features/dates/format';

describe('фильтры каталога ↔ query-строка API', () => {
  it('разбирает списки через запятую и отбрасывает неизвестные значения', () => {
    const f = parseFilters(new URLSearchParams('type=AUTOMATIC,BOGUS&cc=110-125&priceMin=100000&brand=Honda,Yamaha&options=ABS&sort=price_asc&category=SCOOTER&q=%20vision%20'));
    expect(f).toEqual({
      q: 'vision',
      category: ['SCOOTER'],
      type: ['AUTOMATIC'],
      cc: ['110-125'],
      priceMin: 100000,
      brand: ['Honda', 'Yamaha'],
      options: ['ABS'],
      sort: 'price_asc',
    });
  });
  it('круговой обход: toParams → parseFilters', () => {
    const f = { ...EMPTY_FILTERS, type: ['MANUAL'], priceMax: 250000, brand: ['Vespa'] };
    expect(parseFilters(toParams(f))).toEqual(f);
    expect(toParams(f).toString()).toBe('type=MANUAL&priceMax=250000&brand=Vespa');
  });
  it('считает активные фильтры (поиск и сортировка не в счёте шторки: сортировка — да)', () => {
    expect(activeCount(EMPTY_FILTERS)).toBe(0);
    expect(activeCount({ ...EMPTY_FILTERS, type: ['MANUAL', 'AUTOMATIC'], priceMin: 1, priceMax: 2, sort: 'rating' })).toBe(4);
  });
});

describe('даты в URL', () => {
  const from = '2026-11-12T04:30:00.000Z';
  const to = '2026-11-19T04:30:00.000Z';
  it('круговой обход', () => {
    expect(parseRange(rangeToParams({ from, to }))).toEqual({ from, to });
  });
  it('мусор и перевёрнутый диапазон отбрасываются', () => {
    expect(parseRange(new URLSearchParams('from=abc&to=def'))).toBeNull();
    expect(parseRange(new URLSearchParams(`from=${to}&to=${from}`))).toBeNull();
    expect(parseRange(new URLSearchParams(`from=${from}`))).toBeNull();
  });
  it('диапазон в прошлом непригоден', () => {
    expect(isRangeUsable({ from, to }, new Date('2026-11-12T03:10:00Z'))).toBe(true);
    expect(isRangeUsable({ from, to }, new Date('2026-11-13T00:00:00Z'))).toBe(false);
  });
});

describe('подпись периода «12–17 ноября»', () => {
  const tz = 'Asia/Ho_Chi_Minh';
  it('один месяц, ru', () => expect(formatRangeShort(new Date('2026-11-12T04:30:00Z'), new Date('2026-11-17T04:30:00Z'), 'ru', tz)).toBe('12–17 ноября'));
  it('разные месяцы, ru', () => expect(formatRangeShort(new Date('2026-11-28T04:30:00Z'), new Date('2026-12-03T04:30:00Z'), 'ru', tz)).toBe('28 ноября – 3 декабря'));
  it('один день, en', () => expect(formatRangeShort(new Date('2026-11-12T04:30:00Z'), new Date('2026-11-12T12:00:00Z'), 'en', tz)).toBe('12 November'));
});
