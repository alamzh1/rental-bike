import { describe, expect, it } from 'vitest';
import { flattenKeys, resources } from '@rental/i18n';
import { BOOKING_TABS, bookingTab, formatCountdown, initialTab, pollInterval, remainingMs, rentalEnding } from '../src/features/bookings/status';

// История 39: вкладки «Активные / Предстоящие / Завершённые» (бриф дословно).
describe('bookingTab — вкладки «Мои брони»', () => {
  it('порядок вкладок как в брифе', () => expect(BOOKING_TABS).toEqual(['active', 'upcoming', 'past']));
  it.each([
    ['ISSUED', 'active'],
    ['PROBLEM', 'active'],
    ['CONFIRMED', 'upcoming'],
    ['PENDING_PAYMENT', 'upcoming'],
    ['COMPLETED', 'past'],
    ['CANCELLED_BY_CLIENT', 'past'],
    ['CANCELLED_BY_SYSTEM', 'past'],
  ])('%s → %s', (status, tab) => expect(bookingTab(status)).toBe(tab));

  it('открывается первая непустая вкладка, без броней — «Активные»', () => {
    expect(initialTab([{ status: 'CONFIRMED' }, { status: 'COMPLETED' }])).toBe('upcoming');
    expect(initialTab([{ status: 'COMPLETED' }, { status: 'ISSUED' }])).toBe('active');
    expect(initialTab([])).toBe('active');
  });

  it.each([['ru'], ['en'], ['vi']] as const)('%s: подписи вкладок и пустые состояния переведены', (lang) => {
    const flat = flattenKeys(resources[lang]);
    expect(flat['bookings.tabs.active']).toBeTruthy();
    for (const tab of BOOKING_TABS) {
      expect(flat[`bookings.tabs.${tab}`], `bookings.tabs.${tab}`).toBeTruthy();
      expect(flat[`bookings.empty.${tab}.title`], `bookings.empty.${tab}.title`).toBeTruthy();
      expect(flat[`bookings.empty.${tab}.text`], `bookings.empty.${tab}.text`).toBeTruthy();
    }
    expect(flat['bookings.tabs.cancelled']).toBeUndefined();
  });

  it('ru: «Активные», «Предстоящие», «Завершённые»', () => {
    const flat = flattenKeys(resources.ru);
    expect(BOOKING_TABS.map((k) => flat[`bookings.tabs.${k}`])).toEqual(['Активные', 'Предстоящие', 'Завершённые']);
  });
});

describe('таймер', () => {
  const now = Date.parse('2026-11-12T10:00:00Z');
  it('остаток не уходит в минус', () => expect(remainingMs('2026-11-12T09:59:00Z', now)).toBe(0));
  it('остаток в мс', () => expect(remainingMs('2026-11-12T10:15:00Z', now)).toBe(900_000));
  it('15 минут → 15:00', () => expect(formatCountdown(900_000)).toBe('15:00'));
  it('9 мин 5 с → 09:05', () => expect(formatCountdown(545_000)).toBe('09:05'));
  it('округляет вверх до секунды', () => expect(formatCountdown(1_200)).toBe('00:02'));
  it('больше часа → Ч:ММ:СС', () => expect(formatCountdown(3_725_000)).toBe('1:02:05'));
});

describe('pollInterval — автообновление оплаты раз в 3 с', () => {
  it('ожидает оплаты → 3000', () => expect(pollInterval('PENDING_PAYMENT')).toBe(3000));
  it('подтверждена → стоп', () => expect(pollInterval('CONFIRMED')).toBe(false));
});

describe('предупреждение о конце аренды', () => {
  const now = Date.parse('2026-11-01T12:00:00Z');
  const at = (hours: number) => new Date(now + hours * 3_600_000).toISOString();

  it('за сутки — скоро, после срока — просрочка, раньше — ничего', () => {
    expect(rentalEnding({ status: 'ISSUED', endAt: at(25) }, now)).toBeNull();
    expect(rentalEnding({ status: 'ISSUED', endAt: at(24) }, now)).toBe('soon');
    expect(rentalEnding({ status: 'ISSUED', endAt: at(-1) }, now)).toBe('overdue');
  });

  it('только пока байк у клиента', () => {
    expect(rentalEnding({ status: 'CONFIRMED', endAt: at(1) }, now)).toBeNull();
    expect(rentalEnding({ status: 'COMPLETED', endAt: at(-1) }, now)).toBeNull();
  });
});
