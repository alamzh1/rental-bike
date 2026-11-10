import { describe, expect, it } from 'vitest';
import { errorKey } from '../src/features/checkout/errors';
import { canSubmitHandover, canSubmitReturn, deductionsTotal, depositHeld, extractBookingCode, parseWhole, photoVerdict } from '../src/features/manager/logic';

describe('extractBookingCode — QR и ручной ввод', () => {
  it.each([
    ['BK-24117', 'BK-24117'],
    ['  bk-24117 ', 'BK-24117'],
    ['24117', 'BK-24117'],
    ['https://t.me/bot/app?startapp=booking_BK-10002', 'BK-10002'],
    ['', null],
    ['   ', null],
  ])('%j → %j', (raw, expected) => expect(extractBookingCode(raw)).toBe(expected));

  it('постороннее значение уходит на сервер как есть (ответит NOT_FOUND)', () => expect(extractBookingCode('cl123abc')).toBe('cl123abc'));
});

describe('parseWhole — пробег и суммы', () => {
  it.each([
    ['1200', 1200],
    ['1 200 000', 1_200_000],
    ['0', 0],
    ['', null],
    ['12,5', null],
    ['-3', null],
    ['12a', null],
  ])('%j → %j', (raw, expected) => expect(parseWhole(raw)).toBe(expected));
});

describe('фото акта: от 4 до 8', () => {
  it.each([
    [0, 'few'],
    [3, 'few'],
    [4, 'ok'],
    [8, 'ok'],
    [9, 'many'],
  ] as const)('%i фото → %s', (n, verdict) => expect(photoVerdict(n)).toBe(verdict));
});

describe('выдача', () => {
  const ok = { bikeId: 'b1', mileage: '1000', fuel: 50, photoCount: 4, uploading: false };
  it('4 фото, пробег, топливо, байк — можно', () => expect(canSubmitHandover(ok)).toBe(true));
  it('3 фото — нельзя', () => expect(canSubmitHandover({ ...ok, photoCount: 3 })).toBe(false));
  it('фото ещё грузятся — нельзя', () => expect(canSubmitHandover({ ...ok, uploading: true })).toBe(false));
  it('без байка, пробега или топлива — нельзя', () => {
    expect(canSubmitHandover({ ...ok, bikeId: null })).toBe(false);
    expect(canSubmitHandover({ ...ok, mileage: '' })).toBe(false);
    expect(canSubmitHandover({ ...ok, fuel: null })).toBe(false);
  });
});

describe('возврат и удержания', () => {
  const base = { mileage: '1500', fuel: 25, photoCount: 5, uploading: false, deductions: [], depositHeld: 1_000_000 };
  it('без удержаний — можно', () => expect(canSubmitReturn(base)).toBe(true));
  it('удержание 200 000 при депозите 1 000 000 — можно, сумма считается', () => {
    const deductions = [{ amount: '200 000', reason: 'зеркало', uploading: false }];
    expect(canSubmitReturn({ ...base, deductions })).toBe(true);
    expect(deductionsTotal(deductions)).toBe(200_000);
  });
  it('удержания больше депозита — нельзя', () => expect(canSubmitReturn({ ...base, deductions: [{ amount: '1 000 001', reason: 'x', uploading: false }] })).toBe(false));
  it('удержание без причины или с нулём — нельзя', () => {
    expect(canSubmitReturn({ ...base, deductions: [{ amount: '5000', reason: ' ', uploading: false }] })).toBe(false);
    expect(canSubmitReturn({ ...base, deductions: [{ amount: '0', reason: 'x', uploading: false }] })).toBe(false);
  });
  it('внесённый депозит: аренда покрывается первой, но не больше депозита', () => {
    expect(depositHeld(180_000, 180_000, 1_000_000)).toBe(0);
    expect(depositHeld(1_180_000, 180_000, 1_000_000)).toBe(1_000_000);
    expect(depositHeld(1_500_000, 180_000, 1_000_000)).toBe(1_000_000);
    expect(depositHeld(600_000, 180_000, 1_000_000)).toBe(420_000);
  });
});

describe('errorKey в режиме менеджера', () => {
  it('свои коды — manager.error.*, общие — errors.*, неизвестные — UNKNOWN', () => {
    expect(errorKey('PHOTOS_COUNT')).toBe('manager.error.PHOTOS_COUNT');
    expect(errorKey('FORBIDDEN')).toBe('errors.FORBIDDEN');
    expect(errorKey('BOOM')).toBe('errors.UNKNOWN');
  });
});
