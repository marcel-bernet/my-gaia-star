/**
 * Which constellation a star is in (IAU boundaries, via astronomy-engine),
 * and a finder chart of it: the stick figure, the boundary, the bright stars
 * and their names, with the star marked.
 */
import { Constellation } from 'astronomy-engine';
import type { Lang } from '../i18n';
import { fetchBundled, once } from '../lib/cache';
import { temperatureToRgb } from './physics';
import { radecToVec, starToLatLng, vecToRadec, type SkyFrame, type Vec3 } from './zenith';

type Pt = [number, number]; // [ra°, dec°]

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

function dot(a: Vec3, b: Vec3) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm(a: Vec3): Vec3 {
  const n = Math.hypot(...a);
  return [a[0] / n, a[1] / n, a[2] / n];
}

/**
 * Stereographic projection centred on `c`, as seen looking up at the sky:
 * north up, east to the left. Returns unitless plane coordinates.
 */
function projector(c: Vec3) {
  const pole: Vec3 = Math.abs(c[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  const east = norm(cross(pole, c));
  const north = cross(c, east);
  return (ra: number, dec: number): Pt | null => {
    const v = radecToVec(ra, dec);
    const z = dot(v, c);
    if (z < -0.2) return null; // far side
    const k = 2 / (1 + z);
    return [-k * dot(v, east), k * dot(v, north)];
  };
}

/** Follows IAU boundary edges along their constant-RA / constant-Dec arcs. */
function densify(poly: Pt[]): Pt[] {
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

function bvToRgb(bv: number | null): string {
  if (bv === null) return 'rgb(235,235,245)';
  // Ballesteros (2012): B−V → temperature.
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const [r, g, b] = temperatureToRgb(t);
  return `rgb(${r},${g},${b})`;
}

// ---- Drawing -------------------------------------------------------------

export interface ChartStyle {
  gold: string;
  cream: string;
  muted: string;
  font: string;
  /** Scales strokes, dots and labels; 1 ≈ a 400 px wide chart. */
  scale: number;
}

export interface ChartTarget {
  ra: number;
  dec: number;
  label: string;
}

/** The ground under the stars: outlines already turned into sky positions. */
export interface ChartGround {
  /** [ra°, dec°] rings. */
  rings: Pt[][];
  /** The zenith, which lies over the place itself. */
  zenith: { ra: number; dec: number };
}

/** Compass and a scale bar in degrees. */
export interface ChartFurniture {
  north: string;
  east: string;
}

/**
 * Draws the finder chart for constellation `abbr` into the box, framed on
 * the constellation's boundary and the target star.
 */
export function drawConstellation(
  ctx: CanvasRenderingContext2D,
  box: { x: number; y: number; w: number; h: number },
  sky: SkyChartData,
  abbr: string,
  target: ChartTarget,
  style: ChartStyle,
  ground: ChartGround | null = null,
  furniture: ChartFurniture | null = null,
) {
  const con = sky.constellations[abbr];
  const bounds = con.bounds.map(densify);
  const boundVecs = bounds.flat().map(([ra, dec]) => radecToVec(ra, dec));
  const tv = radecToVec(target.ra, target.dec);
  const sum = boundVecs.reduce<Vec3>((a, v) => [a[0] + v[0], a[1] + v[1], a[2] + v[2]], [0, 0, 0]);
  const centre = norm(sum[0] || sum[1] || sum[2] ? sum : tv);
  const project = projector(centre);

  // Frame: the boundary plus the star, with a margin, keeping aspect ratio.
  const framePts = [...bounds.flat(), [target.ra, target.dec] as Pt]
    .map(([ra, dec]) => project(ra, dec))
    .filter((p): p is Pt => p !== null);
  const xs = framePts.map(p => p[0]);
  const ys = framePts.map(p => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const pad = 0.12;
  const s = Math.min(box.w / ((x1 - x0) * (1 + 2 * pad) || 1), box.h / ((y1 - y0) * (1 + 2 * pad) || 1));
  const cx = box.x + box.w / 2 - ((x0 + x1) / 2) * s;
  const cy = box.y + box.h / 2 + ((y0 + y1) / 2) * s;
  const toPx = (p: Pt): Pt => [cx + p[0] * s, cy - p[1] * s];
  const at = (ra: number, dec: number) => {
    const p = project(ra, dec);
    return p ? toPx(p) : null;
  };
  const k = style.scale;
  const path = (pts: Pt[], close: boolean) => {
    let pen = false;
    for (const [ra, dec] of pts) {
      const p = at(ra, dec);
      if (!p) {
        pen = false;
        continue;
      }
      if (pen) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
      pen = true;
    }
    if (close) ctx.closePath();
  };

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();

  // The ground below, as seen from underneath: under everything else.
  if (ground) {
    ctx.beginPath();
    for (const ring of ground.rings) path(ring, true);
    ctx.fillStyle = 'rgba(120,150,200,0.13)';
    ctx.fill('evenodd');
    ctx.strokeStyle = 'rgba(160,180,220,0.6)';
    ctx.lineWidth = 1 * k;
    ctx.lineJoin = 'round';
    ctx.stroke();
  }

  // Constellation area, softly lit.
  ctx.beginPath();
  for (const poly of bounds) path(poly, true);
  ctx.fillStyle = 'rgba(120,140,220,0.05)';
  ctx.fill('evenodd');
  ctx.setLineDash([2 * k, 4 * k]);
  ctx.strokeStyle = 'rgba(143,151,173,0.38)';
  ctx.lineWidth = 1 * k;
  ctx.stroke();
  ctx.setLineDash([]);

  // Stick figure.
  ctx.strokeStyle = style.gold;
  ctx.globalAlpha = 0.42;
  ctx.lineWidth = 1.2 * k;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of con.lines) {
    ctx.beginPath();
    path(line, false);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Stars, faint first.
  const visible = sky.stars
    .map(st => ({ st, p: at(st[0], st[1]) }))
    .filter(({ p }) => p && p[0] > box.x - 10 && p[0] < box.x + box.w + 10 && p[1] > box.y - 10 && p[1] < box.y + box.h + 10)
    .sort((a, b) => b.st[2] - a.st[2]);
  const radius = (mag: number) => Math.max(0.6, (6.2 - mag) * 0.78) * k;
  for (const { st, p } of visible) {
    const r = radius(st[2]);
    const color = bvToRgb(st[3]);
    if (st[2] < 1.5) {
      const g = ctx.createRadialGradient(p![0], p![1], 0, p![0], p![1], r * 3);
      g.addColorStop(0, color.replace('rgb(', 'rgba(').replace(')', ',0.3)'));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p![0], p![1], r * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = st[2] > 5 ? 0.6 : 1;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p![0], p![1], r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Names for the brightest, wherever they don't collide (with each other or the star's label).
  const tp = at(target.ra, target.dec);
  const taken: [number, number, number, number][] = [];
  if (tp) taken.push([tp[0] - 26 * k, tp[1] - 26 * k, tp[0] + 26 * k, tp[1] + 26 * k]);
  const free = (b: [number, number, number, number]) =>
    b[0] > box.x + 2 &&
    b[2] < box.x + box.w - 2 &&
    b[1] > box.y + 2 &&
    b[3] < box.y + box.h - 2 &&
    taken.every(o => b[2] < o[0] || b[0] > o[2] || b[3] < o[1] || b[1] > o[3]);
  ctx.font = `400 ${Math.round(10.5 * k)}px ${style.font}`;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (const { st, p } of [...visible].reverse()) {
    if (!st[4] || st[2] > 3.6) continue;
    const tw = ctx.measureText(st[4]).width;
    const x = p![0] + radius(st[2]) + 4 * k;
    const fh = 11 * k;
    const b: [number, number, number, number] = [x - 1, p![1] - fh / 2, x + tw + 1, p![1] + fh / 2];
    if (!free(b)) continue;
    taken.push(b);
    ctx.fillStyle = style.muted;
    ctx.fillText(st[4], x, p![1]);
  }

  // The zenith, over the place itself.
  if (ground) {
    const z = at(ground.zenith.ra, ground.zenith.dec);
    if (z) {
      ctx.strokeStyle = 'rgba(200,210,235,0.7)';
      ctx.lineWidth = 1 * k;
      ctx.beginPath();
      ctx.arc(z[0], z[1], 2.2 * k, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // The star.
  if (tp) {
    drawTargetMarker(ctx, tp[0], tp[1], 8 * k, style.gold);
    ctx.font = `600 ${Math.round(12 * k)}px ${style.font}`;
    const right = tp[0] < box.x + box.w * 0.7;
    const above = tp[1] > box.y + 30 * k;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.textBaseline = above ? 'bottom' : 'top';
    const lx = tp[0] + (right ? 1 : -1) * 15 * k;
    const ly = tp[1] + (above ? -15 : 15) * k;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,6,14,0.9)';
    ctx.lineWidth = 3.5 * k;
    ctx.strokeText(target.label, lx, ly);
    ctx.fillStyle = style.gold;
    ctx.fillText(target.label, lx, ly);
  }
  ctx.restore();

  if (furniture) {
    // Looking up: north at the top, east to the left.
    ctx.save();
    const ox = box.x + 22 * k;
    const oy = box.y + 24 * k;
    ctx.strokeStyle = style.muted;
    ctx.fillStyle = style.muted;
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox, oy - 14 * k);
    ctx.moveTo(ox, oy);
    ctx.lineTo(ox - 14 * k, oy);
    ctx.stroke();
    ctx.font = `500 ${Math.round(9.5 * k)}px ${style.font}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(furniture.north, ox, oy - 15 * k);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(furniture.east, ox - 16 * k, oy);
    // Stereographic scale is 1 at the centre: one degree is π/180 plane units.
    const perDeg = (Math.PI / 180) * s;
    const deg = [1, 2, 5, 10, 20, 30].reduce((best, d) => (d * perDeg <= box.w * 0.28 ? d : best), 1);
    const bx = box.x + box.w - 14 * k;
    const by = box.y + box.h - 12 * k;
    ctx.beginPath();
    ctx.moveTo(bx - deg * perDeg, by - 3 * k);
    ctx.lineTo(bx - deg * perDeg, by);
    ctx.lineTo(bx, by);
    ctx.lineTo(bx, by - 3 * k);
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${deg}°`, bx - (deg * perDeg) / 2, by - 4 * k);
    ctx.restore();
  }
}

/** A bold, high-contrast "here it is" mark: dark halo under a gold ring and ticks. */
export function drawTargetMarker(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, gold: string) {
  const ticks = () => {
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    for (const [dx, dy] of [
      [0, -1],
      [1, 0],
      [0, 1],
      [-1, 0],
    ]) {
      ctx.moveTo(x + dx * size * 1.45, y + dy * size * 1.45);
      ctx.lineTo(x + dx * size * 2.3, y + dy * size * 2.3);
    }
  };
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(4,6,14,0.85)';
  ctx.lineWidth = Math.max(3, size * 0.55);
  ticks();
  ctx.stroke();
  ctx.strokeStyle = gold;
  ctx.lineWidth = Math.max(1.5, size * 0.22);
  ticks();
  ctx.stroke();
  ctx.fillStyle = gold;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1.5, size * 0.28), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
