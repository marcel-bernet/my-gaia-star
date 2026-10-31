import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useMemo, useState } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { SERVICES } from '../config';
import type { GroundShape } from '../sky/constellation';
import type { Star } from '../sky/gaia';
import { starToLatLng } from '../sky/zenith';
import { dotScale, magnitudeScale, STAR_RADII, starTint } from '../draw/mapStars';
import { INK, MAP_LINE, MAP_SKY_OPACITY, PLATE, SIGNAL } from '../draw/theme';
import { starColor } from '../sky/physics';
import type { Result } from '../types';

interface Props {
  place: { lat: number; lon: number } | null;
  result: Pick<Result, 'frame' | 'stars' | 'zenithId'> | null;
  selectedId: string | null;
  onPick: (lat: number, lon: number) => void;
  onSelectStar: (id: string) => void;
  /** The selected star's constellation, laid on the ground. */
  overlay: (GroundShape & { name: string }) | null;
  /** False while the map is put away; Leaflet needs its size re-read when it comes back. */
  visible: boolean;
}

interface Placed {
  s: Star;
  pos: ReturnType<typeof starToLatLng>;
  /** Radius of its brightness class, before scaling to the screen. */
  r: number;
}

/** The star dots, sized to how large the search circle is on screen right now. */
function StarDots({
  placed,
  centre,
  radiusDeg,
  zenithId,
  onSelectStar,
}: {
  placed: Placed[];
  centre: [number, number];
  radiusDeg: number;
  zenithId: string | undefined;
  onSelectStar: Props['onSelectStar'];
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  // The circle's radius in screen pixels at this zoom (Web Mercator: 256 px tiles).
  const metresPerPx = (40075016.686 * Math.cos((centre[0] * Math.PI) / 180)) / 2 ** (zoom + 8);
  const k = dotScale((radiusDeg * KM_PER_DEG * 1000) / metresPerPx);
  return placed.map(({ s, pos, r }) => (
    <CircleMarker
      key={s.id}
      // A point of light tinted with the star's own colour; a ring of the plate keeps neighbours apart. Yours is the orange one.
      center={pos}
      radius={r * k + 0.5}
      pathOptions={{
        color: PLATE,
        weight: 1,
        opacity: 1,
        fillColor: s.id === zenithId ? SIGNAL : starTint(starColor(s)),
        fillOpacity: 1,
      }}
      eventHandlers={{ click: e => (L.DomEvent.stopPropagation(e), onSelectStar(s.id)) }}
    />
  ));
}

function Remeasure({ visible }: { visible: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (visible) map.invalidateSize({ pan: false });
  }, [map, visible]);
  return null;
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
  result: Props['result'];
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

export default function SkyMap({ place, result, selectedId, onPick, onSelectStar, overlay, visible }: Props) {
  const placed = useMemo(() => {
    if (!result) return [];
    const scale = magnitudeScale(result.stars.map(s => s.g));
    return result.stars
      .map(s => ({ s, pos: starToLatLng(result.frame, s.ra, s.dec), r: STAR_RADII[scale.classOf(s.g)] }))
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
        // Plain OSM tiles (no API key), printed in grey on the page by CSS (see .leaflet-tile-pane).
        attribution={SERVICES.tilesAttribution}
        url={SERVICES.tiles}
        maxZoom={19}
      />
      <ClickToPick onPick={onPick} />
      <Remeasure visible={visible} />
      <FollowView place={place} result={result} radiusDeg={radiusDeg} overlayOn={!!overlay} />
      {result && (
        <Circle
          center={[result.frame.lat, result.frame.lon]}
          radius={radiusDeg * KM_PER_DEG * 1000}
          // The sky overhead: a dark plate framed in ink, laid over the map.
          pathOptions={{ color: INK, weight: 1, opacity: 1, fillColor: PLATE, fillOpacity: MAP_SKY_OPACITY }}
          interactive={false}
        />
      )}
      {result && (
        <StarDots
          placed={placed}
          centre={[result.frame.lat, result.frame.lon]}
          radiusDeg={radiusDeg}
          zenithId={result.zenithId}
          onSelectStar={onSelectStar}
        />
      )}
      <FitOverlay overlay={overlay} />
      {overlay && (
        <>
          {overlay.bounds.map((b, i) => (
            <Polyline
              key={`b${i}`}
              positions={b}
              pathOptions={{ color: MAP_LINE, weight: 1, opacity: 0.9, dashArray: '3 5' }}
              interactive={false}
            />
          ))}
          {overlay.lines.map((l, i) => (
            <Polyline
              key={`l${i}`}
              positions={l}
              pathOptions={{ color: MAP_LINE, weight: 1.5, opacity: 1 }}
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
