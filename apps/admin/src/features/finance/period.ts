import { addDaysToDate } from '../chess/layout';

// Период раздела «Финансы»: чистые функции (тесты в test/finance-period.test.ts). Даты — YYYY-MM-DD в tz точки.

const BOM = String.fromCharCode(0xfeff);

export const PRESETS = ['thisMonth', 'lastMonth', 'quarter', 'year'] as const;
export type Preset = (typeof PRESETS)[number];
export interface Period {
  from: string;
  to: string;
}

function monthStart(date: string, shift = 0): string {
  const [y, m] = date.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + shift, 1)).toISOString().slice(0, 10);
}

export function presetPeriod(preset: Preset, today: string): Period {
  switch (preset) {
    case 'thisMonth':
      return { from: monthStart(today), to: today };
    case 'lastMonth':
      return { from: monthStart(today, -1), to: addDaysToDate(monthStart(today), -1) };
    case 'quarter':
      return { from: monthStart(today, -2), to: today };
    case 'year':
      return { from: `${today.slice(0, 4)}-01-01`, to: today };
  }
}

/** Таблица с заголовком в CSV: разделитель «;» и BOM — так файл открывается в Excel с кириллицей. */
export function toCsv(rows: (string | number | null)[][]): string {
  const cell = (v: string | number | null) => {
    const s = v === null ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return `${BOM}${rows.map((r) => r.map(cell).join(';')).join('\r\n')}\r\n`;
}
