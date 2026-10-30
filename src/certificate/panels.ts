/** The pictures on the certificate (and in the star card), each drawn into a box. */
import type { Classification } from '../sky/classify';
import { drawTargetMarker } from '../sky/constellation';
import type { Star } from '../sky/gaia';
import { absoluteMag, starColor, temperatureToRgb } from '../sky/physics';
import { once } from '../lib/cache';
import { GOLD, MUTED, SANS } from './theme';

type Ctx = CanvasRenderingContext2D;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Deterministic pseudo-random numbers, so a certificate redraws identically. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

/** Text with a dark outline so it reads over busy backgrounds. */
export function haloText(ctx: Ctx, text: string, x: number, y: number, fill: string) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(4,6,14,0.9)';
  ctx.lineWidth = Math.max(3, parseFloat(ctx.font.match(/(\d+)px/)?.[1] ?? '16') / 4);
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
  ctx.restore();
}

/** Marker plus a "Your star" label on a short leader line, pointing up-left or up-right. */
export function markWithLabel(ctx: Ctx, x: number, y: number, size: number, label: string, fontPx: number, box: Box) {
  drawTargetMarker(ctx, x, y, size, GOLD);
  const right = x < box.x + box.w * 0.62;
  const lx = x + (right ? 1 : -1) * size * 3.2;
  const ly = Math.max(box.y + fontPx, y - size * 3.2);
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1.5, size * 0.12);
  ctx.beginPath();
  ctx.moveTo(x + (right ? 1 : -1) * size * 1.7, y - size * 1.7);
  ctx.lineTo(lx, ly);
  ctx.stroke();
  ctx.font = `600 ${fontPx}px ${SANS}`;
  ctx.textAlign = right ? 'left' : 'right';
  ctx.textBaseline = 'bottom';
  haloText(ctx, label, lx + (right ? 4 : -4), ly + fontPx * 0.35, GOLD);
  ctx.restore();
}

// ---- HR diagram -----------------------------------------------------------

// Must match scripts/hr_density.py.
export const HR_AXES = { xMin: -0.6, xMax: 4.6, yMin: -4, yMax: 17 };

/** The density map, coloured night-blue to starlight (done once). */
const loadHrDensity = once(() =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `${import.meta.env.BASE_URL}hr-density.png`;
  }).then(img => {
    const off = document.createElement('canvas');
    off.width = img.width;
    off.height = img.height;
    const o = off.getContext('2d')!;
    o.drawImage(img, 0, 0);
    const px = o.getImageData(0, 0, off.width, off.height);
    const stops: [number, [number, number, number]][] = [
      [0.12, [20, 30, 70]],
      [0.45, [70, 105, 190]],
      [0.75, [170, 190, 235]],
      [1, [250, 238, 210]],
    ];
    for (let i = 0; i < px.data.length; i += 4) {
      const v = px.data[i] / 255;
      if (v < 0.12) {
        px.data[i + 3] = 0;
        continue;
      }
      let k = 0;
      while (k < stops.length - 1 && v > stops[k + 1][0]) k++;
      const [v0, c0] = stops[k];
      const [v1, c1] = stops[Math.min(k + 1, stops.length - 1)];
      const f = v1 === v0 ? 0 : (v - v0) / (v1 - v0);
      for (let c = 0; c < 3; c++) px.data[i + c] = c0[c] + (c1[c] - c0[c]) * f;
      px.data[i + 3] = Math.min(255, 80 + 400 * (v - 0.12));
    }
    o.putImageData(px, 0, 0);
    return off;
  }),
);

export interface HrLabels {
  hotter: string;
  cooler: string;
  brighter: string;
  yourStar: string;
}

/** Gaia's colour–magnitude diagram with the star marked (or its colour band, if its distance is unknown). */
export async function drawHr(ctx: Ctx, box: Box, star: Star, labels: HrLabels) {
  const density = await loadHrDensity();
  const fontPx = Math.max(13, Math.round(box.w / 18));
  const pad = fontPx * 1.9;
  const plot = { x: box.x + pad, y: box.y, w: box.w - pad, h: box.h - pad };
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(density, plot.x, plot.y, plot.w, plot.h);

  ctx.strokeStyle = 'rgba(143,151,173,0.5)';
  ctx.fillStyle = MUTED;
  ctx.lineWidth = Math.max(1, fontPx / 14);
  ctx.font = `500 ${fontPx}px ${SANS}`;
  const ay = plot.y + plot.h + pad * 0.3;
  ctx.beginPath();
  ctx.moveTo(plot.x, ay);
  ctx.lineTo(plot.x + plot.w, ay);
  ctx.stroke();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`← ${labels.hotter}`, plot.x, ay + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${labels.cooler} →`, plot.x + plot.w, ay + 4);
  const ax = box.x + pad * 0.7;
  ctx.beginPath();
  ctx.moveTo(ax, plot.y);
  ctx.lineTo(ax, plot.y + plot.h);
  ctx.stroke();
  ctx.translate(ax - 4, plot.y);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${labels.brighter} →`, 0, 0);
  ctx.restore();

  if (star.bpRp === null) return;
  const x = plot.x + ((star.bpRp - HR_AXES.xMin) / (HR_AXES.xMax - HR_AXES.xMin)) * plot.w;
  if (x < plot.x || x > plot.x + plot.w) return;
  const M = absoluteMag(star);
  if (M !== null) {
    const y =
      plot.y + ((Math.min(Math.max(M, HR_AXES.yMin), HR_AXES.yMax) - HR_AXES.yMin) / (HR_AXES.yMax - HR_AXES.yMin)) * plot.h;
    markWithLabel(ctx, x, y, box.w / 22, labels.yourStar, Math.round(fontPx * 1.05), box);
  } else {
    // Colour known, brightness not: it lies somewhere in this column.
    ctx.save();
    ctx.fillStyle = 'rgba(232,201,143,0.16)';
    ctx.fillRect(x - box.w / 60, plot.y, box.w / 30, plot.h);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = Math.max(1.5, box.w / 200);
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.h);
    ctx.stroke();
    ctx.restore();
    ctx.font = `600 ${fontPx}px ${SANS}`;
    ctx.textAlign = x < box.x + box.w * 0.6 ? 'left' : 'right';
    ctx.textBaseline = 'top';
    haloText(ctx, labels.yourStar, x + (ctx.textAlign === 'left' ? 8 : -8), plot.y + 6, GOLD);
  }
}

// ---- Star portrait --------------------------------------------------------

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
