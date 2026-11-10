// Проверка сетки тарифов до сохранения (сервер проверяет то же самое и отвечает 400 TARIFFS_INVALID).

export type TariffRow = { minDays: number | null; maxDays: number | null; pricePerDay: number | null };
export type TariffProblem = 'first' | 'gap' | 'price' | 'open';

/** Сетка без пропусков: с 1 суток, следующая строка — со следующего дня, последняя — без верхней границы. */
export function tariffProblem(rows: TariffRow[]): TariffProblem | null {
  if (!rows.length || rows[0]!.minDays !== 1) return 'first';
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    if (!r.pricePerDay || r.pricePerDay <= 0) return 'price';
    const next = rows[i + 1];
    if (next && (r.maxDays === null || r.minDays === null || r.maxDays < r.minDays || next.minDays !== r.maxDays + 1)) return 'gap';
    if (!next && r.maxDays !== null) return 'open';
  }
  return null;
}

/** Добавить строку: открытая последняя закрывается неделей, новая продолжает со следующего дня. */
export function addTariffRow(rows: TariffRow[]): TariffRow[] {
  const last = rows[rows.length - 1];
  if (!last) return [{ minDays: 1, maxDays: null, pricePerDay: null }];
  const lastMax = last.maxDays ?? (last.minDays ?? 1) + 6;
  return [...rows.slice(0, -1), { ...last, maxDays: lastMax }, { minDays: lastMax + 1, maxDays: null, pricePerDay: last.pricePerDay }];
}
