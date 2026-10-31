/**
 * The Milky Way, drawn (not photographed) from a simple density model: an
 * exponential disc with four logarithmic spiral arms at a 12° pitch, the
 * short Local Arm, a bar and a bulge. Because the model is a density, it is
 * rendered pixel by pixel at any zoom: the whole Galaxy face-on, a close-up
 * of the Sun's neighbourhood, or the disc seen edge-on.
 *
 * Face-on coordinates (kpc): Galactic Centre at the origin, Sun at (0, −8.2),
 * seen from the north Galactic pole. Edge-on: horizontal is the face-on y axis
 * (towards the centre), vertical is height above the mid-plane.
 */
import type { T } from '../i18n';
import type { Star } from '../sky/gaia';
import {
  galacticHeightKpc,
  galacticPlanePosition,
  LY_PER_KPC,
  SUN_GALACTOCENTRIC_KPC,
  SUN_HEIGHT_KPC,
  toGalactic,
} from '../sky/physics';
import { haloText, markWithLabel, rng, type Box } from './canvas';
import { CREAM, GOLD, MONO, MUTED, SANS } from './theme';

type Ctx = CanvasRenderingContext2D;

const DEG = Math.PI / 180;
const PITCH = 12 * DEG;
const K = Math.tan(PITCH);
const ARMS = 4;
const DISC_SCALE_KPC = 3.5;
const DISC_EDGE_KPC = 16;
const THIN_KPC = 0.3;
const THICK_KPC = 0.9;
/** Closer than this, the views zoom in on the Sun and the star. */
const CLOSE_UP_KPC = 5;
const FULL_VIEW_KPC = 16.5;
const SUN = { x: 0, y: -SUN_GALACTOCENTRIC_KPC };

// Arms are placed to match the Milky Way along the Sun's line to the centre
// (cf. Reid et al. 2019): Sagittarius–Carina ~1.6 kpc inside the Sun,
// Perseus ~1 kpc outside, Scutum–Centaurus further in, Norma–Outer beyond.
const SUN_THETA = -Math.PI / 2;
const ARM_PHASE = SUN_THETA - Math.log(6.6 / 3) / K; // arm 0 crosses the Sun's line at 6.6 kpc
export type ArmName = 'sagittarius' | 'scutum' | 'norma' | 'perseus' | 'local';
const ARM_NAMES: ArmName[] = ['sagittarius', 'scutum', 'norma', 'perseus'];
// The Sun sits in the Local Arm (Orion Spur), a short, weaker arm segment.
const LOCAL = { r: 8.3, pitch: 11.4 * DEG, span: 0.42, strength: 0.75 };

export interface GalaxyLabels {
  sun: string;
  yourStar: string;
  centre: string;
  /** Formats a scale-bar length, e.g. 1000 → "1,000 light-years". */
  scale: (ly: number) => string;
  /** Short form for axis ticks, e.g. 1000 → "1,000 ly". */
  ly: (ly: number) => string;
  /** "Galactic plane". */
  plane: string;
  arm: (name: ArmName) => string;
}

/** The galaxy views' labels in the visitor's language. */
export function galaxyLabels(t: T, lang: string): GalaxyLabels {
  const ly = (n: number) => new Intl.NumberFormat(lang).format(n);
  return {
    sun: t('cert.mw.sun'),
    yourStar: t('chart.yourStar'),
    centre: t('galaxy.centre'),
    scale: n => t('fact.distance.value', { ly: ly(n) }),
    ly: n => t('galaxy.ly', { ly: ly(n) }),
    plane: t('galaxy.plane'),
    arm: name => t(`arm.${name}`),
  };
}

const armWidth = (r: number) => 0.3 + 0.04 * r;

function armTheta(a: number, r: number) {
  return Math.log(r / 3) / K + (a * 2 * Math.PI) / ARMS + ARM_PHASE;
}

function localArmRadius(theta: number) {
  return LOCAL.r * Math.exp(Math.tan(LOCAL.pitch) * (theta - SUN_THETA));
}

