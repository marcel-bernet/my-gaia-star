import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import type { Star } from '../sky/gaia';
import { starColor } from '../sky/physics';
import { starToLatLng, type SkyFrame } from '../sky/zenith';

export interface MapResult {
  frame: SkyFrame;
  stars: Star[];
  zenithId: string;
}

interface Props {
  place: { lat: number; lon: number } | null;
  result: MapResult | null;
  selectedId: string | null;
  onPick: (lat: number, lon: number) => void;
  onSelectStar: (id: string) => void;
}

const placeIcon = L.divIcon({ className: 'place-pin', html: '<span></span>', iconSize: [28, 28] });
// A reticle rather than a glow: ring plus four ticks.
const zenithIcon = L.divIcon({ className: 'zenith-pin', html: '<span></span><i></i><i></i><i></i><i></i>', iconSize: [44, 44] });
const selectedIcon = L.divIcon({ className: 'selected-pin', html: '<span></span>', iconSize: [34, 34] });

const KM_PER_DEG = 111.32;
// Star dots are a few pixels across; give fingers a wider catch area.
const renderer = L.canvas({ tolerance: window.matchMedia('(pointer: coarse)').matches ? 12 : 3 });
const wide = () => window.matchMedia('(min-width: 761px)').matches;

function ClickToPick({ onPick }: { onPick: Props['onPick'] }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, L.Util.wrapNum(e.latlng.lng, [-180, 180], true)) });
  return null;
}

function FollowView({ place, result, radiusDeg }: { place: Props['place']; result: MapResult | null; radiusDeg: number }) {
  const map = useMap();
  useEffect(() => {
    if (result) {
      const { lat, lon } = result.frame;
      const r = radiusDeg * 1.08;
      const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
      map.flyToBounds(
        [
          [Math.max(-85, lat - r), lon - r / cos],
          [Math.min(85, lat + r), lon + r / cos],
        ],
        // The panel sits beside the map now, not over it; leave room for the readout.
        { duration: 1.4, paddingTopLeft: [24, wide() ? 72 : 48], paddingBottomRight: [24, 24] },
      );
    }
  }, [map, result, radiusDeg]);
  useEffect(() => {
    if (place && !result) map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 9), { duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, place?.lat, place?.lon]);
  return null;
}

export default function SkyMap({ place, result, selectedId, onPick, onSelectStar }: Props) {
  const placed = useMemo(() => {
    if (!result) return [];
    const gs = result.stars.map(s => s.g);
    const gMin = Math.min(...gs);
    const span = Math.max(Math.max(...gs) - gMin, 1);
    return result.stars
      .map(s => {
        const bright = 1 - (s.g - gMin) / span;
        return { s, pos: starToLatLng(result.frame, s.ra, s.dec), r: 2.5 + 7 * bright * bright, color: starColor(s) };
      })
      .sort((a, b) => b.s.g - a.s.g); // bright on top
  }, [result]);

  const radiusDeg = useMemo(() => {
    if (!result) return 0;
    return Math.max(...result.stars.map(s => result.frame.offset(s.ra, s.dec).sep), 0.01);
  }, [result]);

  const zenith = placed.find(p => p.s.id === result?.zenithId);
  const selected = selectedId && selectedId !== result?.zenithId ? placed.find(p => p.s.id === selectedId) : undefined;

  return (
    <MapContainer
      className="map"
      center={[30, 5]}
      zoom={3}
      minZoom={2}
      worldCopyJump
      preferCanvas
      renderer={renderer}
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        // Plain OSM tiles (no API key), turned into a night map by CSS (see .leaflet-tile-pane).
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <ClickToPick onPick={onPick} />
      <FollowView place={place} result={result} radiusDeg={radiusDeg} />
      {result && (
        <Circle
          center={[result.frame.lat, result.frame.lon]}
          radius={radiusDeg * KM_PER_DEG * 1000}
          pathOptions={{ color: '#e9e7e2', weight: 1, opacity: 0.25, dashArray: '2 5', fill: false }}
          interactive={false}
        />
      )}
      {placed.map(({ s, pos, r, color }) => (
        <CircleMarker
          key={s.id}
          center={pos}
          radius={r}
          pathOptions={{ stroke: false, fillColor: color, fillOpacity: 0.95 }}
          eventHandlers={{ click: e => (L.DomEvent.stopPropagation(e), onSelectStar(s.id)) }}
        />
      ))}
      {place && <Marker position={[place.lat, place.lon]} icon={placeIcon} interactive={false} />}
      {zenith && (
        <Marker position={zenith.pos} icon={zenithIcon} eventHandlers={{ click: () => onSelectStar(zenith.s.id) }} />
      )}
      {selected && <Marker position={selected.pos} icon={selectedIcon} interactive={false} />}
    </MapContainer>
  );
}
