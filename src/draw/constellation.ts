/**
 * The finder chart: a constellation's stick figure, its IAU boundary, the
 * bright stars and their names, the ground below, and the star marked.
 */
import { densify, dot, cross, norm, type Pt, type SkyChartData } from '../sky/constellation';
import { temperatureToRgb } from '../sky/physics';
import { radecToVec, type Vec3 } from '../sky/zenith';
import { drawTargetMarker, type Box } from './canvas';

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

function bvToRgb(bv: number | null): string {
  if (bv === null) return 'rgb(235,235,245)';
  // Ballesteros (2012): B−V → temperature.
  const t = 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
  const [r, g, b] = temperatureToRgb(t);
  return `rgb(${r},${g},${b})`;
}

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
export interface ChartOptions {
  sky: SkyChartData;
  /** IAU abbreviation of the constellation, e.g. "UMa". */
  abbr: string;
  target: ChartTarget;
  style: ChartStyle;
  ground?: ChartGround | null;
  furniture?: ChartFurniture | null;
}

export function drawConstellation(
  ctx: CanvasRenderingContext2D,
  box: Box,
  { sky, abbr, target, style, ground = null, furniture = null }: ChartOptions,
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
