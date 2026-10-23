/**
 * Everything needed to reproduce a search lives in the URL, so any result can
 * be shared or bookmarked — no server required.
 *   ?lat=41.38&lon=2.17&t=2025-07-28T10:29Z&depth=all&star=4057…
 * `t` is omitted for "right now".
 */
import { DEPTHS, type Depth } from './sky/gaia';

export interface UrlState {
  lat: number;
  lon: number;
  /** Absent means "now". */
  t: Date | null;
  depth: Depth;
  star: string | null;
}

export function readUrl(search = window.location.search): UrlState | null {
  const p = new URLSearchParams(search);
  const lat = Number(p.get('lat'));
  const lon = Number(p.get('lon'));
  if (!p.has('lat') || !p.has('lon') || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const tRaw = p.get('t');
  const t = tRaw ? new Date(tRaw) : null;
  const depth = DEPTHS.includes(p.get('depth') as Depth) ? (p.get('depth') as Depth) : 'all';
  return { lat, lon, t: t && !Number.isNaN(t.getTime()) ? t : null, depth, star: p.get('star') };
}

export function urlFor(s: UrlState): string {
  const p = new URLSearchParams({ lat: s.lat.toFixed(5), lon: s.lon.toFixed(5) });
  if (s.t) p.set('t', s.t.toISOString().replace(/:00\.000Z$/, 'Z'));
  p.set('depth', s.depth);
  if (s.star) p.set('star', s.star);
  return `${window.location.pathname}?${p}`;
}

export function writeUrl(s: UrlState) {
  window.history.replaceState(null, '', urlFor(s));
}
