/**
 * Which constellation a star is in (IAU boundaries, via astronomy-engine),
 * and a finder chart of it: the stick figure, the boundary, the bright stars
 * and their names, with the star marked.
 */
import { Constellation } from 'astronomy-engine';
import type { Lang } from '../i18n';
import { temperatureToRgb } from './physics';
import { radecToVec, type Vec3 } from './zenith';

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

let data: Promise<SkyChartData> | null = null;
export function loadSkyChart(): Promise<SkyChartData> {
  data ??= fetch(`${import.meta.env.BASE_URL}sky-chart.json`)
    .then(r => {
      if (!r.ok) throw new Error(`sky-chart.json: HTTP ${r.status}`);
      return r.json() as Promise<SkyChartData>;
    })
    .catch(e => {
      data = null;
      throw e;
    });
  return data;
}

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

  ctx.save();
  ctx.beginPath();
  ctx.rect(box.x, box.y, box.w, box.h);
  ctx.clip();

  // Constellation area, softly lit.
  ctx.beginPath();
  for (const poly of bounds) {
    poly.forEach(([ra, dec], i) => {
      const p = at(ra, dec);
      if (!p) return;
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
  }
  ctx.fillStyle = 'rgba(120,140,220,0.07)';
  ctx.fill('evenodd');
  ctx.setLineDash([4 * k, 5 * k]);
  ctx.strokeStyle = 'rgba(143,151,173,0.45)';
  ctx.lineWidth = 1.2 * k;
  ctx.stroke();
  ctx.setLineDash([]);

  // Stick figure.
  ctx.strokeStyle = style.gold;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.6 * k;
  ctx.lineCap = 'round';
  for (const line of con.lines) {
    ctx.beginPath();
    line.forEach(([ra, dec], i) => {
      const p = at(ra, dec);
      if (!p) return;
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Stars, faint first; names for the brightest inside the frame.
  const visible = sky.stars
    .map(st => ({ st, p: at(st[0], st[1]) }))
    .filter(({ p }) => p && p[0] > box.x - 10 && p[0] < box.x + box.w + 10 && p[1] > box.y - 10 && p[1] < box.y + box.h + 10)
    .sort((a, b) => b.st[2] - a.st[2]);
  for (const { st, p } of visible) {
    const r = Math.max(0.7, (6.4 - st[2]) * 0.95) * k;
    const color = bvToRgb(st[3]);
    if (st[2] < 2.5) {
      const g = ctx.createRadialGradient(p![0], p![1], 0, p![0], p![1], r * 3.5);
      g.addColorStop(0, color.replace('rgb(', 'rgba(').replace(')', ',0.35)'));
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p![0], p![1], r * 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p![0], p![1], r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.font = `400 ${Math.round(11 * k)}px ${style.font}`;
  ctx.fillStyle = style.muted;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (const { st, p } of visible) {
    if (st[4]) ctx.fillText(st[4], p![0] + (6.4 - st[2]) * k + 5 * k, p![1]);
  }

  // The star.
  const tp = at(target.ra, target.dec);
  if (tp) {
    drawTargetMarker(ctx, tp[0], tp[1], 9 * k, style.gold);
    ctx.font = `600 ${Math.round(12 * k)}px ${style.font}`;
    const right = tp[0] < box.x + box.w * 0.7;
    const above = tp[1] > box.y + 30 * k;
    ctx.textAlign = right ? 'left' : 'right';
    ctx.textBaseline = above ? 'bottom' : 'top';
    const lx = tp[0] + (right ? 1 : -1) * 16 * k;
    const ly = tp[1] + (above ? -16 : 16) * k;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(4,6,14,0.9)';
    ctx.lineWidth = 3.5 * k;
    ctx.strokeText(target.label, lx, ly);
    ctx.fillStyle = style.gold;
    ctx.fillText(target.label, lx, ly);
  }
  ctx.restore();
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
