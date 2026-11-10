import { describe, expect, it } from 'vitest';
import { presetPeriod, toCsv } from '../src/features/finance/period';

describe('период финансов', () => {
  it('этот и прошлый месяц, включая переход через год', () => {
    expect(presetPeriod('thisMonth', '2026-11-15')).toEqual({ from: '2026-11-01', to: '2026-11-15' });
    expect(presetPeriod('lastMonth', '2026-03-31')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(presetPeriod('lastMonth', '2027-01-10')).toEqual({ from: '2026-12-01', to: '2026-12-31' });
  });

  it('три месяца и год', () => {
    expect(presetPeriod('quarter', '2026-02-10')).toEqual({ from: '2025-12-01', to: '2026-02-10' });
    expect(presetPeriod('year', '2026-11-01')).toEqual({ from: '2026-01-01', to: '2026-11-01' });
  });
});

describe('CSV', () => {
  it('разделитель, экранирование и BOM', () => {
    expect(toCsv([['a;b', 'c"d', null, 5]])).toBe('\uFEFF"a;b";"c""d";;5\r\n');
  });
});
