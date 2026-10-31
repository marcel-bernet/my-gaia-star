/** Fig. "What kind of star": the star drawn to scale next to the Sun. */
import type { Classification } from '../sky/classify';
import type { Star } from '../sky/gaia';
import { starColor, temperatureToRgb } from '../sky/physics';
import { rng, type Box } from './canvas';
import { GOLD, MUTED, SANS } from './theme';

type Ctx = CanvasRenderingContext2D;

export interface PortraitLabels {
  sun: string;
  /** Under the star; e.g. "Your star". */
  star: string;
}

function sphere(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  rgb: [number, number, number],
  kind: Classification['kind'] | null,
  seed: number,
) {
  const [cr, cg, cb] = rgb;
  // Corona glow.
  const glow = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 2.1 + 4);
  glow.addColorStop(0, `rgba(${cr},${cg},${cb},0.35)`);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(x, y, r * 2.1 + 4, 0, Math.PI * 2);
  ctx.fill();
  if (r < 2.5) {
    ctx.fillStyle = `rgb(${Math.min(255, cr + 40)},${Math.min(255, cg + 40)},${Math.min(255, cb + 40)})`;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1.2, r), 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  // Limb-darkened disc, lit slightly from the upper left.
  const g = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.05, x, y, r);
  const lift = (v: number, k: number) => Math.round(Math.min(255, v + (255 - v) * k));
  g.addColorStop(0, `rgb(${lift(cr, 0.75)},${lift(cg, 0.75)},${lift(cb, 0.75)})`);
  g.addColorStop(0.55, `rgb(${cr},${cg},${cb})`);
  g.addColorStop(1, `rgb(${Math.round(cr * 0.55)},${Math.round(cg * 0.45)},${Math.round(cb * 0.45)})`);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Giants have a few huge convection cells; dwarfs a fine granulation.
  const big = kind === 'red-giant' || kind === 'giant' || kind === 'supergiant';
  const rand = rng(seed);
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  const n = big ? 14 : 60;
  for (let i = 0; i < n; i++) {
    const a = rand() * Math.PI * 2;
    const d = Math.sqrt(rand()) * r;
    const cellR = (big ? 0.28 : 0.07) * r * (0.6 + rand() * 0.8);
    const cg2 = ctx.createRadialGradient(
      x + Math.cos(a) * d,
      y + Math.sin(a) * d,
      0,
      x + Math.cos(a) * d,
      y + Math.sin(a) * d,
      cellR,
    );
    const dark = rand() < 0.5;
    cg2.addColorStop(0, dark ? 'rgba(0,0,0,0.16)' : 'rgba(255,255,255,0.12)');
    cg2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cg2;
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  }
  ctx.restore();
}

/**
 * The star next to the Sun, to scale when the ratio allows (otherwise the
 * smaller one is drawn at a minimum size and the ratio is in the caption).
 */
export function drawStarPortrait(ctx: Ctx, box: Box, star: Star, c: Classification | null, labels: PortraitLabels) {
  const fontPx = Math.max(12, Math.round(box.w / 18));
  const rgb = ((): [number, number, number] => {
    const m = starColor(star).match(/\d+/g)!.map(Number);
    return [m[0], m[1], m[2]];
  })();
  const sunRgb = temperatureToRgb(5772);
  const seed = Number(BigInt(star.id) % 2147483647n);
  const ratio = c?.radiusSun ?? null;
  const cy = box.y + (box.h - fontPx * 1.8) / 2;
  const maxR = Math.min(box.h * 0.36, box.w * 0.24);

  if (ratio === null) {
    // Size unknown: just the star.
    sphere(ctx, box.x + box.w / 2, cy, maxR * 0.7, rgb, c?.kind ?? null, seed);
    ctx.font = `600 ${fontPx}px ${SANS}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = GOLD;
    ctx.fillText(labels.star, box.x + box.w / 2, box.y + box.h - fontPx * 1.4);
    return;
  }

  const minR = Math.max(2, maxR * 0.03);
  const starR = ratio >= 1 ? maxR : Math.max(minR, maxR * ratio);
  const sunR = ratio >= 1 ? Math.max(minR, maxR / ratio) : maxR;
  const gap = box.w * 0.08;
  const total = 2 * starR + 2 * sunR + gap;
  const sunX = box.x + (box.w - total) / 2 + sunR;
  const starX = sunX + sunR + gap + starR;
  sphere(ctx, sunX, cy, sunR, sunRgb, 'yellow-dwarf', 7);
  sphere(ctx, starX, cy, starR, rgb, c?.kind ?? null, seed);

  ctx.font = `500 ${fontPx}px ${SANS}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  const ly = box.y + box.h - fontPx * 1.4;
  ctx.fillStyle = MUTED;
  ctx.fillText(labels.sun, sunX, ly);
  ctx.font = `600 ${fontPx}px ${SANS}`;
  ctx.fillStyle = GOLD;
  ctx.fillText(labels.star, starX, ly);
}
