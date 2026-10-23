/** The three pictures on the certificate, each drawn into a box on a canvas. */
import type { Star } from '../sky/gaia';
import { absoluteMag, galacticPlanePosition, starColor, SUN_GALACTOCENTRIC_KPC } from '../sky/physics';
import type { SkyFrame } from '../sky/zenith';
import { INK, GOLD, CREAM, MUTED } from './theme';

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

function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}

/** A gold four-pointed marker with a ring, used for "your star" everywhere. */
export function drawMarker(ctx: Ctx, x: number, y: number, size: number) {
  ctx.save();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1.5, size * 0.09);
  ctx.beginPath();
  ctx.arc(x, y, size, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  for (const [dx, dy] of [
    [0, -1],
    [1, 0],
    [0, 1],
    [-1, 0],
  ]) {
    ctx.moveTo(x + dx * size * 1.35, y + dy * size * 1.35);
    ctx.lineTo(x + dx * size * 2.1, y + dy * size * 2.1);
  }
  ctx.stroke();
  ctx.restore();
}

function dot(ctx: Ctx, x: number, y: number, r: number, color: string, glow: number) {
  if (glow > 0) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r * glow);
    g.addColorStop(0, color.replace('rgb(', 'rgba(').replace(')', ',0.45)'));
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r * glow, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * The patch of sky around the zenith, as seen looking straight up:
 * north at the top and — because we look up, not down — east on the left.
 */
export function drawSkyChart(ctx: Ctx, box: Box, frame: SkyFrame, stars: Star[], chosen: Star, labels: { n: string; e: string }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const R = Math.min(box.w, box.h) / 2;
  const placed = stars.map(s => ({ s, o: frame.offset(s.ra, s.dec) }));
  const target = frame.offset(chosen.ra, chosen.dec);
  const maxSep = Math.max(...placed.map(p => p.o.sep), target.sep * 1.6, 1e-4);
  const scale = (R * 0.92) / maxSep;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  bg.addColorStop(0, '#0f1630');
  bg.addColorStop(1, INK);
  ctx.fillStyle = bg;
  ctx.fill();
  ctx.clip();

  // Faint graticule rings.
  ctx.strokeStyle = 'rgba(232,201,143,0.12)';
  ctx.lineWidth = 1.5;
  for (const f of [1 / 3, 2 / 3]) {
    ctx.beginPath();
    ctx.arc(cx, cy, R * f, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(cx - R, cy);
  ctx.lineTo(cx + R, cy);
  ctx.moveTo(cx, cy - R);
  ctx.lineTo(cx, cy + R);
  ctx.stroke();

  const gs = placed.map(p => p.s.g);
  const gMin = Math.min(...gs);
  const gMax = Math.max(...gs);
  const span = Math.max(gMax - gMin, 1);
  for (const { s, o } of [...placed].sort((a, b) => b.s.g - a.s.g)) {
    const x = cx - o.east * scale;
    const y = cy - o.north * scale;
    const bright = 1 - (s.g - gMin) / span;
    const r = (R / 160) * (0.8 + 4.2 * bright * bright);
    dot(ctx, x, y, r, starColor(s), 3.5);
  }
  ctx.restore();

  drawMarker(ctx, cx - target.east * scale, cy - target.north * scale, R / 26);

  ctx.save();
  ctx.strokeStyle = 'rgba(232,201,143,0.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.round(R / 18)}px "Inter Variable", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(labels.n, cx, cy - R - R * 0.03);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  ctx.fillText(labels.e, cx - R - R * 0.04, cy);
  ctx.restore();
}

// Must match scripts/hr_density.py.
export const HR_AXES = { xMin: -0.6, xMax: 4.6, yMin: -4, yMax: 17 };

let hrImage: Promise<HTMLImageElement> | null = null;
function loadHrDensity(): Promise<HTMLImageElement> {
  hrImage ??= new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `${import.meta.env.BASE_URL}hr-density.png`;
  });
  return hrImage;
}

