/**
 * The keepsake: an A4 page drawn on a canvas, then saved as PNG or PDF.
 * Drawn rather than templated so it looks identical everywhere and needs
 * no server.
 */
import { starFacts } from '../facts';
import type { Lang, T } from '../i18n';
import { classify } from '../sky/classify';
import { constellationOf, drawConstellation, loadSkyChart } from '../sky/constellation';
import type { Star } from '../sky/gaia';
import { hasDistance, visibility } from '../sky/physics';
import type { SkyFrame } from '../sky/zenith';
import { drawHr, drawMilkyWay, drawStarPortrait, rng } from './panels';
import { CREAM, GOLD, INK, MUTED } from './theme';

export interface CertificateInput {
  star: Star;
  frame: SkyFrame;
  title: string;
  dedication: string;
  /** Already formatted: "28 July 2025, 12:29 · Barcelona, Spain". */
  subtitle: string;
  t: T;
  lang: Lang;
}

// A4 at 200 dpi.
export const PAGE_W = 1654;
export const PAGE_H = 2339;
const M = 130;

const SERIF = '"Fraunces Variable", Georgia, serif';
const SANS = '"Inter Variable", system-ui, sans-serif';

async function fontsReady() {
  await Promise.all([
    document.fonts.load(`400 80px ${SERIF}`),
    document.fonts.load(`italic 400 40px ${SERIF}`),
    document.fonts.load(`400 30px ${SANS}`),
    document.fonts.load(`600 30px ${SANS}`),
  ]);
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number) {
  // Canvas letterSpacing isn't everywhere yet; centre manually.
  const chars = [...text];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + tracking, -tracking);
  let cx = x - width / 2;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + tracking;
  }
}

function eyebrow(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.font = `600 22px ${SANS}`;
  ctx.fillStyle = MUTED;
  spaced(ctx, text.toUpperCase(), x, y, 4);
}

