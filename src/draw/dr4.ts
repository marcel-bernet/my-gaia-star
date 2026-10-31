/** The DR4 section's figures: pixels, passes, the path across the sky, and residuals. */
import { CREAM, SIGNAL, MONO, PLOT_FAINT, PLOT_MUTED, PLOT_RULE } from './theme';
import { parallaxDisplacement, predictAl, type EpochAstrometry, type Fit, type TransitPoint } from '../dr4/epoch';

type Ctx = CanvasRenderingContext2D;

export const YEAR_MIN = 2014.5;
export const YEAR_MAX = 2020.2;

const rad = (d: number) => (d * Math.PI) / 180;

function axisText(ctx: Ctx, text: string, x: number, y: number, align: CanvasTextAlign = 'center', color = PLOT_FAINT) {
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
export function drawTimeline(
  ctx: Ctx,
  w: number,
  h: number,
  pts: TransitPoint[],
  selected: number | null,
  accent: string = SIGNAL,
) {
  const left = 8;
  const right = w - 8;
  const base = h - 22;
  const top = 10;
  const x = (y: number) => left + ((y - YEAR_MIN) / (YEAR_MAX - YEAR_MIN)) * (right - left);
  ctx.strokeStyle = PLOT_RULE;
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
    ctx.fillStyle = i === selected ? accent : 'rgba(233, 231, 226, 0.55)';
    ctx.fillRect(Math.round(x(p.year)) - (i === selected ? 1 : 0.5), base - hh, i === selected ? 2.5 : 1.5, hh);
  });
}

export interface PathRange {
  /** Calendar years shown. */
  from: number;
  to: number;
  /** Take the proper motion out, leaving the parallax loop. */
  noPm?: boolean;
}

/** Where the five-parameter model puts the star at a calendar year, relative to its 2017.5 position (east, north; mas). */
function modelAt(ea: EpochAstrometry, fit: Fit, year: number, noPm = false) {
  const tau = noPm ? 0 : year - 2017.5;
  const d = parallaxDisplacement(ea.ra0, ea.dec0, year);
  return { e: fit.pmRa * tau + fit.parallax * d.e, n: fit.pmDec * tau + fit.parallax * d.n };
}

/**
 * Each passage pins the star down along the scan direction only: it lies
 * somewhere on a line across the scan. Returns that line's centre (on the
 * model's across-scan position) and the scan direction.
 */
function measurements(ea: EpochAstrometry, fit: Fit, pts: TransitPoint[], noPm = false) {
  return pts.map(p => {
    const u = { e: Math.sin(rad(p.psi)), n: Math.cos(rad(p.psi)) };
    const m = modelAt(ea, fit, p.year, noPm);
    const off = p.w - predictAl(fit, p.year - 2010, p.psi, p.pf);
    return { c: { e: m.e + off * u.e, n: m.n + off * u.n }, u, year: p.year };
  });
}

/** The full span of the data: mid-2014 to early 2020. */
export const FULL_PATH: PathRange = { from: 2014.55, to: 2020.15 };

/**
 * Should the sky path get a second, zoomed panel? When the star drifts much
 * further than its parallax loop is wide, the loop flattens into a wiggle.
 */
export function needsZoom(fit: Fit) {
  const drift = Math.hypot(fit.pmRa, fit.pmDec) * (FULL_PATH.to - FULL_PATH.from);
  return drift > 8 * Math.max(fit.parallax, 0.2);
}

/** The same six years with the drift taken out: the yearly loop on its own. */
export const LOOP_PATH: PathRange = { ...FULL_PATH, noPm: true };

