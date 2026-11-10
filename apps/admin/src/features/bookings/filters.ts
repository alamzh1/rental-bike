import { BOOKING_STATUSES, type BookingStatus } from '@rental/shared';
import { addDaysToDate } from '../chess/layout';
import { fromLocationDateTime } from '@rental/shared';

// Фильтры списка броней: адрес страницы ↔ состояние ↔ запрос GET /admin/bookings. Даты — календарные по времени точки.

export interface BookingFilters {
  status: BookingStatus[];
  /** YYYY-MM-DD или '' */
  from: string;
  to: string;
  q: string;
  page: number;
}

export const PAGE_SIZE = 25;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseBookingFilters(params: URLSearchParams): BookingFilters {
  const status = (params.get('status') ?? '')
    .split(',')
    .filter((s): s is BookingStatus => (BOOKING_STATUSES as readonly string[]).includes(s));
  const date = (v: string | null) => (v && DATE_RE.test(v) ? v : '');
  const page = Number(params.get('page'));
  return { status, from: date(params.get('from')), to: date(params.get('to')), q: (params.get('q') ?? '').slice(0, 100), page: Number.isInteger(page) && page > 0 ? page : 1 };
}

export function toApiQuery(f: BookingFilters, tz: string): Record<string, string> {
  const q: Record<string, string> = {};
  if (f.status.length) q.status = f.status.join(',');
  if (f.from) q.from = fromLocationDateTime(f.from, '00:00', tz).toISOString();
  if (f.to) q.to = fromLocationDateTime(addDaysToDate(f.to, 1), '00:00', tz).toISOString();
  if (f.q.trim()) q.q = f.q.trim();
  q.page = String(f.page);
  q.pageSize = String(PAGE_SIZE);
  return q;
}

export function toSearch(f: BookingFilters): string {
  const p = new URLSearchParams();
  if (f.status.length) p.set('status', f.status.join(','));
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.q) p.set('q', f.q);
  if (f.page > 1) p.set('page', String(f.page));
  return p.toString();
}