function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number) {
  ctx.font = `400 21px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  wrap(ctx, text, width).slice(0, 3).forEach((l, k) => ctx.fillText(l, x, y + k * 29));
}

export async function renderCertificate(input: CertificateInput): Promise<HTMLCanvasElement> {
  const [, sky] = await Promise.all([fontsReady(), loadSkyChart()]);
  const { star, frame, t, lang } = input;
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  const cx = PAGE_W / 2;

  // Night background with a scatter of faint stars.
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const glow = ctx.createRadialGradient(cx, 820, 50, cx, 820, 1300);
  glow.addColorStop(0, 'rgba(40,55,110,0.35)');
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  const rand = rng(Number(BigInt(star.id) % 2147483647n));
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = `rgba(239,232,218,${0.06 + rand() * 0.3})`;
    ctx.beginPath();
    ctx.arc(rand() * PAGE_W, rand() * PAGE_H, 0.6 + rand() * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(232,201,143,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, PAGE_W - 120, PAGE_H - 120);

  // Header.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  ctx.font = `600 24px ${SANS}`;
  spaced(ctx, `GAIA DR3 ${star.id}`, cx, 165, 6);
  let y = 270;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.font = `400 88px ${SERIF}`;
  for (const line of wrap(ctx, input.title, PAGE_W - 2 * M - 80).slice(0, 2)) {
    ctx.fillText(line, cx, y);
    y += 98;
  }
  y -= 30;
  if (input.dedication.trim()) {
    ctx.font = `italic 400 40px ${SERIF}`;
    ctx.fillStyle = GOLD;
    for (const line of wrap(ctx, input.dedication.trim(), PAGE_W - 2 * M - 160).slice(0, 2)) {
      y += 54;
      ctx.fillText(line, cx, y);
    }
    y += 10;
  }
  y += 52;
  ctx.font = `400 30px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(input.subtitle, cx, y);

  // Fixed blocks, laid out from the bottom up.
  const panelLabelY = PAGE_H - 640;
  const factsY = panelLabelY - 300;
  const narrativeY = factsY - 140;

  // Constellation finder chart fills whatever space is left above.
  const abbr = constellationOf(star.ra, star.dec);
  const conName = sky.constellations[abbr].names[lang];
  eyebrow(ctx, t('cert.constellation'), cx, y + 82);
  ctx.font = `400 56px ${SERIF}`;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.fillText(conName, cx, y + 148);
  const chartTop = y + 175;
  const chartBottom = narrativeY - 120;
  drawConstellation(
    ctx,
    { x: M, y: chartTop, w: PAGE_W - 2 * M, h: chartBottom - chartTop },
    sky,
    abbr,
    { ra: star.ra, dec: star.dec, label: t('chart.yourStar') },
    { gold: GOLD, cream: CREAM, muted: MUTED, font: SANS, scale: 2.4 },
  );
  ctx.font = `italic 400 26px ${SERIF}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  ctx.fillText(`${t('fact.see')}: ${t(`see.${visibility(star)}`)}`, cx, chartBottom + 44);

  // Narrative.
  ctx.font = `italic 400 34px ${SERIF}`;
  ctx.fillStyle = CREAM;
  wrap(ctx, t('cert.narrative'), 1150).slice(0, 2).forEach((l, k) => ctx.fillText(l, cx, narrativeY + k * 48));

  // Facts: three columns, two rows.
  const facts = starFacts(star, frame.date, t, lang)
    .filter(f => ![t('fact.position'), t('fact.rv'), t('fact.see')].includes(f.label))
    .slice(0, 6);
  const colW = (PAGE_W - 2 * M) / 3;
  facts.forEach((f, i) => {
    const fx = M + (i % 3) * colW + colW / 2;
    const fy = factsY + Math.floor(i / 3) * 128;
    ctx.font = `600 20px ${SANS}`;
    ctx.fillStyle = MUTED;
    spaced(ctx, f.label.toUpperCase(), fx, fy, 3);
    ctx.font = `400 31px ${SANS}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    wrap(ctx, f.value, colW - 30).slice(0, 2).forEach((l, k) => ctx.fillText(l, fx, fy + 44 + k * 36));
  });

  // Three panels: what kind of star, HR diagram, Milky Way.
  const gap = 40;
  const pw = (PAGE_W - 2 * M - 2 * gap) / 3;
  const ph = 360;
  const px = [M, M + pw + gap, M + 2 * (pw + gap)];
  const top = panelLabelY + 30;
  const kind = classify(star);
  eyebrow(ctx, t('cert.kind'), px[0] + pw / 2, panelLabelY);
  eyebrow(ctx, t('cert.hr'), px[1] + pw / 2, panelLabelY);
  eyebrow(ctx, t('cert.mw'), px[2] + pw / 2, panelLabelY);

  drawStarPortrait(ctx, { x: px[0], y: top, w: pw, h: ph - 70 }, star, kind, { sun: t('kind.sun'), star: t('chart.yourStar') });
  if (kind) {
    ctx.font = `400 40px ${SERIF}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.fillText(t(`kind.${kind.kind}`), px[0] + pw / 2, top + ph - 18);
  }
  const side = Math.min(pw, ph);
  await drawHr(ctx, { x: px[1] + (pw - side * 0.86) / 2, y: top, w: side * 0.86, h: side }, star, {
    hotter: t('cert.hr.hotter'),
    cooler: t('cert.hr.cooler'),
    brighter: t('cert.hr.brighter'),
    yourStar: t('chart.yourStar'),
  });
  drawMilkyWay(ctx, { x: px[2] + (pw - side) / 2, y: top, w: side, h: side }, star, {
    sun: t('cert.mw.sun'),
    yourStar: t('chart.yourStar'),
  });

  const capY = top + ph + 46;
  const sizeText =
    kind?.radiusSun != null ? t('kind.size', { x: formatRatio(kind.radiusSun, lang) }) : kind && !kind.sure ? t('kind.colourOnly') : t('kind.sizeUnknown');
  caption(ctx, sizeText, px[0] + pw / 2, capY, pw - 10);
  caption(ctx, hasDistance(star) ? t('cert.hr.caption') : t('cert.hr.unknown'), px[1] + pw / 2, capY, pw - 10);
  caption(ctx, hasDistance(star) ? t('cert.mw.caption') : t('cert.mw.unknown'), px[2] + pw / 2, capY, pw - 10);

  ctx.font = `400 19px ${SANS}`;
  ctx.fillStyle = 'rgba(143,151,173,0.7)';
  ctx.textAlign = 'center';
  ctx.fillText(t('cert.footer'), cx, PAGE_H - 92);

  return canvas;
}

/** "3.4", "0.012", "1,200" — two significant figures. */
export function formatRatio(x: number, locale: string) {
  return x >= 100
    ? new Intl.NumberFormat(locale).format(Number(x.toPrecision(2)))
    : new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }).format(x);
}

export async function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
  await save(blob, filename, 'image/png');
}

export async function downloadPdf(canvas: HTMLCanvasElement, filename: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  await save(pdf.output('blob'), filename, 'application/pdf');
}

/** On phones, hand the file to the share sheet (save to Photos/Files, send…); elsewhere, download it. */
async function save(blob: Blob, filename: string, type: string) {
  const file = new File([blob], filename, { type });
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // user closed the sheet
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
