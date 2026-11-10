import { useEffect } from 'react';
import { CircleMarker, MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackedState, TrackPoint } from '@rental/shared';

export interface MapBike {
  id: string;
  plate: string;
  lat: number;
  lng: number;
  state: TrackedState;
  online: boolean;
}

const STATE_COLOR: Record<TrackedState, string> = {
  OVERDUE: 'var(--danger)',
  PROBLEM: 'var(--danger)',
  RENTED: 'var(--accent)',
  RESERVED: 'var(--warning)',
  REPAIR: 'var(--warning)',
  FREE: 'var(--success)',
  RETIRED: 'var(--ink-muted)',
};

/** Метка — госномер: цветом дублируется состояние, текст различает байки без опоры на цвет. */
function plateIcon(b: MapBike): L.DivIcon {
  const opacity = b.online ? 1 : 0.55;
  const plate = b.plate.replace(/[<>&"]/g, '');
  return L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `<span style="position:absolute;transform:translate(-50%,-50%);white-space:nowrap;padding:2px 8px;border-radius:999px;background:${STATE_COLOR[b.state]};color:#fff;font:700 12px/18px Manrope,sans-serif;font-variant-numeric:tabular-nums;box-shadow:0 0 0 2px #fff;opacity:${opacity}">${plate}</span>`,
  });
}

function Fit({ points, fallback }: { points: [number, number][]; fallback: [number, number] }) {
  const map = useMap();
  const key = points.map((p) => p.join()).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(L.latLngBounds(points), { padding: [40, 40], maxZoom: 16 });
    else map.setView(points[0] ?? fallback, 15);
    // перецентровка только при смене набора точек
  }, [key]);
  return null;
}

/** Карта парка или одного байка с треком. Подложка OpenStreetMap; маркеры — госномера. На телефоне один палец листает страницу, карта двигается двумя. */
export default function BikeMap({ bikes, track = [], center, height, onSelect }: { bikes: MapBike[]; track?: TrackPoint[]; center: [number, number]; height: number; onSelect?: (id: string) => void }) {
  const line = track.map((p): [number, number] => [p.lat, p.lng]);
  const points = [...bikes.map((b): [number, number] => [b.lat, b.lng]), ...line];
  return (
    <div style={{ height: `min(${height}px, 45dvh)` }} className="relative z-0 overflow-hidden rounded-md border border-line">
      <MapContainer center={center} zoom={14} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false} dragging={!L.Browser.mobile}>
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Fit points={points} fallback={center} />
        {line.length > 1 && <Polyline positions={line} pathOptions={{ color: '#0a5cff', weight: 3, opacity: 0.8 }} />}
        {line[0] && (
          <CircleMarker center={line[0]} radius={5} pathOptions={{ color: '#fff', weight: 2, fillColor: '#0a5cff', fillOpacity: 1 }}>
            <Tooltip>{track[0] ? new Date(track[0].at).toLocaleString() : ''}</Tooltip>
          </CircleMarker>
        )}
        {bikes.map((b) => (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={plateIcon(b)} eventHandlers={onSelect ? { click: () => onSelect(b.id) } : undefined} title={b.plate} alt={b.plate} />
        ))}
      </MapContainer>
    </div>
  );
}
