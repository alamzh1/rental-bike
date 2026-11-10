import { fromLocationDateTime, toLocationDate, type AdminConflictError, type BookingStatus, type ChessBike } from '@rental/shared';

// Геометрия шахматки — чистые функции (тесты в test/chess-layout.test.ts). Дни считаются в tz точки.

const HOLDING: ReadonlySet<BookingStatus> = new Set(['PENDING_PAYMENT', 'CONFIRMED', 'ISSUED', 'PROBLEM']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const INPUT_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** Следующая календарная дата YYYY-MM-DD (без часового пояса). */
export function addDaysToDate(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Окно [полночь даты, полночь даты + days) по времени точки → ISO UTC. */
export function windowFor(date: string, days: number, tz: string): { from: string; to: string } {
  if (!DATE_RE.test(date)) throw new RangeError(`Invalid date ${date}`);
  return { from: fromLocationDateTime(date, '00:00', tz).toISOString(), to: fromLocationDateTime(addDaysToDate(date, days), '00:00', tz).toISOString() };
}

export interface ChessDay {
  date: string;
  start: Date;
}

export function chessDays(fromIso: string, days: number, tz: string): ChessDay[] {
  const first = toLocationDate(new Date(fromIso), tz);
  return Array.from({ length: days }, (_, i) => {
    const date = addDaysToDate(first, i);
    return { date, start: fromLocationDateTime(date, '00:00', tz) };
  });
}

export interface BarGeometry {
  /** Проценты ширины окна */
  left: number;
  width: number;
  buffer: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

/** Положение полосы брони в окне; null — бронь целиком вне окна. Буфер рисуется продолжением полосы. */
export function barGeometry(b: { startAt: string; endAt: string; blockedUntil: string }, w: { from: string; to: string }): BarGeometry | null {
  const from = Date.parse(w.from);
  const span = Date.parse(w.to) - from;
  const start = Date.parse(b.startAt);
  const end = Date.parse(b.endAt);
  const blocked = Math.max(end, Date.parse(b.blockedUntil));
  if (blocked <= from || start >= from + span) return null;
  const pct = (t: number) => (Math.min(Math.max(t, from), from + span) - from) * (100 / span);
  return {
    left: pct(start),
    width: Math.max(0, pct(end) - pct(start)),
    buffer: Math.max(0, pct(blocked) - pct(end)),
    clippedStart: start < from,
    clippedEnd: blocked > from + span,
  };
}

/** Предварительная проверка до запроса: та же модель, байк не списан, бронь не закрыта. Занятость проверяет сервер. */
export function canDrop(
  booking: { bikeId: string; modelId: string; status: BookingStatus },
  bike: Pick<ChessBike, 'id' | 'modelId' | 'status'>,
): AdminConflictError['code'] | 'SAME' | null {
  if (booking.bikeId === bike.id) return 'SAME';
  if (!HOLDING.has(booking.status)) return 'BOOKING_CLOSED';
  if (bike.modelId !== booking.modelId) return 'BIKE_MODEL_MISMATCH';
  if (bike.status === 'RETIRED') return 'BIKE_UNAVAILABLE';
  return null;
}

/** <input type="datetime-local"> по часам точки → ISO UTC; неверное значение → null. */
export function localInputToIso(value: string, tz: string): string | null {
  const m = INPUT_RE.exec(value);
  if (!m) return null;
  try {
    return fromLocationDateTime(m[1]!, m[2]!, tz).toISOString();
  } catch {
    return null;
  }
}

export function isoToLocalInput(iso: string, tz: string): string {
  const d = new Date(iso);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  return `${toLocationDate(d, tz)}T${time}`;
}
