// Файл календаря .ics для «Добавить в календарь» (история 29). Текст — код брони и модель, без строк интерфейса.
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

export function bookingIcs(b: { id: string; code: string; modelName: string; startAt: Date; endAt: Date; address: string; lat: number; lng: number; url?: string }, now = new Date()): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//rental-bike//booking//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@rental-bike`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(b.startAt)}`,
    `DTEND:${stamp(b.endAt)}`,
    `SUMMARY:${esc(`${b.code} · ${b.modelName}`)}`,
    `LOCATION:${esc(b.address)}`,
    `GEO:${b.lat};${b.lng}`,
    ...(b.url ? [`URL:${b.url}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
