/**
 * The Milky Way, drawn (not photographed) from a simple density model: an
 * exponential disc with four logarithmic spiral arms at a 12° pitch, a bar
 * and a bulge. Because the model is a density, it can be sampled at any zoom:
 * the whole Galaxy face-on, a close-up of the Sun's neighbourhood, or the
 * disc seen edge-on.
 *
 * Face-on coordinates (kpc): Galactic Centre at the origin, Sun at (0, −8.2),
 * seen from the north Galactic pole. Edge-on: horizontal is the face-on y axis
 * (towards the centre), vertical is height above the mid-plane.
 */
import type { Star } from '../sky/gaia';
import {
  galacticHeightKpc,
  galacticPlanePosition,
  LY_PER_PC,
  SUN_GALACTOCENTRIC_KPC,
  SUN_HEIGHT_KPC,
  toGalactic,
} from '../sky/physics';
import { gauss, haloText, markWithLabel, rng, type Box } from './panels';
import { CREAM, GOLD, INK, MUTED } from './theme';

type Ctx = CanvasRenderingContext2D;

const SANS = '"Inter Variable", system-ui, sans-serif';
const DEG = Math.PI / 180;
const PITCH = 12 * DEG;
const ARMS = 4;
const ARM_PHASE = 0.4;
const DISC_SCALE_KPC = 3.5;
const DISC_EDGE_KPC = 16;
/** Closer than this, the views zoom in on the Sun and the star. */
const CLOSE_UP_KPC = 4;
const LY_PER_KPC = LY_PER_PC * 1000;

export interface GalaxyLabels {
  sun: string;
  yourStar: string;
  centre: string;
  /** Formats a scale-bar length, e.g. 1000 → "1,000 light-years". */
  scale: (ly: number) => string;
  /** Shown only if heights aren't to scale, e.g. "vertical scale ×0.4". */
  stretched: (x: number) => string;
}

