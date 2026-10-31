/** Fig. "Among its neighbours": the star on Gaia's colour–magnitude (HR) diagram. */
import { once } from '../lib/cache';
import type { Star } from '../sky/gaia';
import { absoluteMag } from '../sky/physics';
import { haloText, markWithLabel, type Box } from './canvas';
import { SIGNAL, MUTED, SANS } from './theme';

type Ctx = CanvasRenderingContext2D;

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
    ctx.strokeStyle = SIGNAL;
    ctx.lineWidth = Math.max(1.5, box.w / 200);
    ctx.beginPath();
    ctx.moveTo(x, plot.y);
    ctx.lineTo(x, plot.y + plot.h);
    ctx.stroke();
    ctx.restore();
    ctx.font = `600 ${fontPx}px ${SANS}`;
    ctx.textAlign = x < box.x + box.w * 0.6 ? 'left' : 'right';
    ctx.textBaseline = 'top';
    haloText(ctx, labels.yourStar, x + (ctx.textAlign === 'left' ? 8 : -8), plot.y + 6, SIGNAL);
  }
}
