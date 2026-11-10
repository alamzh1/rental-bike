import { describe, expect, it } from 'vitest';
import { licenseAllows, vndToRub } from '../src/index.js';

const bike = (engineCc: number | null, licenseRequired: 'A1' | 'A' | 'NONE' = 'A1') => ({ engineCc, licenseRequired });

describe('licenseAllows', () => {
  it('с правами — любой байк', () => {
    for (const c of ['A1', 'A', null] as const) expect(licenseAllows(bike(160, 'A'), c)).toBe(true);
  });
  it('без прав — до 50 см³ включительно', () => {
    expect(licenseAllows(bike(50), 'NONE')).toBe(true);
    expect(licenseAllows(bike(51), 'NONE')).toBe(false);
  });
  it('электробайк без прав — только если у модели указано «права не нужны»', () => {
    expect(licenseAllows(bike(null), 'NONE')).toBe(false);
    expect(licenseAllows(bike(null, 'NONE'), 'NONE')).toBe(true);
  });
});

describe('vndToRub', () => {
  it('округляет вверх до рубля', () => expect(vndToRub(100_000, 0.00301)).toBe(301));
});
