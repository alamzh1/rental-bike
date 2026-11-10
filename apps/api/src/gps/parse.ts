// Разбор точки трекера. Форматы: OsmAnd (lat, lon, speed в узлах, batt — так шлют Traccar Client старых версий и
// forward-адрес Traccar Server) и JSON новых Traccar Client ({ location: { coords, battery, timestamp } }, скорость в м/с).

export interface GpsPoint {
  lat: number;
  lng: number;
  speedKmh: number | null;
  batteryPct: number | null;
  /** null — устройство не передало время */
  at: Date | null;
}

const KNOT_KMH = 1.852;
const MS_KMH = 3.6;

function num(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function time(v: unknown): Date | null {
  const n = num(v);
  // секунды и миллисекунды различаются порядком: 10^11 с — это 5138 год
  const d = n !== null ? new Date(n < 100_000_000_000 ? n * 1000 : n) : typeof v === 'string' ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

const round1 = (v: number) => Math.round(v * 10) / 10;

function speed(v: unknown, factor: number): number | null {
  const n = num(v);
  return n === null || n < 0 ? null : round1(n * factor);
}

function battery(v: unknown, fraction: boolean): number | null {
  const n = num(v);
  if (n === null || n < 0) return null;
  const pct = Math.round(fraction ? n * 100 : n);
  return pct > 100 ? null : pct;
}

/** null — координат нет или они вне диапазона. */
export function parseGpsPoint(query: Record<string, unknown>, body: unknown): GpsPoint | null {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const location = b.location && typeof b.location === 'object' ? (b.location as Record<string, unknown>) : null;
  const coords = location?.coords && typeof location.coords === 'object' ? (location.coords as Record<string, unknown>) : null;
  let point: GpsPoint;
  if (coords) {
    const bat = location?.battery && typeof location.battery === 'object' ? (location.battery as Record<string, unknown>) : {};
    point = { lat: num(coords.latitude) ?? NaN, lng: num(coords.longitude) ?? NaN, speedKmh: speed(coords.speed, MS_KMH), batteryPct: battery(bat.level, true), at: time(location?.timestamp) };
  } else {
    const p = { ...b, ...query };
    point = { lat: num(p.lat) ?? NaN, lng: num(p.lon ?? p.lng) ?? NaN, speedKmh: speed(p.speed, KNOT_KMH), batteryPct: battery(p.batt, false), at: time(p.timestamp) };
  }
  if (!(Math.abs(point.lat) <= 90) || !(Math.abs(point.lng) <= 180)) return null;
  if (point.lat === 0 && point.lng === 0) return null; // устройство без спутников шлёт нули
  return point;
}
