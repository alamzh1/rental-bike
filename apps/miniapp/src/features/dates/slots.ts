import { fromLocationDateTime, rentalDays, toLocationDate } from '@rental/shared';

// Чистые правила выбора дат: слоты, быстрые кнопки, календарная сетка. Все даты — по часам точки (timezone),
// наружу уходят моменты UTC. Часовой пояс устройства не участвует.

export interface LocationHours {
  /** HH:mm */
  openTime: string;
  closeTime: string;
  timezone: string;
}

export const SLOT_MINUTES = 30;
/** Минимальное время до выдачи (Setting minLeadMinutes = 60). */
export const MIN_LEAD_MINUTES = 60;

export type QuickKind = 'today' | 'tomorrow' | 'days3' | 'week' | 'month';
export const QUICK_KINDS: readonly QuickKind[] = ['today', 'tomorrow', 'days3', 'week', 'month'];
const QUICK_DAYS: Record<'days3' | 'week' | 'month', number> = { days3: 3, week: 7, month: 30 };

export interface DaySelection {
  /** YYYY-MM-DD */
  start: string | null;
  end: string | null;
}

const toMinutes = (hhmm: string): number => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
const fromMinutes = (m: number): string => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** Дата и минуты от полуночи момента `d` в часовом поясе. */
export function localParts(d: Date, timezone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { date: toLocationDate(d, timezone), minutes: get('hour') * 60 + get('minute') };
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Слоты HH:mm по 30 минут от открытия до закрытия включительно. */
export function timeSlots(open: string, close: string): string[] {
  const out: string[] = [];
  for (let m = toMinutes(open); m <= toMinutes(close); m += SLOT_MINUTES) out.push(fromMinutes(m));
  return out;
}

/** Ближайший слот выдачи: не раньше «сейчас + lead», кратно 30 минутам, в часы точки. */
export function earliestSlot(now: Date, loc: LocationHours, leadMinutes = MIN_LEAD_MINUTES): Date {
  const { date, minutes } = localParts(new Date(now.getTime() + leadMinutes * 60_000), loc.timezone);
  const rounded = Math.ceil(minutes / SLOT_MINUTES) * SLOT_MINUTES;
  const open = toMinutes(loc.openTime);
  const close = toMinutes(loc.closeTime);
  if (rounded >= close) return fromLocationDateTime(addDays(date, 1), loc.openTime, loc.timezone);
  return fromLocationDateTime(date, fromMinutes(Math.max(rounded, open)), loc.timezone);
}

/** Быстрые кнопки главной: Сегодня, Завтра, 3 дня, Неделя, Месяц. */
export function quickRange(kind: QuickKind, now: Date, loc: LocationHours, leadMinutes = MIN_LEAD_MINUTES): { from: Date; to: Date } {
  const first = earliestSlot(now, loc, leadMinutes);
  const firstLocal = localParts(first, loc.timezone);
  if (kind === 'today') {
    return { from: first, to: fromLocationDateTime(firstLocal.date, loc.closeTime, loc.timezone) };
  }
  if (kind === 'tomorrow') {
    const tomorrow = addDays(toLocationDate(now, loc.timezone), 1);
    const open = fromLocationDateTime(tomorrow, loc.openTime, loc.timezone);
    const from = open.getTime() >= first.getTime() ? open : first;
    return { from, to: fromLocationDateTime(localParts(from, loc.timezone).date, loc.closeTime, loc.timezone) };
  }
  const time = fromMinutes(firstLocal.minutes);
  return { from: first, to: fromLocationDateTime(addDays(firstLocal.date, QUICK_DAYS[kind]), time, loc.timezone) };
}

/** Сетка месяца, неделя с понедельника; пустые клетки — null. month: 1–12. */
export function monthGrid(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Касание дня: первое — начало, второе — конец; занятый день не выбирается; через занятый день диапазон не тянется. */
export function pickDay(sel: DaySelection, day: string, busy: ReadonlySet<string>): DaySelection {
  if (busy.has(day)) return sel;
  if (!sel.start || sel.end) return { start: day, end: null };
  if (day < sel.start) return { start: day, end: null };
  for (let d = sel.start; d <= day; d = addDays(d, 1)) {
    if (busy.has(d)) return { start: day, end: null };
  }
  return { start: sel.start, end: day };
}

/** Время выдачи в день `date`: в первый доступный день — не раньше ближайшего слота. */
export function startTimeOptions(date: string, earliest: Date, loc: LocationHours): string[] {
  const all = timeSlots(loc.openTime, loc.closeTime).slice(0, -1);
  const e = localParts(earliest, loc.timezone);
  return date === e.date ? all.filter((t) => toMinutes(t) >= e.minutes) : all;
}

/** Время возврата: в день выдачи — строго позже выдачи. */
export function endTimeOptions(startDate: string, endDate: string, startTime: string, loc: LocationHours): string[] {
  const all = timeSlots(loc.openTime, loc.closeTime);
  return startDate === endDate ? all.filter((t) => toMinutes(t) > toMinutes(startTime)) : all;
}

/** Выбранные даты и время → моменты UTC; нет конца — null. */
export function composeRange(
  sel: DaySelection,
  startTime: string,
  endTime: string,
  timezone: string,
): { from: Date; to: Date } | null {
  if (!sel.start || !sel.end) return null;
  return { from: fromLocationDateTime(sel.start, startTime, timezone), to: fromLocationDateTime(sel.end, endTime, timezone) };
}

export { rentalDays };
