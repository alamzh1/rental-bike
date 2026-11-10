import { describe, expect, it } from 'vitest';
import { bookingStatusTone, splitPrice } from '../src/index';

const NB = '\u00a0';

describe('splitPrice — сумма в донгах и пересчёт отдельно (design-system README «Числа и форматы»)', () => {
  it('RU с рублями: «150 000 ₫» и «≈ 530 ₽»', () => {
    expect(splitPrice(150_000, 'ru', { currency: 'RUB', rate: 0.003533 })).toEqual({
      main: `150${NB}000${NB}₫`,
      approx: `≈${NB}530${NB}₽`,
    });
  });
  it('EN с долларами: «150,000 ₫» и «≈ $5.70»', () => {
    expect(splitPrice(150_000, 'en', { currency: 'USD', rate: 0.000038 })).toEqual({
      main: `150,000${NB}₫`,
      approx: `≈${NB}$5.70`,
    });
  });
  it('VI и валюта VND — без пересчёта', () => {
    expect(splitPrice(150_000, 'vi')).toEqual({ main: `150.000${NB}₫`, approx: null });
    expect(splitPrice(150_000, 'ru', { currency: 'VND', rate: 1 })).toEqual({ main: `150${NB}000${NB}₫`, approx: null });
  });
});

describe('bookingStatusTone — таблица StatusBadge', () => {
  it.each([
    ['PENDING_PAYMENT', 'warning'],
    ['CONFIRMED', 'accent'],
    ['ISSUED', 'success'],
    ['COMPLETED', 'neutral'],
    ['CANCELLED_BY_CLIENT', 'neutral'],
    ['CANCELLED_BY_SYSTEM', 'neutral'],
    ['PROBLEM', 'danger'],
  ] as const)('%s → %s', (status, tone) => expect(bookingStatusTone(status)).toBe(tone));
});
