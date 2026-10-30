import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { SERVICES } from '../config';
import type { GroundShape } from '../sky/constellation';
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
  /** The selected star's constellation, laid on the ground. */
  overlay: (GroundShape & { name: string }) | null;
}

const placeIcon = L.divIcon({ className: 'place-pin', html: '<span></span>', iconSize: [28, 28] });
// A reticle rather than a glow: ring plus four ticks.
const zenithIcon = L.divIcon({ className: 'zenith-pin', html: '<span></span><i></i><i></i><i></i><i></i>', iconSize: [44, 44] });
const selectedIcon = L.divIcon({ className: 'selected-pin', html: '<span></span>', iconSize: [34, 34] });

const KM_PER_DEG = 111.32;

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
// Star dots are a few pixels across; give fingers a wider catch area.
const renderer = L.canvas({ tolerance: window.matchMedia('(pointer: coarse)').matches ? 12 : 3 });
const wide = () => window.matchMedia('(min-width: 761px)').matches;

function ClickToPick({ onPick }: { onPick: Props['onPick'] }) {
  useMapEvents({ click: e => onPick(e.latlng.lat, L.Util.wrapNum(e.latlng.lng, [-180, 180], true)) });
  return null;
}

function FollowView({
  place,
  result,
  radiusDeg,
  overlayOn,
}: {
  place: Props['place'];
  result: MapResult | null;
  radiusDeg: number;
  /** While the constellation is shown, FitOverlay frames the map instead. */
  overlayOn: boolean;
}) {
  const map = useMap();
  useEffect(() => {
    if (result && !overlayOn) {
      const { lat, lon } = result.frame;
      const r = radiusDeg * 1.08;
      const cos = Math.max(Math.cos((lat * Math.PI) / 180), 0.05);
      map.flyToBounds(
        [
          [Math.max(-85, lat - r), lon - r / cos],
          [Math.min(85, lat + r), lon + r / cos],
        ],
        // Leave room at the top for the readout that sits over the map.
        { duration: 1.4, paddingTopLeft: [24, wide() ? 72 : 48], paddingBottomRight: [24, 24] },
      );
    }
  }, [map, result, radiusDeg, overlayOn]);
  useEffect(() => {
    if (place && !result) map.flyTo([place.lat, place.lon], Math.max(map.getZoom(), 9), { duration: 1.2 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, place?.lat, place?.lon]);
  return null;
}

/** When the constellation appears, step back to show all of it. */
function FitOverlay({ overlay }: { overlay: Props['overlay'] }) {
  const map = useMap();
  const shown = overlay ? `${overlay.name} ${overlay.centre.map(v => v.toFixed(2))}` : null;
  useEffect(() => {
    if (!overlay) return;
    const pts = overlay.bounds.flat();
    map.flyToBounds(L.latLngBounds(pts.map(([lat, lon]) => L.latLng(Math.max(-85, Math.min(85, lat)), lon))), {
      duration: 1.4,
      paddingTopLeft: [24, wide() ? 72 : 48],
      paddingBottomRight: [24, 24],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, shown]);
  return null;
}

export default function SkyMap({ place, result, selectedId, onPick, onSelectStar, overlay }: Props) {
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
        attribution={SERVICES.tilesAttribution}
        url={SERVICES.tiles}
        maxZoom={19}
      />
      <ClickToPick onPick={onPick} />
      <FollowView place={place} result={result} radiusDeg={radiusDeg} overlayOn={!!overlay} />
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
      <FitOverlay overlay={overlay} />
      {overlay && (
        <>
          {overlay.bounds.map((b, i) => (
            <Polyline
              key={`b${i}`}
              positions={b}
              pathOptions={{ color: '#9aa3bd', weight: 1.2, opacity: 0.7, dashArray: '3 5' }}
              interactive={false}
            />
          ))}
          {overlay.lines.map((l, i) => (
            <Polyline
              key={`l${i}`}
              positions={l}
              pathOptions={{ color: '#e8c98f', weight: 2, opacity: 0.85 }}
              interactive={false}
            />
          ))}
          <Marker
            position={overlay.centre}
            icon={L.divIcon({
              className: 'constellation-label',
              html: `<span>${escapeHtml(overlay.name)}</span>`,
              iconSize: [0, 0],
            })}
            interactive={false}
          />
        </>
      )}
      {place && <Marker position={[place.lat, place.lon]} icon={placeIcon} interactive={false} />}
      {zenith && <Marker position={zenith.pos} icon={zenithIcon} eventHandlers={{ click: () => onSelectStar(zenith.s.id) }} />}
      {selected && <Marker position={selected.pos} icon={selectedIcon} interactive={false} />}
    </MapContainer>
  );
}
