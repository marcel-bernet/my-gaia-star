/**
 * Which constellation a star is in (IAU boundaries, via astronomy-engine),
 * the bundled chart data (figures, boundaries, bright stars), and the
 * constellation laid on the ground for the map. The finder chart itself is
 * drawn by src/draw/constellation.ts.
 */
import { Constellation } from 'astronomy-engine';
import type { Lang } from '../i18n';
import { fetchBundled, once } from '../lib/cache';
import { radecToVec, starToLatLng, vecToRadec, type SkyFrame, type Vec3 } from './zenith';

export type Pt = [number, number]; // [ra°, dec°]

interface ConstellationData {
  names: Record<Lang, string>;
  lines: Pt[][];
  bounds: Pt[][];
}

/** [ra°, dec°, V mag, B−V, proper name] — Hipparcos stars to V 5.8. */
type ChartStar = [number, number, number, number | null, string | null];

export interface SkyChartData {
  constellations: Record<string, ConstellationData>;
  stars: ChartStar[];
}

export const loadSkyChart = once(() => fetchBundled<SkyChartData>('sky-chart.json'));

/** IAU abbreviation, e.g. "UMa". */
export function constellationOf(raDeg: number, decDeg: number): string {
  return Constellation(raDeg / 15, decDeg).symbol;
}

// ---- Projection ----------------------------------------------------------

export function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
export function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
export function norm(a: Vec3): Vec3 {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
}

/** Follows IAU boundary edges along their constant-RA / constant-Dec arcs. */
export function densify(poly: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const [ra0, dec0] = poly[i];
    const [ra1, dec1] = poly[(i + 1) % poly.length];
    let dra = ra1 - ra0;
    if (dra > 180) dra -= 360;
    if (dra < -180) dra += 360;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dra), Math.abs(dec1 - dec0))));
    for (let s = 0; s < steps; s++) out.push([ra0 + (dra * s) / steps, dec0 + ((dec1 - dec0) * s) / steps]);
  }
  return out;
}

// ---- On the ground -------------------------------------------------------

/** Points every ~0.5° along the great circle from a to b (inclusive of a, not b). */
function greatCircle(a: Pt, b: Pt): Pt[] {
  const va = radecToVec(a[0], a[1]);
  const vb = radecToVec(b[0], b[1]);
  const ang = Math.acos(Math.max(-1, Math.min(1, dot(va, vb))));
  const steps = Math.max(1, Math.ceil(ang / ((0.5 * Math.PI) / 180)));
  const out: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const f = i / steps;
    // Spherical interpolation.
    const sa = Math.sin((1 - f) * ang) / (Math.sin(ang) || 1);
    const sb = Math.sin(f * ang) / (Math.sin(ang) || 1);
    const v: Vec3 = ang < 1e-9 ? va : [va[0] * sa + vb[0] * sb, va[1] * sa + vb[1] * sb, va[2] * sa + vb[2] * sb];
    const { ra, dec } = vecToRadec(v);
    out.push([ra, dec]);
  }
  return out;
}

export interface GroundShape {
  /** [lat, lon] polylines. */
  lines: [number, number][][];
  bounds: [number, number][][];
  /** Where to write the name. */
  centre: [number, number];
}

/** A constellation laid on the ground the way the map lays the stars: one degree of sky for one degree of ground. */
export function constellationOnGround(frame: SkyFrame, sky: SkyChartData, abbr: string): GroundShape {
  const con = sky.constellations[abbr];
  const toGround = ([ra, dec]: Pt) => starToLatLng(frame, ra, dec);
  const lines = con.lines.map(line => {
    const pts: Pt[] = [];
    for (let i = 0; i < line.length - 1; i++) pts.push(...greatCircle(line[i], line[i + 1]));
    pts.push(line[line.length - 1]);
    return pts.map(toGround);
  });
  const bounds = con.bounds.map(poly => {
    const pts = densify(poly);
    return [...pts, pts[0]].map(toGround);
  });
  const all = bounds.flat();
  const lat = all.reduce((a, p) => a + p[0], 0) / all.length;
  const lon = all.reduce((a, p) => a + p[1], 0) / all.length;
  return { lines, bounds, centre: [lat, lon] };
}