/** How strongly a point lies on a spiral arm (0…1). */
function armStrength(x: number, y: number): number {
  const r = Math.hypot(x, y);
  if (r < 3) return 0;
  const theta = Math.atan2(y, x);
  const k = Math.tan(PITCH);
  let best = Math.PI;
  for (let a = 0; a < ARMS; a++) {
    const armTheta = Math.log(r / 3) / k + (a * 2 * Math.PI) / ARMS + ARM_PHASE;
    const d = Math.abs(((((theta - armTheta) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    best = Math.min(best, d);
  }
  const across = r * best * Math.sin(PITCH); // kpc, perpendicular to the arm
  const width = 0.3 + 0.04 * r;
  return Math.exp(-((across / width) ** 2));
}

function discDensity(x: number, y: number): { d: number; arm: number } {
  const r = Math.hypot(x, y);
  const arm = armStrength(x, y);
  const edge = r > DISC_EDGE_KPC ? Math.exp(-(r - DISC_EDGE_KPC) * 2) : 1;
  return { d: (0.22 + arm) * Math.exp(-r / DISC_SCALE_KPC) * edge, arm };
}

interface View {
  x: number;
  y: number;
  /** Half-width of the view, kpc. */
  r: number;
}

/** Fills a circle with the face-on Galaxy as seen through `view`. */
function paintFaceOn(ctx: Ctx, cx: number, cy: number, R: number, view: View, count: number, seed: number) {
  const s = R / view.r;
  const rand = rng(seed);
  const toPx = (x: number, y: number): [number, number] => [cx + (x - view.x) * s, cy - (y - view.y) * s];

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = 'rgba(8,11,24,0.9)';
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  const [gx, gy] = toPx(0, 0);
  const halo = ctx.createRadialGradient(gx, gy, 0, gx, gy, 15 * s);
  halo.addColorStop(0, 'rgba(120,130,190,0.28)');
  halo.addColorStop(0.6, 'rgba(60,70,130,0.08)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);

  // Rejection-sample the disc inside the view, normalised to the densest
  // point the view can contain, so a close-up is as rich as the full view.
  const nearest = Math.max(0, Math.hypot(view.x, view.y) - view.r * Math.SQRT2);
  const dMax = 1.22 * Math.exp(-nearest / DISC_SCALE_KPC);
  const dot = Math.max(1, R / 150);
  ctx.globalCompositeOperation = 'lighter';
  let placed = 0;
  for (let tries = 0; placed < count && tries < count * 60; tries++) {
    const x = view.x + (rand() * 2 - 1) * view.r;
    const y = view.y + (rand() * 2 - 1) * view.r;
    const { d, arm } = discDensity(x, y);
    if (rand() * dMax > d) continue;
    placed++;
    const pink = rand() < 0.06 * arm;
    ctx.fillStyle = pink ? 'rgba(255,140,180,0.7)' : `rgba(170,190,255,${0.18 + 0.22 * arm})`;
    const [px, py] = toPx(x, y);
    const sz = pink ? dot * 1.6 : dot;
    ctx.fillRect(px, py, sz, sz);
  }
  // Bar, tilted ~27° to the Sun–centre line, and the bulge glow.
  if (Math.hypot(view.x, view.y) < view.r * 1.5 + 4) {
    const c = Math.cos(27 * DEG);
    const sn = Math.sin(27 * DEG);
    for (let i = 0; i < count / 5; i++) {
      const bx = gauss(rand) * 2.2;
      const by = gauss(rand) * 0.7;
      const [px, py] = toPx(bx * c - by * sn, bx * sn + by * c);
      ctx.fillStyle = 'rgba(255,225,170,0.14)';
      ctx.fillRect(px, py, dot, dot);
    }
    const core = ctx.createRadialGradient(gx, gy, 0, gx, gy, 3.5 * s);
    core.addColorStop(0, 'rgba(255,236,200,0.9)');
    core.addColorStop(0.3, 'rgba(255,210,150,0.35)');
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(gx, gy, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  return toPx;
}

/** A round number of light-years about `target` long. */
function niceLy(target: number): number {
  const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  return steps.reduce((best, s) => (Math.abs(Math.log(s / target)) < Math.abs(Math.log(best / target)) ? s : best));
}

function scaleBar(ctx: Ctx, x: number, y: number, kpcToPx: number, targetLy: number, label: (ly: number) => string, fontPx: number) {
  const ly = niceLy(targetLy);
  const w = (ly / LY_PER_KPC) * kpcToPx;
  ctx.save();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(1.5, fontPx / 10);
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y - fontPx * 0.3);
  ctx.lineTo(x - w / 2, y);
  ctx.lineTo(x + w / 2, y);
  ctx.lineTo(x + w / 2, y - fontPx * 0.3);
  ctx.stroke();
  ctx.font = `500 ${Math.round(fontPx * 0.85)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  haloText(ctx, label(ly), x, y - fontPx * 0.4, CREAM);
  ctx.restore();
}

/** The view both pictures share: zoomed on the Sun and the star when it is near. */
function viewFor(star: Star): { view: View; zoom: boolean } {
  const p = galacticPlanePosition(star);
  const sunY = -SUN_GALACTOCENTRIC_KPC;
  if (p) {
    const d = Math.hypot(p.x, p.y - sunY);
    if (d < CLOSE_UP_KPC) {
      return { view: { x: p.x / 2, y: (p.y + sunY) / 2, r: Math.max(0.25, d * 0.85 + 0.15) }, zoom: true };
    }
  }
  return { view: { x: 0, y: 0, r: 17 }, zoom: false };
}

export function isCloseUp(star: Star): boolean {
  return viewFor(star).zoom;
}

/** The Galaxy seen from above, with the Sun and the star marked. */
export function drawGalaxyFaceOn(ctx: Ctx, box: Box, star: Star, labels: GalaxyLabels) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const R = Math.min(box.w, box.h) / 2;
  const fontPx = Math.max(12, Math.round(box.w / 18));
  const { view, zoom } = viewFor(star);
  const s = R / view.r;
  const toPx = paintFaceOn(ctx, cx, cy, R, view, zoom ? 7000 : 12000, 1977);
  const p = galacticPlanePosition(star);
  const [sx, sy] = toPx(0, -SUN_GALACTOCENTRIC_KPC);

  // Distance unknown, direction known: a sight-line from the Sun to the edge.
  const { l } = toGalactic(star.ra, star.dec);
  const dir = { x: -Math.sin(l * DEG), y: -Math.cos(l * DEG) }; // canvas coords
  const ox = sx - cx;
  const oy = sy - cy;
  const b = ox * dir.x + oy * dir.y;
  const reach = -b + Math.sqrt(Math.max(0, b * b - (ox * ox + oy * oy - R * R)));
  if (!p) {
    ctx.save();
    ctx.setLineDash([R / 30, R / 40]);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(2, R / 70);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dir.x * reach, sy + dir.y * reach);
    ctx.stroke();
    ctx.restore();
  }

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(143,151,173,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
  // The Sun: a ring, labelled clear of the star's marker and sight-line.
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(1.5, R / 110);
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(4, R / 40), 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `500 ${fontPx}px ${SANS}`;
  const starPx = p ? toPx(p.x, p.y) : null;
  const starBelow = starPx ? starPx[1] > sy : !p && dir.y > 0.3;
  ctx.textAlign = 'center';
  ctx.textBaseline = starBelow ? 'bottom' : 'top';
  haloText(ctx, labels.sun, sx, sy + (starBelow ? -1 : 1) * R * 0.09, CREAM);
  ctx.restore();

  if (starPx) {
    markWithLabel(ctx, starPx[0], starPx[1], R / 16, labels.yourStar, Math.round(fontPx * 1.05), box);
  } else {
    const side = dir.x <= 0 ? 1 : -1;
    const lx = sx + dir.x * reach * 0.55 + -dir.y * side * fontPx * 0.9;
    const ly = sy + dir.y * reach * 0.55 + dir.x * side * fontPx * 0.9;
    ctx.font = `600 ${fontPx}px ${SANS}`;
    ctx.textAlign = side > 0 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    haloText(ctx, labels.yourStar, lx, ly, GOLD);
  }

  if (zoom) {
    // Which way the centre is, a scale, and where this patch sits in the Galaxy.
    ctx.font = `500 ${Math.round(fontPx * 0.85)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    haloText(ctx, `↑ ${labels.centre}`, cx, cy - R * 0.92, MUTED);
    scaleBar(ctx, cx, cy + R * 0.86, s, view.r * 0.6 * LY_PER_KPC, labels.scale, fontPx);

    const ri = R * 0.3;
    const ix = box.x + box.w - ri;
    const iy = box.y + ri;
    ctx.save();
    ctx.beginPath();
    ctx.arc(ix, iy, ri + 2, 0, Math.PI * 2);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.restore();
    const inset = paintFaceOn(ctx, ix, iy, ri, { x: 0, y: 0, r: 17 }, 2500, 7);
    ctx.save();
    ctx.beginPath();
    ctx.arc(ix, iy, ri, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(143,151,173,0.5)';
    ctx.lineWidth = 1;
    ctx.stroke();
    const [vx, vy] = inset(view.x, view.y);
    const half = Math.max(3, (view.r / 17) * ri);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.5, ri / 40);
    ctx.strokeRect(vx - half, vy - half, 2 * half, 2 * half);
    ctx.restore();
  }
}

/**
 * The Galaxy seen edge-on: how far above or below the mid-plane the star is.
 * Drawn to true scale (the disc really is that thin); only a star far off
 * the plane in the full view forces a different vertical scale, labelled.
 */
export function drawGalaxyEdgeOn(ctx: Ctx, box: Box, star: Star, labels: GalaxyLabels) {
  const fontPx = Math.max(11, Math.round(box.h / 7));
  const { zoom } = viewFor(star);
  const p = galacticPlanePosition(star);
  const z = galacticHeightKpc(star);
  const aspect = box.w / box.h;
  // True scale wherever possible: pick the height range that shows the star
  // and the thin disc, and let the width follow from the strip's shape.
  let V: number;
  let H: number;
  if (zoom) {
    V = Math.max(z !== null ? Math.abs(z) * 1.4 : 0, 0.45);
    H = Math.min(17, V * aspect);
  } else {
    H = 17;
    V = Math.max((H / aspect), z !== null ? Math.abs(z) * 1.4 : 0);
  }
  const midX = zoom && p ? (p.y - SUN_GALACTOCENTRIC_KPC) / 2 : 0;
  const sxPer = box.w / 2 / H;
  const szPer = box.h / 2 / V;
  const exaggeration = szPer / sxPer; // 1 = true scale
  const toPx = (X: number, Z: number): [number, number] => [box.x + box.w / 2 + (X - midX) * sxPer, box.y + box.h / 2 - Z * szPer];
  const rand = rng(2024);

  ctx.save();
  const rr = Math.min(12, box.h / 6);
  ctx.beginPath();
  ctx.roundRect(box.x, box.y, box.w, box.h, rr);
  ctx.fillStyle = 'rgba(8,11,24,0.9)';
  ctx.fill();
  ctx.clip();

  // Thin disc (scale height 0.3 kpc) and thick disc (0.9 kpc), radially
  // exponential; a bulge round the centre.
  const nearestX = Math.max(0, Math.abs(midX) - H);
  const wMax = Math.exp(-nearestX / DISC_SCALE_KPC);
  const dot = Math.max(1, box.h / 90);
  ctx.globalCompositeOperation = 'lighter';
  const n = Math.round(Math.min(15000, Math.max(3000, (box.w * box.h) / 10)));
  let placed = 0;
  for (let tries = 0; placed < n && tries < n * 40; tries++) {
    const X = midX + (rand() * 2 - 1) * H;
    if (Math.abs(X) > 17) continue;
    if (rand() * wMax > Math.exp(-Math.abs(X) / DISC_SCALE_KPC)) continue;
    const thick = rand() < 0.15;
    const hz = thick ? 0.9 : 0.3;
    const Z = (rand() < 0.5 ? -1 : 1) * -Math.log(1 - rand()) * hz;
    placed++;
    const [px, py] = toPx(X, Z);
    if (py < box.y || py > box.y + box.h) continue;
    ctx.fillStyle = `rgba(170,190,255,${thick ? 0.16 : 0.3})`;
    ctx.fillRect(px, py, dot, dot);
  }
  if (Math.abs(midX) < H + 3) {
    for (let i = 0; i < 2500; i++) {
      const [px, py] = toPx(gauss(rand) * 1.1, gauss(rand) * 0.7);
      ctx.fillStyle = 'rgba(255,225,170,0.16)';
      ctx.fillRect(px, py, dot, dot);
    }
    const [gx, gy] = toPx(0, 0);
    const g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 2 * sxPer);
    g.addColorStop(0, 'rgba(255,236,200,0.7)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(box.x, box.y, box.w, box.h);
  }
  ctx.globalCompositeOperation = 'source-over';

  // Mid-plane.
  const [, planeY] = toPx(0, 0);
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = 'rgba(143,151,173,0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(box.x, planeY);
  ctx.lineTo(box.x + box.w, planeY);
  ctx.stroke();
  ctx.setLineDash([]);

  const [sx, sy] = toPx(-SUN_GALACTOCENTRIC_KPC, SUN_HEIGHT_KPC);
  if (!p) {
    // Unknown distance: the sight-line, in this plane, from the Sun.
    const { l, b } = toGalactic(star.ra, star.dec);
    const dx = Math.cos(b * DEG) * Math.cos(l * DEG) * sxPer;
    const dz = Math.sin(b * DEG) * szPer;
    const n2 = Math.hypot(dx, dz) || 1;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.5, box.h / 60);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + (dx / n2) * box.w * 2, sy - (dz / n2) * box.w * 2);
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // Labels, outside the clip so they are never cut.
  ctx.save();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(1.5, box.h / 80);
  ctx.beginPath();
  ctx.arc(sx, sy, Math.max(3.5, box.h / 22), 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = `500 ${fontPx}px ${SANS}`;
  const starPx = p && z !== null ? toPx(p.y, z) : null;
  const sunLabelBelow = !starPx || starPx[1] < sy;
  ctx.textAlign = 'center';
  ctx.textBaseline = sunLabelBelow ? 'top' : 'bottom';
  haloText(ctx, labels.sun, sx, sy + (sunLabelBelow ? 1 : -1) * box.h * 0.1, CREAM);
  ctx.font = `500 ${Math.round(fontPx * 0.9)}px ${SANS}`;
  // Bottom corner: the star's label goes up and away from the plane.
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  if (Math.abs(midX) > H) haloText(ctx, `${labels.centre} →`, box.x + box.w - 8, box.y + box.h - 4, MUTED);
  if (exaggeration > 1.25 || exaggeration < 0.8) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    haloText(ctx, labels.stretched(Math.round(exaggeration * 10) / 10), box.x + 8, box.y + box.h - 4, MUTED);
  }
  ctx.restore();
  if (starPx) markWithLabel(ctx, starPx[0], starPx[1], Math.max(6, box.h / 9), labels.yourStar, fontPx, box);
}
