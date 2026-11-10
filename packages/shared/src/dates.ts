import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Календарная дата YYYY-MM-DD момента `d` в часовом поясе точки. */
export function toLocationDate(d: Date, tz: string): string {
  return formatInTimeZone(d, tz, 'yyyy-MM-dd');
}

/** Дата и время, выбранные по часам точки (YYYY-MM-DD, HH:mm), → момент UTC. Часовой пояс устройства не влияет. */
export function fromLocationDateTime(date: string, time: string, tz: string): Date {
  if (!DATE_RE.test(date)) throw new RangeError(`Invalid date: ${date}`);
  if (!TIME_RE.test(time)) throw new RangeError(`Invalid time: ${time}`);
  return fromZonedTime(`${date}T${time}:00`, tz);
}
