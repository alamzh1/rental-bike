import { describe, expect, it } from 'vitest';
import type { AdminTextRow } from '@rental/shared';
import { addTariffRow, tariffProblem } from '../src/features/prices/tariffs';
import { filterTexts, namespaces } from '../src/features/texts/filter';
import { changedKeys, fromVndPer, toVndPer } from '../src/features/settings/form';

// Формы разделов таска 11: проверка сетки тарифов до отправки, поиск строк интерфейса, курс «₫ за 1 ₽».

describe('сетка тарифов', () => {
  it('1–2, 3–6, 7+ — без замечаний', () => {
    expect(tariffProblem([{ minDays: 1, maxDays: 2, pricePerDay: 150_000 }, { minDays: 3, maxDays: 6, pricePerDay: 130_000 }, { minDays: 7, maxDays: null, pricePerDay: 110_000 }])).toBeNull();
  });

  it('пропуск дней, не с 1 суток, без цены, закрытая последняя строка', () => {
    expect(tariffProblem([{ minDays: 1, maxDays: 2, pricePerDay: 1 }, { minDays: 5, maxDays: null, pricePerDay: 1 }])).toBe('gap');
    expect(tariffProblem([{ minDays: 2, maxDays: null, pricePerDay: 1 }])).toBe('first');
    expect(tariffProblem([{ minDays: 1, maxDays: null, pricePerDay: null }])).toBe('price');
    expect(tariffProblem([{ minDays: 1, maxDays: 30, pricePerDay: 1 }])).toBe('open');
  });

  it('новая строка закрывает открытую неделей и продолжает со следующего дня', () => {
    expect(addTariffRow([{ minDays: 1, maxDays: null, pricePerDay: 100 }])).toEqual([
      { minDays: 1, maxDays: 7, pricePerDay: 100 },
      { minDays: 8, maxDays: null, pricePerDay: 100 },
    ]);
    expect(tariffProblem(addTariffRow(addTariffRow([{ minDays: 1, maxDays: null, pricePerDay: 100 }])))).toBeNull();
  });
});

describe('поиск строк интерфейса', () => {
  const rows: AdminTextRow[] = [
    { key: 'home.title', base: { ru: 'Привет', en: 'Hello', vi: 'Xin chào' }, override: {} },
    { key: 'home.cta', base: { ru: 'Выбрать даты', en: 'Pick dates', vi: 'Chọn ngày' }, override: { ru: 'Даты' } },
    { key: 'bot.welcome', base: { ru: 'Добро пожаловать', en: 'Welcome', vi: 'Chào mừng' }, override: {} },
  ];

  it('ищет по ключу и по тексту на любом языке, включая правку', () => {
    expect(filterTexts(rows, { q: 'chào' }).map((r) => r.key)).toEqual(['home.title', 'bot.welcome']);
    expect(filterTexts(rows, { q: 'даты' }).map((r) => r.key)).toEqual(['home.cta']);
    expect(filterTexts(rows, { q: 'BOT.' }).map((r) => r.key)).toEqual(['bot.welcome']);
  });

  it('раздел и «изменённые»', () => {
    expect(namespaces(rows)).toEqual(['bot', 'home']);
    expect(filterTexts(rows, { ns: 'home' })).toHaveLength(2);
    expect(filterTexts(rows, { onlyEdited: true }).map((r) => r.key)).toEqual(['home.cta']);
  });
});

describe('форма настроек', () => {
  it('курс: 0,003533 ₽ за 1 ₫ ↔ 283,05 ₫ за 1 ₽', () => {
    expect(toVndPer(0.003533)).toBe(283.05);
    expect(fromVndPer(25_000)).toBeCloseTo(0.00004, 10);
    expect(fromVndPer(null)).toBe(0);
  });

  it('в PATCH уходят только изменённые ключи', () => {
    expect(changedKeys({ a: 1, b: { x: 1 }, c: 'z' }, { a: 1, b: { x: 2 }, c: 'z' })).toEqual(['b']);
  });
});
