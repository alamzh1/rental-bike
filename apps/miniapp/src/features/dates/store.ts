import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isRangeUsable, parseRange, rangeToParams, type DateRange } from './range';

// Даты выбираются один раз и держатся до оплаты: в сторе (sessionStorage) и в URL (?from&to, ISO UTC).
// Экраны фич читают их через useDates(); оформление (checkout) берёт тот же хук или параметры from/to из URL.

const STORAGE_KEY = 'rental.dates';
const listeners = new Set<() => void>();

function load(): DateRange | null {
  try {
    const raw = globalThis.sessionStorage?.getItem(STORAGE_KEY);
    const range = raw ? parseRange(new URLSearchParams(JSON.parse(raw) as Record<string, string>)) : null;
    return range && isRangeUsable(range) ? range : null;
  } catch {
    return null;
  }
}

let current: DateRange | null = load();

export function getStoredRange(): DateRange | null {
  return current;
}

export function setStoredRange(range: DateRange | null): void {
  if (sameRange(current, range)) return;
  current = range;
  try {
    if (range) globalThis.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(range));
    else globalThis.sessionStorage?.removeItem(STORAGE_KEY);
  } catch {
    // приватный режим: даты живут до перезагрузки
  }
  listeners.forEach((fn) => fn());
}

function sameRange(a: DateRange | null, b: DateRange | null): boolean {
  return a?.from === b?.from && a?.to === b?.to;
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => void listeners.delete(fn);
};

export interface UseDates {
  range: DateRange | null;
  setRange(range: DateRange | null): void;
  /** Путь с датами в query: link('/catalog', extraParams). */
  link(path: string, extra?: URLSearchParams): string;
}

/**
 * Период аренды. URL главнее стора (ссылка, кнопка «Назад»); если в URL дат нет, а в сторе есть — дописываем их в URL.
 */
export function useDates(): UseDates {
  const stored = useSyncExternalStore(subscribe, getStoredRange, getStoredRange);
  const [params, setParams] = useSearchParams();
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const fromUrl = parseRange(params);

  useEffect(() => {
    if (fromUrl) {
      if (!sameRange(fromUrl, getStoredRange())) setStoredRange(fromUrl);
    } else if (stored && !paramsRef.current.has('from')) {
      setParams(rangeToParams(stored, paramsRef.current), { replace: true });
    }
  }, [fromUrl?.from, fromUrl?.to, stored?.from, stored?.to]);

  const range = fromUrl ?? stored;
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const setRange = useCallback(
    (next: DateRange | null) => {
      setStoredRange(next);
      setParams(rangeToParams(next, paramsRef.current), { replace: true });
    },
    [setParams],
  );
  const link = useCallback((path: string, extra?: URLSearchParams) => {
    const qs = rangeToParams(rangeRef.current, extra).toString();
    return qs ? `${path}?${qs}` : path;
  }, []);
  return { range, setRange, link };
}