/** Gaia's colour–magnitude diagram, coloured night-blue to starlight. */
export async function drawHr(ctx: Ctx, box: Box, star: Star, labels: { hotter: string; cooler: string; brighter: string }) {
  const img = await loadHrDensity();
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

  // Leave a margin on the left and bottom for the axis hints.
  const pad = box.w * 0.1;
  const plot = { x: box.x + pad, y: box.y, w: box.w - pad, h: box.h - pad };
  ctx.save();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, plot.x, plot.y, plot.w, plot.h);

  ctx.strokeStyle = 'rgba(143,151,173,0.5)';
  ctx.fillStyle = MUTED;
  ctx.lineWidth = 1.5;
  ctx.font = `500 ${Math.max(20, Math.round(box.w / 20))}px "Inter Variable", sans-serif`;
  const ay = plot.y + plot.h + pad * 0.45;
  ctx.beginPath();
  ctx.moveTo(plot.x, ay);
  ctx.lineTo(plot.x + plot.w, ay);
  ctx.stroke();
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(`← ${labels.hotter}`, plot.x, ay + 6);
  ctx.textAlign = 'right';
  ctx.fillText(`${labels.cooler} →`, plot.x + plot.w, ay + 6);
  const ax = box.x + pad * 0.45;
  ctx.beginPath();
  ctx.moveTo(ax, plot.y);
  ctx.lineTo(ax, plot.y + plot.h);
  ctx.stroke();
  ctx.translate(ax - 6, plot.y);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillText(`${labels.brighter} →`, 0, 0);
  ctx.restore();

  const M = absoluteMag(star);
  if (M !== null && star.bpRp !== null) {
    const x = plot.x + ((star.bpRp - HR_AXES.xMin) / (HR_AXES.xMax - HR_AXES.xMin)) * plot.w;
    const y = plot.y + ((M - HR_AXES.yMin) / (HR_AXES.yMax - HR_AXES.yMin)) * plot.h;
    if (x >= plot.x && x <= plot.x + plot.w && y >= plot.y && y <= plot.y + plot.h) {
      drawMarker(ctx, x, y, box.w / 24);
    }
  }
}

/**
 * The Milky Way seen face-on from the north Galactic pole — drawn, not
 * photographed: a bar and four logarithmic spiral arms at a 12° pitch.
 */
export function drawMilkyWay(ctx: Ctx, box: Box, star: Star, labels: { sun: string; centre: string }) {
  const cx = box.x + box.w / 2;
  const cy = box.y + box.h / 2;
  const R = Math.min(box.w, box.h) / 2;
  const kpc = R / 17; // ±17 kpc fills the box
  const rand = rng(1977);

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
  disc.addColorStop(0, 'rgba(120,130,190,0.25)');
  disc.addColorStop(0.6, 'rgba(60,70,130,0.08)');
  disc.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = disc;
  ctx.fillRect(box.x, box.y, box.w, box.h);

  ctx.globalCompositeOperation = 'lighter';
  const pitch = Math.tan((12 * Math.PI) / 180);
  const arms = 4;
  const px = R / 110;
  for (let i = 0; i < 30000; i++) {
    const arm = i % arms;
    const r = 3 + Math.pow(rand(), 0.8) * 13; // kpc
    const theta = Math.log(r / 3) / pitch + (arm * 2 * Math.PI) / arms + 0.4;
    const spread = 0.35 + r * 0.05;
    const x = r * Math.cos(theta) + gauss(rand) * spread;
    const y = r * Math.sin(theta) + gauss(rand) * spread;
    const fade = Math.max(0, 1 - r / 16);
    const pink = rand() < 0.04;
    ctx.fillStyle = pink ? `rgba(255,140,180,${0.6 * fade})` : `rgba(170,190,255,${0.16 * fade})`;
    const s = (pink ? 1.5 : 1) * px;
    ctx.fillRect(cx + x * kpc, cy - y * kpc, s, s);
  }
  // Bar, tilted ~27° to the Sun–centre line.
  ctx.translate(cx, cy);
  ctx.rotate((-27 * Math.PI) / 180);
  for (let i = 0; i < 5000; i++) {
    const x = gauss(rand) * 2.2;
    const y = gauss(rand) * 0.7;
    ctx.fillStyle = 'rgba(255,225,170,0.12)';
    ctx.fillRect(x * kpc, y * kpc, px, px);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, 3.5 * kpc);
  core.addColorStop(0, 'rgba(255,236,200,0.9)');
  core.addColorStop(0.3, 'rgba(255,210,150,0.35)');
  core.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(cx, cy, 3.5 * kpc, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Sun and labels.
  const sx = cx;
  const sy = cy + SUN_GALACTOCENTRIC_KPC * kpc;
  ctx.save();
  ctx.strokeStyle = CREAM;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sx, sy, R / 45, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = MUTED;
  ctx.font = `500 ${Math.max(20, Math.round(box.w / 20))}px "Inter Variable", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(labels.sun, sx + R / 22, sy + R / 14);
  ctx.restore();

  const p = galacticPlanePosition(star);
  if (p) {
    const x = cx + p.x * kpc;
    const y = cy - p.y * kpc;
    // Nearby stars sit right on top of the Sun; nudge the marker clear of it.
    const near = Math.hypot(x - sx, y - sy) < R / 12;
    if (near) {
      ctx.save();
      ctx.strokeStyle = 'rgba(232,201,143,0.6)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx - R / 6, sy - R / 6);
      ctx.stroke();
      ctx.restore();
      drawMarker(ctx, sx - R / 6, sy - R / 6, R / 18);
    } else {
      drawMarker(ctx, x, y, R / 18);
    }
  }
}
