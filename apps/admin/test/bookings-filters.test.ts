import { describe, expect, it } from 'vitest';
import { parseBookingFilters, toApiQuery, toSearch } from '../src/features/bookings/filters';

const TZ = 'Asia/Ho_Chi_Minh';

describe('фильтры броней', () => {
  it('из адреса страницы: статусы списком, даты, поиск, страница; мусор отбрасывается', () => {
    const f = parseBookingFilters(new URLSearchParams('status=CONFIRMED,ISSUED,NOPE&from=2026-11-01&to=2026-11-30&q=BK-1&page=2'));
    expect(f).toEqual({ status: ['CONFIRMED', 'ISSUED'], from: '2026-11-01', to: '2026-11-30', q: 'BK-1', page: 2 });
    expect(parseBookingFilters(new URLSearchParams('from=31.12&page=-3'))).toEqual({ status: [], from: '', to: '', q: '', page: 1 });
  });

  it('в запрос API: даты точки → ISO, «по» включительно (до начала следующего дня)', () => {
    const q = toApiQuery({ status: ['PENDING_PAYMENT'], from: '2026-11-01', to: '2026-11-30', q: ' tom ', page: 3 }, TZ);
    expect(q).toEqual({ status: 'PENDING_PAYMENT', from: '2026-10-31T17:00:00.000Z', to: '2026-11-30T17:00:00.000Z', q: 'tom', page: '3', pageSize: '25' });
  });

  it('обратно в адрес — без пустых полей', () => {
    expect(toSearch({ status: ['CONFIRMED'], from: '', to: '', q: '', page: 1 })).toBe('status=CONFIRMED');
  });
});
