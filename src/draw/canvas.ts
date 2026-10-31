/** Small drawing helpers shared by the figures. */
import { GOLD, SANS } from './theme';

type Ctx = CanvasRenderingContext2D;

/** Where a figure is drawn, in canvas pixels. */
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
