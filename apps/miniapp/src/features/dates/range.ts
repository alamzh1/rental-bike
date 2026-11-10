// Выбранный период в URL и сторе: from/to — ISO UTC.

export interface DateRange {
  from: string;
  to: string;
}

const valid = (s: string | null): s is string => !!s && !Number.isNaN(Date.parse(s));

/** from/to из query-строки; мусор, один конец или перевёрнутый диапазон → null. */
export function parseRange(params: URLSearchParams): DateRange | null {
  const from = params.get('from');
  const to = params.get('to');
  if (!valid(from) || !valid(to) || Date.parse(to) <= Date.parse(from)) return null;
  return { from: new Date(from).toISOString(), to: new Date(to).toISOString() };
}

export function rangeToParams(range: DateRange | null, base?: URLSearchParams): URLSearchParams {
  const params = new URLSearchParams(base);
  params.delete('from');
  params.delete('to');
  if (range) {
    params.set('from', range.from);
    params.set('to', range.to);
  }
  return params;
}

/** Период, который ещё не начался. Устаревший (вчерашний) в сторе не держим. */
export function isRangeUsable(range: DateRange, now: Date = new Date()): boolean {
  return Date.parse(range.from) > now.getTime();
}
