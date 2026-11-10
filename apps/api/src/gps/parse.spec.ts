import { describe, expect, it } from 'vitest';
import { parseGpsPoint } from './parse';

describe('точка трекера', () => {
  it('OsmAnd: скорость в узлах, время в секундах', () => {
    const p = parseGpsPoint({ lat: '13.77', lon: '109.22', speed: '10', batt: '87', timestamp: '1793534400' }, undefined);
    expect(p).toEqual({ lat: 13.77, lng: 109.22, speedKmh: 18.5, batteryPct: 87, at: new Date(1793534400_000) });
  });

  it('Traccar Client JSON: скорость в м/с, батарея — доля', () => {
    const p = parseGpsPoint({}, { device_id: 'x', location: { timestamp: '2026-11-01T10:00:00Z', coords: { latitude: 13.77, longitude: 109.22, speed: 10 }, battery: { level: 0.5 } } });
    expect(p).toEqual({ lat: 13.77, lng: 109.22, speedKmh: 36, batteryPct: 50, at: new Date('2026-11-01T10:00:00Z') });
  });

  it('время в миллисекундах и ISO', () => {
    expect(parseGpsPoint({ lat: '1', lng: '2', timestamp: '1793534400000' }, undefined)?.at).toEqual(new Date(1793534400_000));
    expect(parseGpsPoint({ lat: '1', lng: '2', timestamp: '2026-11-01T10:00:00Z' }, undefined)?.at).toEqual(new Date('2026-11-01T10:00:00Z'));
    expect(parseGpsPoint({ lat: '1', lng: '2' }, undefined)?.at).toBeNull();
  });

  it('отрицательная скорость (нет данных) — null', () => {
    expect(parseGpsPoint({ lat: '1', lng: '2', speed: '-1' }, undefined)?.speedKmh).toBeNull();
  });

  it('нет координат, вне диапазона, нули без спутников — отказ', () => {
    expect(parseGpsPoint({}, undefined)).toBeNull();
    expect(parseGpsPoint({ lat: '91', lon: '1' }, undefined)).toBeNull();
    expect(parseGpsPoint({ lat: '1', lon: '181' }, undefined)).toBeNull();
    expect(parseGpsPoint({ lat: 'abc', lon: '1' }, undefined)).toBeNull();
    expect(parseGpsPoint({ lat: '0', lon: '0' }, undefined)).toBeNull();
  });
});