/** How strongly a point lies on a spiral arm (0…1). */
function armStrength(x: number, y: number): number {
  const r = Math.hypot(x, y);
  if (r < 3) return 0;
  const theta = Math.atan2(y, x);
  let best = Math.PI;
  for (let a = 0; a < ARMS; a++) {
    const d = Math.abs(((((theta - armTheta(a, r)) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
    best = Math.min(best, d);
  }
  const across = r * best * Math.sin(PITCH); // kpc, perpendicular to the arm
  let strength = Math.exp(-((across / armWidth(r)) ** 2));
  // Local Arm: radial distance to the segment, tapered at its ends.
  const dTheta = ((theta - SUN_THETA + 3 * Math.PI) % (2 * Math.PI)) - Math.PI;
  if (Math.abs(dTheta) < LOCAL.span * 1.6) {
    const acrossLocal = Math.abs(r - localArmRadius(dTheta + SUN_THETA)) * Math.cos(LOCAL.pitch);
    const taper = Math.exp(-((dTheta / LOCAL.span) ** 4));
    strength = Math.max(strength, LOCAL.strength * taper * Math.exp(-((acrossLocal / 0.3) ** 2)));
  }
  return strength;
}

/** Stellar density of the disc, the bar and the bulge, face-on (arbitrary units). */
function faceDensity(x: number, y: number): { d: number; arm: number; warm: number } {
  const r = Math.hypot(x, y);
  const arm = armStrength(x, y);
  const edge = r > DISC_EDGE_KPC ? Math.exp(-(r - DISC_EDGE_KPC) * 2) : 1;
  const disc = (0.06 + 1.2 * arm ** 1.5) * Math.exp(-r / DISC_SCALE_KPC) * edge;
  // Bar, tilted ~27° to the Sun–centre line, and the bulge.
  const c = Math.cos(27 * DEG);
  const s = Math.sin(27 * DEG);
  const bx = x * c + y * s;
  const by = -x * s + y * c;
  const bar = 1.1 * Math.exp(-((bx / 3.2) ** 2 + (by / 1.1) ** 2));
  const bulge = 2.2 * Math.exp(-((r / 1.1) ** 2));
  const d = disc + bar + bulge;
  return { d, arm, warm: (bar + bulge) / (d || 1) };
}

/** Points along each named arm, kpc. */
function armCurves(): { name: ArmName; pts: [number, number][] }[] {
  const curves: { name: ArmName; pts: [number, number][] }[] = ARM_NAMES.map((name, a) => {
    const pts: [number, number][] = [];
    for (let r = 3; r <= DISC_EDGE_KPC; r += 0.05) {
      const th = armTheta(a, r);
      pts.push([r * Math.cos(th), r * Math.sin(th)]);
    }
    return { name, pts };
  });
  const local: [number, number][] = [];
  for (let d = -LOCAL.span; d <= LOCAL.span; d += 0.01) {
    const r = localArmRadius(SUN_THETA + d);
    local.push([r * Math.cos(SUN_THETA + d), r * Math.sin(SUN_THETA + d)]);
  }
  curves.push({ name: 'local', pts: local });
  return curves;
}

interface View {
  x: number;
  y: number;
  /** Half the shorter side of the picture, kpc. */
  r: number;
}

/**
 * The view both pictures share. Close to the Sun it frames the Sun and the
 * star with room around them, and widens until at least two of the major
 * arms are in the picture, so the star is always shown among the arms.
 */
function viewFor(star: Star): { view: View; zoom: boolean } {
  const p = galacticPlanePosition(star);
  if (p) {
    const d = Math.hypot(p.x - SUN.x, p.y - SUN.y);
    if (d < CLOSE_UP_KPC) {
      const cx = (p.x + SUN.x) / 2;
      const cy = (p.y + SUN.y) / 2;
      const room = d / 2 / 0.6 + 0.25;
      const armDist = ARM_NAMES.map((_, a) => {
        let best = Infinity;
        for (const [x, y] of armCurves()[a].pts) best = Math.min(best, Math.hypot(x - cx, y - cy));
        return best;
      }).sort((a, b) => a - b);
      const arms = armDist[1] + 0.45;
      return { view: { x: cx, y: cy, r: Math.min(FULL_VIEW_KPC, Math.max(room, arms, 1.2)) }, zoom: true };
    }
  }
  return { view: { x: 0, y: 0, r: FULL_VIEW_KPC }, zoom: false };
}

export function isCloseUp(star: Star): boolean {
  return viewFor(star).zoom;
}

/** A canvas to paint pixels into, then draw scaled (so it honours the target's transform). */
function scratch(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Density → colour: night blue, through the arms' blue-white, to the bulge's warm white. */
function tone(v: number, warm: number, arm: number, grain: number): [number, number, number] {
  const i = (1 - Math.exp(-v * 1.25)) * grain;
  const cool: [number, number, number] = [120 + 90 * arm, 140 + 80 * arm, 215 + 30 * arm];
  const hot: [number, number, number] = [255, 226, 180];
  const c = cool.map((cv, k) => cv + (hot[k] - cv) * Math.min(1, warm * 1.4)) as [number, number, number];
  return [9 + c[0] * i, 11 + c[1] * i, 22 + c[2] * i];
}

function roundedClip(ctx: Ctx, b: Box, r: number) {
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, r);
  ctx.clip();
}

/** Paints the face-on Galaxy into a box as seen through `view`; returns kpc → px. */
function paintFaceOn(ctx: Ctx, b: Box, view: View, seed: number, resolution = 1) {
  const s = Math.min(b.w, b.h) / 2 / view.r; // px per kpc
  const toPx = (x: number, y: number): [number, number] => [b.x + b.w / 2 + (x - view.x) * s, b.y + b.h / 2 - (y - view.y) * s];
  const W = Math.round(b.w * resolution);
  const H = Math.round(b.h * resolution);
  const c = scratch(W, H);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, H);
  const rand = rng(seed);
  // Normalise to the densest disc point in view, so a close-up is as rich as the whole Galaxy.
  const nearest = Math.max(0, Math.hypot(view.x, view.y) - view.r * 1.5);
  const norm = 1 / Math.max(0.12, Math.exp(-nearest / DISC_SCALE_KPC) * 1.15);
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < W; i++) {
      const x = view.x + ((i + 0.5) / resolution - b.w / 2) / s;
      const y = view.y - ((j + 0.5) / resolution - b.h / 2) / s;
      const { d, arm, warm } = faceDensity(x, y);
      const grain = 0.82 + 0.36 * rand();
      const [r, gg, bb] = tone(Math.min(d * norm, 3), warm, arm, grain);
      const k = (j * W + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = gg;
      img.data[k + 2] = bb;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  roundedClip(ctx, b, Math.min(10, b.w / 30));
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(c, b.x, b.y, b.w, b.h);

  // Stars resolved on top, more of them along the arms; a few pink star-forming knots.
  ctx.globalCompositeOperation = 'lighter';
  const count = Math.round((b.w * b.h) / 90);
  const dot = Math.max(0.8, Math.min(b.w, b.h) / 320);
  for (let n = 0, tries = 0; n < count && tries < count * 30; tries++) {
    const x = view.x + (rand() * 2 - 1) * (b.w / 2 / s);
    const y = view.y + (rand() * 2 - 1) * (b.h / 2 / s);
    const { d, arm } = faceDensity(x, y);
    if (rand() > Math.min(1, d * norm * 0.9)) continue;
    n++;
    const [px, py] = toPx(x, y);
    const pink = arm > 0.5 && rand() < 0.04;
    ctx.fillStyle = pink ? 'rgba(255,150,190,0.55)' : `rgba(210,220,255,${(0.12 + 0.3 * rand()).toFixed(2)})`;
    const sz = pink ? dot * 2 : dot * (0.6 + rand() * 0.8);
    ctx.fillRect(px, py, sz, sz);
  }
  ctx.restore();
  return { toPx, s };
}

/** A round number of light-years about `target` long. */
function niceLy(target: number): number {
  const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
  return steps.reduce((best, s) => (Math.abs(Math.log(s / target)) < Math.abs(Math.log(best / target)) ? s : best));
}

function scaleBar(
  ctx: Ctx,
  x: number,
  y: number,
  kpcToPx: number,
  targetLy: number,
  label: (ly: number) => string,
  fontPx: number,
) {
  const ly = niceLy(targetLy);
  const w = (ly / LY_PER_KPC) * kpcToPx;
  ctx.save();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(1, fontPx / 12);
  ctx.beginPath();
  ctx.moveTo(x, y - fontPx * 0.3);
  ctx.lineTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y - fontPx * 0.3);
  ctx.stroke();
  ctx.font = `500 ${Math.round(fontPx * 0.82)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  haloText(ctx, label(ly), x + w / 2, y - fontPx * 0.4, CREAM);
  ctx.restore();
}

/** The Sun: ☉, a ring with a dot. */
function sunMark(ctx: Ctx, x: number, y: number, r: number) {
  ctx.save();
  ctx.strokeStyle = 'rgba(4,6,14,0.85)';
  ctx.lineWidth = r * 0.9;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = Math.max(1.2, r * 0.32);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = CREAM;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r * 0.28), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Names the arms crossing the picture, written along each arm, clear of what is marked. */
function labelArms(
  ctx: Ctx,
  b: Box,
  toPx: (x: number, y: number) => [number, number],
  labels: GalaxyLabels,
  fontPx: number,
  avoid: [number, number][],
  keepOut: Box[],
) {
  ctx.save();
  ctx.font = `italic 500 ${Math.round(fontPx * 0.78)}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  const placed: [number, number][] = [];
  for (const { name, pts } of armCurves()) {
    const tw = ctx.measureText(labels.arm(name)).width;
    let best: { i: number; score: number } | null = null;
    pts.forEach(([x, y], i) => {
      if (i === 0 || i === pts.length - 1) return;
      const [px, py] = toPx(x, y);
      // Keep the whole label inside, away from the edges, the marks and other labels.
      if (px < b.x + tw / 2 + 8 || px > b.x + b.w - tw / 2 - 8 || py < b.y + fontPx * 1.6 || py > b.y + b.h - fontPx * 2.2)
        return;
      const clear = [...avoid, ...placed].every(([ax, ay]) => Math.hypot(px - ax, py - ay) > Math.max(fontPx * 3, tw * 0.6));
      const outside = keepOut.every(
        k => px + tw / 2 < k.x || px - tw / 2 > k.x + k.w || py + fontPx < k.y || py - fontPx > k.y + k.h,
      );
      if (!clear || !outside) return;
      const f = Math.max(Math.abs(px - cx) / (b.w / 2), Math.abs(py - cy) / (b.h / 2));
      const score = Math.abs(f - 0.55);
      if (!best || score < best.score) best = { i, score };
    });
    if (!best) continue;
    const { i } = best;
    const [ax, ay] = toPx(...pts[i - 1]);
    const [bx, by] = toPx(...pts[i + 1]);
    const [px, py] = toPx(...pts[i]);
    let angle = Math.atan2(by - ay, bx - ax);
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle < -Math.PI / 2) angle += Math.PI;
    placed.push([px, py]);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    haloText(ctx, labels.arm(name), 0, 0, 'rgba(205,215,245,0.88)');
    ctx.restore();
  }
  ctx.restore();
}

/** Where on the picture's edge to point at the Galactic Centre; null when it is in view. */
function centreArrowAt(b: Box, toPx: (x: number, y: number) => [number, number], fontPx: number) {
  const [gx, gy] = toPx(0, 0);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  if (gx > b.x && gx < b.x + b.w && gy > b.y && gy < b.y + b.h) return null;
  const dx = gx - cx;
  const dy = gy - cy;
  const k = Math.min((b.w / 2 - fontPx * 1.2) / Math.abs(dx || 1e-9), (b.h / 2 - fontPx * 1.2) / Math.abs(dy || 1e-9));
  return { x: cx + dx * k, y: cy + dy * k, dx, dy };
}

/** An arrow at the picture's edge pointing at the Galactic Centre, when it is out of view. */
function centreArrow(ctx: Ctx, b: Box, toPx: (x: number, y: number) => [number, number], label: string, fontPx: number) {
  const at = centreArrowAt(b, toPx, fontPx);
  if (!at) return;
  const { x: ex, y: ey, dx, dy } = at;
  const a = Math.atan2(dy, dx);
  ctx.save();
  ctx.font = `500 ${Math.round(fontPx * 0.8)}px ${SANS}`;
  ctx.textBaseline = 'middle';
  const up = Math.abs(dy) > Math.abs(dx);
  ctx.textAlign = up ? 'center' : dx > 0 ? 'right' : 'left';
  const arrow = up ? (dy < 0 ? '↑' : '↓') : dx > 0 ? '→' : '←';
  const text = up || dx < 0 ? `${arrow} ${label}` : `${label} ${arrow}`;
  haloText(ctx, text, ex - Math.cos(a) * 2, ey - Math.sin(a) * 2, MUTED);
  ctx.restore();
}

/** The Galaxy seen from above, with the Sun and the star marked. */
export function drawGalaxyFaceOn(ctx: Ctx, box: Box, star: Star, labels: GalaxyLabels) {
  const fontPx = Math.max(11, Math.round(Math.min(box.w, box.h) / 22));
  const { view, zoom } = viewFor(star);
  const { toPx, s } = paintFaceOn(ctx, box, view, 1977, box.w > 600 ? 0.75 : 1);
  const p = galacticPlanePosition(star);
  const [sx, sy] = toPx(SUN.x, SUN.y);
  const starPx = p ? toPx(p.x, p.y) : null;

  ctx.save();
  roundedClip(ctx, box, Math.min(10, box.w / 30));
  const { l } = toGalactic(star.ra, star.dec);
  const dir = { x: -Math.sin(l * DEG), y: -Math.cos(l * DEG) }; // canvas coords
  if (!p) {
    // Distance unknown, direction known: a sight-line from the Sun to the edge.
    ctx.setLineDash([fontPx * 0.5, fontPx * 0.4]);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.5, fontPx / 7);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + dir.x * (box.w + box.h), sy + dir.y * (box.w + box.h));
    ctx.stroke();
    ctx.setLineDash([]);
  } else if (starPx && zoom) {
    // From the Sun to the star, with the distance.
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(232,201,143,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(starPx[0], starPx[1]);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();

  const avoid: [number, number][] = [[sx, sy]];
  if (starPx) avoid.push(starPx);
  const insetSide = Math.round(Math.min(box.w, box.h) * 0.3);
  const insetBox: Box = { x: box.x + box.w - insetSide - 6, y: box.y + 6, w: insetSide, h: insetSide };
  const arrowAt = zoom ? centreArrowAt(box, toPx, fontPx) : null;
  const keepOut: Box[] = [insetBox, { x: box.x, y: box.y + box.h - fontPx * 2.6, w: box.w * 0.45, h: fontPx * 2.6 }];
  if (arrowAt) keepOut.push({ x: arrowAt.x - box.w * 0.22, y: arrowAt.y - fontPx, w: box.w * 0.44, h: fontPx * 2 });
  // The star's label: to the left when, written to the right, it would run under the inset.
  let labelBox: Box | null = null;
  if (starPx) {
    const underInset = zoom && starPx[1] < insetBox.y + insetBox.h + fontPx * 2 && starPx[0] + fontPx * 9 > insetBox.x;
    labelBox = underInset ? { ...box, w: Math.max(1, (starPx[0] - box.x) / 0.62 - 1) } : box;
    const right = starPx[0] < labelBox.x + labelBox.w * 0.62;
    ctx.save();
    ctx.font = `600 ${Math.round(fontPx * 1.05)}px ${SANS}`;
    const tw = ctx.measureText(labels.yourStar).width;
    ctx.restore();
    const lx = starPx[0] + (right ? 1 : -1) * fontPx * 1.9;
    keepOut.push({ x: right ? lx : lx - tw, y: starPx[1] - fontPx * 3, w: tw, h: fontPx * 2.4 });
  }
  if (zoom) labelArms(ctx, box, toPx, labels, fontPx, avoid, keepOut);
  else {
    ctx.save();
    ctx.font = `500 ${Math.round(fontPx * 0.8)}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const [gx, gy] = toPx(0, 0);
    haloText(ctx, labels.centre, gx, gy + fontPx * 1.4, MUTED);
    ctx.restore();
  }

  // The Sun, labelled on the side away from the star.
  sunMark(ctx, sx, sy, Math.max(3.5, fontPx * 0.38));
  ctx.save();
  ctx.font = `500 ${fontPx}px ${SANS}`;
  const starBelow = starPx ? starPx[1] > sy : !p && dir.y > 0.3;
  ctx.textAlign = 'center';
  ctx.textBaseline = starBelow ? 'bottom' : 'top';
  haloText(ctx, labels.sun, sx, sy + (starBelow ? -1 : 1) * fontPx * 0.9, CREAM);
  ctx.restore();

  if (starPx && labelBox) {
    markWithLabel(ctx, starPx[0], starPx[1], Math.max(5, fontPx * 0.55), labels.yourStar, Math.round(fontPx * 1.05), labelBox);
  } else {
    const reach = Math.min(box.w, box.h) * 0.3;
    const side = dir.x <= 0 ? 1 : -1;
    ctx.save();
    ctx.font = `600 ${fontPx}px ${SANS}`;
    ctx.textAlign = side > 0 ? 'left' : 'right';
    ctx.textBaseline = 'middle';
    const tw = ctx.measureText(labels.yourStar).width;
    // Along the sight-line, but always inside the picture.
    let lx = sx + dir.x * reach - dir.y * side * fontPx;
    const ly = Math.min(box.y + box.h - fontPx, Math.max(box.y + fontPx, sy + dir.y * reach + dir.x * side * fontPx));
    lx = side > 0 ? Math.min(lx, box.x + box.w - tw - 6) : Math.max(lx, box.x + tw + 6);
    haloText(ctx, labels.yourStar, lx, ly, GOLD);
    ctx.restore();
  }

  if (zoom) {
    centreArrow(ctx, box, toPx, labels.centre, fontPx);
    scaleBar(ctx, box.x + fontPx, box.y + box.h - fontPx * 0.8, s, view.r * 0.45 * LY_PER_KPC, labels.scale, fontPx);

    // Where this patch sits in the whole Galaxy.
    const ib = insetBox;
    ctx.save();
    ctx.fillStyle = 'rgba(4,6,14,0.9)';
    ctx.beginPath();
    ctx.roundRect(ib.x - 2, ib.y - 2, ib.w + 4, ib.h + 4, 6);
    ctx.fill();
    ctx.restore();
    const inset = paintFaceOn(ctx, ib, { x: 0, y: 0, r: FULL_VIEW_KPC }, 7);
    ctx.save();
    ctx.strokeStyle = 'rgba(143,151,173,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ib.x + 0.5, ib.y + 0.5, ib.w - 1, ib.h - 1, Math.min(10, ib.w / 30));
    ctx.stroke();
    const [vx, vy] = inset.toPx(view.x, view.y);
    const hw = Math.max(3, (box.w / 2 / s) * inset.s);
    const hh = Math.max(3, (box.h / 2 / s) * inset.s);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(vx - hw, vy - hh, 2 * hw, 2 * hh);
    ctx.restore();
  }
}

/** Light-years with a sensible step for axis ticks. */
function tickStep(maxLy: number) {
  const steps = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
  return steps.find(s => maxLy / s <= 2.2) ?? 50000;
}

/**
 * The Galaxy seen edge-on: how far above or below the mid-plane the star is.
 * Heights are stretched to fit the star with room to spare, and labelled on
 * an axis in light-years, so the stretch is never hidden.
 */
export function drawGalaxyEdgeOn(ctx: Ctx, box: Box, star: Star, labels: GalaxyLabels) {
  const fontPx = Math.max(10, Math.round(Math.min(box.w / 32, box.h / 9)));
  const { view, zoom } = viewFor(star);
  const p = galacticPlanePosition(star);
  const z = galacticHeightKpc(star);
  const axisW = fontPx * 6.2;
  const plot: Box = { x: box.x + axisW, y: box.y, w: box.w - axisW, h: box.h };
  // Same stretch of the Sun–centre line as the face-on view's height.
  const H = zoom ? view.r * Math.max(1, plot.w / plot.h / 2.2) : FULL_VIEW_KPC;
  const midX = zoom ? view.y : 0;
  // Height range: the star with room above it, and never less than the thick disc.
  const V = Math.max(z !== null ? Math.abs(z) * 1.45 : 0, zoom ? 0.55 : 2.4);
  const sx = plot.w / 2 / H;
  const sz = plot.h / 2 / V;
  const toPx = (X: number, Z: number): [number, number] => [plot.x + plot.w / 2 + (X - midX) * sx, plot.y + plot.h / 2 - Z * sz];

  // Disc: thin + thick, exponential along the plane; the bulge round the centre.
  const W = Math.round(plot.w);
  const Hh = Math.round(plot.h);
  const c = scratch(W, Hh);
  const g = c.getContext('2d')!;
  const img = g.createImageData(W, Hh);
  const rand = rng(2024);
  const nearestX = Math.max(0, Math.abs(midX) - H);
  const norm = 1 / Math.max(0.08, Math.exp(-nearestX / DISC_SCALE_KPC));
  for (let j = 0; j < Hh; j++) {
    const Z = (plot.h / 2 - (j + 0.5)) / sz;
    const sech = 1 / Math.cosh(Z / THIN_KPC);
    const vert = 0.88 * sech * sech + 0.12 * Math.exp(-Math.abs(Z) / THICK_KPC);
    for (let i = 0; i < W; i++) {
      const X = midX + (i + 0.5 - plot.w / 2) / sx;
      const R = Math.abs(X);
      const edge = R > DISC_EDGE_KPC ? Math.exp(-(R - DISC_EDGE_KPC) * 2) : 1;
      const disc = 1.2 * Math.exp(-R / DISC_SCALE_KPC) * vert * edge;
      const bulge = 1.4 * Math.exp(-((R / 1.3) ** 2 + (Z / 0.6) ** 2));
      const d = disc + bulge;
      const [r, gg, bb] = tone(Math.min(d * norm, 3), bulge / (d || 1), 0.4, 0.85 + 0.3 * rand());
      const k = (j * W + i) * 4;
      img.data[k] = r;
      img.data[k + 1] = gg;
      img.data[k + 2] = bb;
      img.data[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  roundedClip(ctx, plot, Math.min(8, plot.h / 10));
  ctx.drawImage(c, plot.x, plot.y, plot.w, plot.h);

  // Mid-plane.
  const [, planeY] = toPx(0, 0);
  ctx.setLineDash([3, 5]);
  ctx.strokeStyle = 'rgba(180,188,210,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(plot.x, Math.round(planeY) + 0.5);
  ctx.lineTo(plot.x + plot.w, Math.round(planeY) + 0.5);
  ctx.stroke();
  ctx.setLineDash([]);

  const [sunX, sunY] = toPx(SUN.y, SUN_HEIGHT_KPC);
  const starPx = p && z !== null ? toPx(p.y, z) : null;
  if (starPx) {
    // Drop line from the star to the plane.
    ctx.setLineDash([2, 3]);
    ctx.strokeStyle = 'rgba(232,201,143,0.75)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(starPx[0], starPx[1]);
    ctx.lineTo(starPx[0], planeY);
    ctx.stroke();
    ctx.setLineDash([]);
  } else {
    // Unknown distance: the sight-line, in this plane, from the Sun.
    const { l, b } = toGalactic(star.ra, star.dec);
    const dx = Math.cos(b * DEG) * Math.cos(l * DEG) * sx;
    const dz = Math.sin(b * DEG) * sz;
    const n = Math.hypot(dx, dz) || 1;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sunX, sunY);
    ctx.lineTo(sunX + (dx / n) * box.w * 2, sunY - (dz / n) * box.w * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.font = `500 ${Math.round(fontPx * 0.85)}px ${SANS}`;
  ctx.textBaseline = 'bottom';
  ctx.textAlign = 'right';
  haloText(ctx, labels.plane, plot.x + plot.w - 6, planeY - 3, 'rgba(180,188,210,0.8)');
  if (zoom && Math.abs(midX) + 0.2 >= H) {
    // Point at the centre from the corner the star leaves free.
    const starLow = z !== null && z < 0;
    ctx.textBaseline = starLow ? 'top' : 'bottom';
    haloText(ctx, `${labels.centre} →`, plot.x + plot.w - 6, starLow ? plot.y + 5 : plot.y + plot.h - 4, MUTED);
  }
  ctx.restore();

  // Height axis, in light-years.
  ctx.save();
  const maxLy = V * LY_PER_KPC;
  const step = tickStep(maxLy);
  ctx.font = `${Math.round(fontPx * 0.85)}px ${MONO}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(233,231,226,0.25)';
  ctx.lineWidth = 1;
  for (let v = -Math.floor(maxLy / step) * step; v <= maxLy; v += step) {
    const y = Math.round(toPx(0, v / LY_PER_KPC)[1]) + 0.5;
    if (y < box.y + fontPx * 0.6 || y > box.y + box.h - fontPx * 0.6) continue;
    ctx.beginPath();
    ctx.moveTo(plot.x - 5, y);
    ctx.lineTo(plot.x - 1, y);
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.fillText(v === 0 ? '0' : `${v > 0 ? '+' : '−'}${labels.ly(Math.abs(v))}`, plot.x - 8, y);
  }
  ctx.restore();

  sunMark(ctx, sunX, sunY, Math.max(3.5, fontPx * 0.4));
  ctx.save();
  ctx.font = `500 ${fontPx}px ${SANS}`;
  const sunLabelBelow = !starPx || starPx[1] < sunY;
  ctx.textAlign = 'center';
  ctx.textBaseline = sunLabelBelow ? 'top' : 'bottom';
  haloText(ctx, labels.sun, sunX, sunY + (sunLabelBelow ? 1 : -1) * fontPx * 0.8, CREAM);
  ctx.restore();
  if (starPx) markWithLabel(ctx, starPx[0], starPx[1], Math.max(5, fontPx * 0.5), labels.yourStar, fontPx, plot);
}