/** Extent of the drawn path, mas: [minE, maxE, minN, maxN]. */
export function pathExtent(ea: EpochAstrometry, fit: Fit, pts: TransitPoint[], range: PathRange) {
  const es: number[] = [];
  const ns: number[] = [];
  for (let k = 0; k <= 200; k++) {
    const m = modelAt(ea, fit, range.from + ((range.to - range.from) * k) / 200, range.noPm);
    es.push(m.e);
    ns.push(m.n);
  }
  // Measurements, but not the few wild ones: they would shrink the picture.
  const meas = measurements(ea, fit, pts, range.noPm).filter(m => m.year >= range.from && m.year <= range.to);
  const dist = meas.map(m => {
    const t = modelAt(ea, fit, m.year, range.noPm);
    return Math.hypot(m.c.e - t.e, m.c.n - t.n);
  });
  const cut = [...dist].sort((a, b) => a - b)[Math.floor(dist.length * 0.9)] ?? 0;
  meas.forEach((m, i) => {
    if (dist[i] > cut) return;
    es.push(m.c.e);
    ns.push(m.c.n);
  });
  const pad = Math.max(0.3, fit.parallax * 0.15);
  return [Math.min(...es) - pad, Math.max(...es) + pad, Math.min(...ns) - pad, Math.max(...ns) + pad] as const;
}

/** Height that keeps the path at true aspect in a `w`-wide canvas, within limits. */
export function pathHeight(ext: readonly [number, number, number, number], w: number, min = 170, max = 340) {
  const [e0, e1, n0, n1] = ext;
  return Math.round(Math.min(max, Math.max(min, ((w - 40) * (n1 - n0)) / (e1 - e0) + 40)));
}

/**
 * The star's path on the sky, as Gaia measured it: proper motion and the
 * yearly parallax loop together, the model in gold, each passage a short
 * line across the scan on which the star lies. North up, east left.
 */
