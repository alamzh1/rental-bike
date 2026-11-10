import { useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

export interface LatLng {
  lat: number;
  lng: number;
}

// Пин рисуем SVG-иконкой (стандартные картинки Leaflet бандлер не находит); цвет — токен accent.
const PIN_HTML =
  '<svg viewBox="0 0 32 40" width="32" height="40" aria-hidden="true" style="color:var(--accent)">' +
  '<path d="M16 0C7.2 0 0 7 0 15.6 0 27 16 40 16 40s16-13 16-24.4C32 7 24.8 0 16 0z" fill="currentColor"/>' +
  '<circle cx="16" cy="15" r="6" style="fill:var(--on-accent)"/></svg>';

function ClickToPin({ onPick }: { onPick: (p: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Карта доставки: Leaflet + OpenStreetMap. Тап или перетаскивание пина задаёт точку. */
export default function DeliveryMap({ center, pin, onPick, label }: { center: LatLng; pin: LatLng; onPick: (p: LatLng) => void; label: string }) {
  const icon = useMemo(() => L.divIcon({ html: PIN_HTML, className: '', iconSize: [32, 40], iconAnchor: [16, 40] }), []);
  return (
    <div role="application" aria-label={label} className="h-[224px] w-full overflow-hidden rounded-lg border border-line">
      <MapContainer center={[center.lat, center.lng]} zoom={14} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer attribution="&copy; OpenStreetMap" url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickToPin onPick={onPick} />
        <Marker
          position={[pin.lat, pin.lng]}
          icon={icon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng();
              onPick({ lat: ll.lat, lng: ll.lng });
            },
          }}
        />
      </MapContainer>
    </div>
  );
}
