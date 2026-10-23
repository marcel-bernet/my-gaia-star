/** Canvas figures for a star's DR4 epoch astrometry. */
import { GOLD } from '../certificate/theme';
import { parallaxDisplacement, predictAl, type EpochAstrometry, type Fit, type TransitPoint } from './epoch';

type Ctx = CanvasRenderingContext2D;

export const INK = '#e9e7e2';
export const INK_2 = '#a4a39e';
export const INK_3 = '#6f6f6b';
export const RULE = 'rgba(233, 231, 226, 0.12)';
export const MONO = '"IBM Plex Mono", ui-monospace, monospace';

export const YEAR_MIN = 2014.5;
export const YEAR_MAX = 2020.2;

const rad = (d: number) => (d * Math.PI) / 180;

function axisText(ctx: Ctx, text: string, x: number, y: number, align: CanvasTextAlign = 'center', color = INK_3) {
  ctx.font = `10.5px ${MONO}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function niceStep(range: number, target: number) {
  const raw = range / target;
  const p = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map(m => m * p).find(s => s >= raw) ?? 10 * p;
}

function fmtMas(v: number) {
  return Math.abs(v) >= 10 || Number.isInteger(v) ? String(Math.round(v)) : v.toFixed(Math.abs(v) < 1 ? 1 : 0);
}

/** The calendar year under x on the timeline (same layout as drawTimeline). */
export function timelineYearAt(px: number, w: number) {
  return YEAR_MIN + ((px - 8) / (w - 16)) * (YEAR_MAX - YEAR_MIN);
}

/** Timeline: one tick per passage, taller for more CCDs used. */
export function drawTimeline(ctx: Ctx, w: number, h: number, pts: TransitPoint[], selected: number | null) {
  const left = 8;
  const right = w - 8;
  const base = h - 22;
  const top = 10;
  const x = (y: number) => left + ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * (right - left);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(left, base + 0.5);
  ctx.lineTo(right, base + 0.5);
  ctx.stroke();
  for (let y = 2015; y <= 2020; y++) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x(y)) + 0.5, base);
    ctx.lineTo(Math.round(x(y)) + 0.5, base + 4);
    ctx.stroke();
    axisText(ctx, String(y), x(y), base + 13);
  }
  const maxUsed = Math.max(...pts.map(p => p.nCcd), 1);
  pts.forEach((p, i) => {
    const hh = 6 + ((base - top - 6) * p.nUsed) / maxUsed;
    ctx.fillStyle = i === selected ? GOLD : 'rgba(233, 231, 226, 0.55)';
    ctx.fillRect(Math.round(x(p.year)) - (i === selected ? 1 : 0.5), base - hh, i === selected ? 2.5 : 1.5, hh);
  });
}

/**
 * The parallax loop on the sky. Proper motion is taken out, so what is left
 * is the yearly loop that Earth's orbit imprints on the star. Each passage
 * pins the star down along the scan direction only, so it is drawn as a
 * short line across the scan: the star lies somewhere on that line.
 */
export function drawWobble(ctx: Ctx, w: number, h: number, ea: EpochAstrometry, fit: Fit, pts: TransitPoint[], selected: number | null) {
  const cx = w / 2;
  const cy = h / 2;
  const plx = Math.max(fit.parallax, 0);
  const meas = pts.map(p => {
    const u = { e: Math.sin(rad(p.psi)), n: Math.cos(rad(p.psi)) };
    const noPlx = { ...fit, parallax: 0 };
    const r = p.w - predictAl(noPlx, p.year - 2010, p.psi, p.pf); // AL parallax displacement, measured
    const m = parallaxDisplacement(ea.ra0, ea.dec0, p.year);
    const model = { e: plx * m.e, n: plx * m.n };
    const off = r - plx * p.pf;
    return { c: { e: model.e + off * u.e, n: model.n + off * u.n }, u, e: p.e };
  });
  const spread = meas.map(m => Math.hypot(m.c.e, m.c.n)).sort((a, b) => a - b);
  const robust = spread[Math.floor(spread.length * 0.9)] ?? 1;
  const R = Math.max(plx * 1.35, robust * 1.15, 0.5);
  const scale = (Math.min(w, h) / 2 - 18) / R;
  const X = (e: number) => cx - e * scale; // east to the left, as on the sky
  const Y = (n: number) => cy - n * scale;

  // Frame: crosshair and a scale bar.
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cx + 0.5, 12);
  ctx.lineTo(cx + 0.5, h - 12);
  ctx.moveTo(12, cy + 0.5);
  ctx.lineTo(w - 12, cy + 0.5);
  ctx.stroke();
  axisText(ctx, 'N', cx, 6);
  axisText(ctx, 'E', 6, cy);
  const bar = niceStep(R, 2);
  ctx.strokeStyle = INK_3;
  ctx.beginPath();
  ctx.moveTo(w - 14 - bar * scale, h - 10.5);
  ctx.lineTo(w - 14, h - 10.5);
  ctx.stroke();
  axisText(ctx, `${fmtMas(bar)} mas`, w - 14 - (bar * scale) / 2, h - 20);

  // Measurements.
  const half = Math.max(R * 0.14, 0.05) * scale;
  ctx.lineCap = 'round';
  meas.forEach((m, i) => {
    if (i === selected) return;
    const x = X(m.c.e);
    const y = Y(m.c.n);
    // Across-scan direction on screen: (-cos ψ, sin ψ) in (east, north), east flipped.
    const dx = m.u.n * half;
    const dy = -m.u.e * half;
    ctx.strokeStyle = 'rgba(233, 231, 226, 0.42)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  });

  // Model: one year of the parallax loop.
  if (plx > 0) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const d = parallaxDisplacement(ea.ra0, ea.dec0, 2017 + k / 120);
      const x = X(plx * d.e);
      const y = Y(plx * d.n);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  if (selected !== null && meas[selected]) {
    const m = meas[selected];
    const x = X(m.c.e);
    const y = Y(m.c.n);
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - m.u.n * half * 1.4, y + m.u.e * half * 1.4);
    ctx.lineTo(x + m.u.n * half * 1.4, y - m.u.e * half * 1.4);
    ctx.stroke();
  }
}

/** What the five-parameter model leaves unexplained, passage by passage. */
export function drawResiduals(ctx: Ctx, w: number, h: number, fit: Fit, pts: TransitPoint[], selected: number | null) {
  const left = 40;
  const right = w - 8;
  const top = 8;
  const bottom = h - 22;
  const res = pts.map(p => p.w - predictAl(fit, p.year - 2010, p.psi, p.pf));
  const sorted = res.map(Math.abs).sort((a, b) => a - b);
  const R = Math.max(sorted[Math.floor(sorted.length * 0.95)] ?? 1, fit.rms * 2, 0.2) * 1.15;
  const x = (y: number) => left + ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * (right - left);
  const y = (v: number) => (top + bottom) / 2 - (v / R) * ((bottom - top) / 2);
  // Largest 1-2-5 step that still puts a gridline inside the range on each side.
  let step = niceStep(R, 2);
  while (step > R * 0.95) step /= step / niceStep(step / 2, 1) > 2.1 ? 2.5 : 2;

  ctx.lineWidth = 1;
  for (let v = -Math.floor(R / step) * step; v <= R + 1e-9; v += step) {
    ctx.strokeStyle = Math.abs(v) < 1e-9 ? 'rgba(233, 231, 226, 0.28)' : RULE;
    ctx.beginPath();
    ctx.moveTo(left, Math.round(y(v)) + 0.5);
    ctx.lineTo(right, Math.round(y(v)) + 0.5);
    ctx.stroke();
    axisText(ctx, fmtMas(v), left - 6, y(v), 'right');
  }
  for (let yr = 2015; yr <= 2020; yr++) axisText(ctx, String(yr), x(yr), bottom + 13);

  pts.forEach((p, i) => {
    const v = Math.max(-R, Math.min(R, res[i]));
    const px = x(p.year);
    const on = i === selected;
    ctx.strokeStyle = on ? GOLD : 'rgba(233, 231, 226, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, y(Math.max(-R, v - p.e)));
    ctx.lineTo(px, y(Math.min(R, v + p.e)));
    ctx.stroke();
    ctx.fillStyle = on ? GOLD : INK;
    ctx.beginPath();
    ctx.arc(px, y(v), on ? 3.5 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Window geometry for a transit's window class; the pixel values themselves are a schematic. */
export const WINDOWS: Record<number, { al: number; ac: number; label: string }> = {
  0: { al: 18, ac: 12, label: '18 × 12 px (2-D)' },
  1: { al: 18, ac: 12, label: '18 × 12 px (2-D)' },
  2: { al: 18, ac: 1, label: '18 × 1 (1-D)' },
  3: { al: 12, ac: 1, label: '12 × 1 (1-D)' },
};

export function drawWindow(ctx: Ctx, w: number, h: number, gClass: number) {
  const win = WINDOWS[gClass] ?? WINDOWS[3];
  const cell = Math.min((w - 16) / win.al, win.ac === 1 ? 26 : (h - 16) / win.ac);
  const gw = cell * win.al;
  const gh = cell * win.ac;
  const ox = (w - gw) / 2;
  const oy = (h - gh) / 2;
  // A smooth, made-up profile: where the light would fall. Not data.
  const sigmaAl = win.al / 9;
  const sigmaAc = Math.max(win.ac / 7, 0.5);
  for (let i = 0; i < win.al; i++) {
    for (let j = 0; j < win.ac; j++) {
      const a = Math.exp(-(((i + 0.5 - win.al / 2) / sigmaAl) ** 2) / 2);
      const b = win.ac === 1 ? 1 : Math.exp(-(((j + 0.5 - win.ac / 2) / sigmaAc) ** 2) / 2);
      ctx.fillStyle = `rgba(233, 231, 226, ${(0.04 + 0.5 * a * b).toFixed(3)})`;
      ctx.fillRect(ox + i * cell + 1, oy + j * cell + 1, cell - 2, cell - 2);
    }
  }
  ctx.strokeStyle = 'rgba(233, 231, 226, 0.22)';
  ctx.setLineDash([3, 3]);
  ctx.strokeRect(ox + 0.5, oy + 0.5, gw - 1, gh - 1);
  ctx.setLineDash([]);
}