export function drawSkyPath(
  ctx: Ctx,
  w: number,
  h: number,
  ea: EpochAstrometry,
  fit: Fit,
  pts: TransitPoint[],
  selected: number | null,
  range: PathRange,
  accent: string = SIGNAL,
) {
  const [e0, e1, n0, n1] = pathExtent(ea, fit, pts, range);
  const m = { l: 22, r: 14, t: 18, b: 26 };
  const scale = Math.min((w - m.l - m.r) / (e1 - e0), (h - m.t - m.b) / (n1 - n0));
  const cx = m.l + (w - m.l - m.r) / 2;
  const cy = m.t + (h - m.t - m.b) / 2;
  const X = (e: number) => cx - (e - (e0 + e1) / 2) * scale; // east to the left, as on the sky
  const Y = (n: number) => cy - (n - (n0 + n1) / 2) * scale;

  // Compass and scale bar.
  ctx.strokeStyle = PLOT_FAINT;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(30.5, 30.5);
  ctx.lineTo(30.5, 14);
  ctx.moveTo(30.5, 30.5);
  ctx.lineTo(14, 30.5);
  ctx.stroke();
  axisText(ctx, 'N', 30.5, 7);
  axisText(ctx, 'E', 7, 30.5);
  const R = Math.max(e1 - e0, n1 - n0);
  const bar = niceStep(R / 2.5, 1);
  ctx.strokeStyle = PLOT_MUTED;
  ctx.beginPath();
  ctx.moveTo(w - 14 - bar * scale, h - 10.5);
  ctx.lineTo(w - 14, h - 10.5);
  ctx.moveTo(w - 14 - bar * scale + 0.5, h - 14);
  ctx.lineTo(w - 14 - bar * scale + 0.5, h - 7);
  ctx.moveTo(w - 14.5, h - 14);
  ctx.lineTo(w - 14.5, h - 7);
  ctx.stroke();
  axisText(ctx, `${fmtMas(bar)} mas`, w - 14 - (bar * scale) / 2, h - 20, 'center', PLOT_MUTED);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.clip();

  // Measurements.
  const meas = measurements(ea, fit, pts, range.noPm);
  const half = Math.min(Math.max(R * 0.05, 0.15) * scale, 9);
  ctx.lineCap = 'round';
  meas.forEach((mm, i) => {
    if (i === selected || mm.year < range.from || mm.year > range.to) return;
    const x = X(mm.c.e);
    const y = Y(mm.c.n);
    // Across-scan direction on screen: (−cos ψ, sin ψ) in (east, north), east flipped.
    const dx = mm.u.n * half;
    const dy = -mm.u.e * half;
    ctx.strokeStyle = 'rgba(233, 231, 226, 0.45)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x - dx, y - dy);
    ctx.lineTo(x + dx, y + dy);
    ctx.stroke();
  });

  // Model: the track, with a tick on each 1 January.
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.8;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  const steps = 400;
  for (let k = 0; k <= steps; k++) {
    const p = modelAt(ea, fit, range.from + ((range.to - range.from) * k) / steps, range.noPm);
    if (k === 0) ctx.moveTo(X(p.e), Y(p.n));
    else ctx.lineTo(X(p.e), Y(p.n));
  }
  ctx.stroke();
  for (let yr = Math.ceil(range.from * 4) / 4; yr <= range.to; yr += 0.25) {
    const p = modelAt(ea, fit, yr, range.noPm);
    const whole = Math.abs(yr - Math.round(yr)) < 1e-6;
    ctx.fillStyle = whole ? accent : 'rgba(10, 11, 13, 0.9)';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(X(p.e), Y(p.n), whole ? 3 : 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  // Year labels, set off to the side of the track (on a loop they would pile up).
  for (let yr = Math.ceil(range.from); yr <= range.to && !range.noPm; yr++) {
    const a = modelAt(ea, fit, yr - 0.02);
    const b = modelAt(ea, fit, yr + 0.02);
    const p = modelAt(ea, fit, yr);
    let nx = -(Y(b.n) - Y(a.n));
    let ny = X(b.e) - X(a.e);
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    // Away from the middle of the picture.
    if (nx * (X(p.e) - cx) + ny * (Y(p.n) - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const lx = X(p.e) + nx * 14;
    const ly = Y(p.n) + ny * 12;
    ctx.font = `10.5px ${MONO}`;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(10, 11, 13, 0.9)';
    ctx.lineWidth = 3;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeText(String(yr), lx, ly);
    ctx.fillStyle = accent;
    ctx.fillText(String(yr), lx, ly);
  }

  if (selected !== null && meas[selected] && meas[selected].year >= range.from && meas[selected].year <= range.to) {
    const mm = meas[selected];
    const x = X(mm.c.e);
    const y = Y(mm.c.n);
    ctx.strokeStyle = CREAM;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(x - mm.u.n * half * 1.5, y + mm.u.e * half * 1.5);
    ctx.lineTo(x + mm.u.n * half * 1.5, y - mm.u.e * half * 1.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** What the five-parameter model leaves unexplained, passage by passage. */
export function drawResiduals(
  ctx: Ctx,
  w: number,
  h: number,
  fit: Fit,
  pts: TransitPoint[],
  selected: number | null,
  accent: string = SIGNAL,
) {
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
    ctx.strokeStyle = Math.abs(v) < 1e-9 ? 'rgba(233, 231, 226, 0.28)' : PLOT_RULE;
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
    ctx.strokeStyle = on ? accent : 'rgba(233, 231, 226, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(px, y(Math.max(-R, v - p.e)));
    ctx.lineTo(px, y(Math.min(R, v + p.e)));
    ctx.stroke();
    ctx.fillStyle = on ? accent : CREAM;
    ctx.beginPath();
    ctx.arc(px, y(v), on ? 3.5 : 2.2, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Window geometry for a transit's window class; the pixel values themselves are a schematic. */
export const WINDOWS: Record<number, { al: number; ac: number; label: string }> = {
  0: { al: 18, ac: 12, label: '18 × 12 px, 2-D' },
  1: { al: 18, ac: 12, label: '18 × 12 px, 2-D' },
  2: { al: 18, ac: 1, label: '18 × 1 px, 1-D' },
  3: { al: 12, ac: 1, label: '12 × 1 px, 1-D' },
};

/** Canvas height that suits drawPixels for this window class. */
export const pixelsHeight = (gClass: number) => ((WINDOWS[gClass] ?? WINDOWS[3]).ac > 1 ? 250 : 192);

/**
 * The star as Gaia recorded it on one passage: the window read out on each
 * CCD it crossed, one enlarged above and all of them, in order, below.
 * The light in each pixel is a smooth made-up profile, not data.
 */
export function drawPixels(ctx: Ctx, w: number, h: number, gClass: number, nCcd: number, accent: string = SIGNAL) {
  const win = WINDOWS[gClass] ?? WINDOWS[3];
  const twoD = win.ac > 1;
  const sigmaAl = win.al / 9;
  const sigmaAc = Math.max(win.ac / 7, 0.5);
  const light = (i: number, j: number) => {
    const a = Math.exp(-(((i + 0.5 - win.al / 2) / sigmaAl) ** 2) / 2);
    const b = twoD ? Math.exp(-(((j + 0.5 - win.ac / 2) / sigmaAc) ** 2) / 2) : 1;
    return a * b;
  };
  // Dark → warm white, like a stretched CCD frame.
  const shade = (v: number) => {
    const t = Math.min(1, Math.max(0, v)) ** 0.7;
    const r = Math.round(14 + 241 * t);
    const g = Math.round(15 + 221 * t ** 1.1);
    const b = Math.round(18 + 182 * t ** 1.5);
    return `rgb(${r},${g},${b})`;
  };
  const cells = (ox: number, oy: number, cw: number, ch: number, gap: number) => {
    for (let i = 0; i < win.al; i++) {
      for (let j = 0; j < win.ac; j++) {
        ctx.fillStyle = shade(0.03 + 0.97 * light(i, j));
        ctx.fillRect(ox + i * cw + gap / 2, oy + j * ch + gap / 2, cw - gap, ch - gap);
      }
    }
  };

  // Enlarged window.
  const bigH = twoD ? 150 : 46;
  const cell = twoD ? Math.min((w - 60) / win.al, bigH / win.ac) : Math.min((w - 60) / win.al, 26);
  const gw = cell * win.al;
  const gh = twoD ? cell * win.ac : bigH;
  const ox = (w - gw) / 2;
  const profileH = twoD ? 0 : 40;
  const oy = 14 + profileH;
  if (!twoD) {
    // The light profile along the scan, as a line over the strip.
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let k = 0; k <= 120; k++) {
      const i = (k / 120) * win.al - 0.5;
      const v = Math.exp(-(((i + 0.5 - win.al / 2) / sigmaAl) ** 2) / 2);
      const x = ox + (k / 120) * gw;
      const y = oy - 6 - v * (profileH - 8);
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  cells(ox, oy, cell, twoD ? cell : gh, twoD ? 1 : 2);
  ctx.strokeStyle = 'rgba(232, 201, 143, 0.55)';
  ctx.lineWidth = 1;
  ctx.strokeRect(ox - 3.5, oy - 3.5, gw + 7, gh + 7);
  axisText(ctx, 'along scan →', ox + gw, oy + gh + 14, 'right');
  axisText(ctx, `${win.al} px`, ox, oy + gh + 14, 'left');

  // Every CCD on the passage, in the order the star crossed them.
  const n = Math.max(1, Math.min(nCcd, 12));
  const top = oy + gh + 34;
  const rowH = h - top - 16;
  const tw = Math.min(28, (w - 40) / n - 4);
  const th = twoD ? Math.min(rowH, ((tw * win.ac) / win.al) * 1.6) : Math.min(rowH, 30);
  const total = n * tw + (n - 1) * 4;
  const sx = (w - total) / 2;
  for (let k = 0; k < n; k++) {
    const x = sx + k * (tw + 4);
    const cw = tw / win.al;
    const ch = twoD ? th / win.ac : th;
    for (let i = 0; i < win.al; i++) {
      for (let j = 0; j < win.ac; j++) {
        ctx.fillStyle = shade(0.03 + 0.97 * light(i, j));
        ctx.fillRect(x + i * cw, top + j * ch, cw + 0.3, ch + 0.3);
      }
    }
    axisText(ctx, String(k + 1), x + tw / 2, top + th + 9);
  }
}
