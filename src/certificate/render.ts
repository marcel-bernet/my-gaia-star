/**
 * The keepsake: an A4 page drawn on a canvas, then saved as PNG or PDF.
 * Drawn rather than templated so it looks identical everywhere and needs
 * no server — and makes no network requests beyond the site's own files.
 *
 * Laid out like a page from an observing log: a record header, the
 * literature check, numbered figures, a table of measurements, and what
 * Gaia DR4 adds (or will add) for this star.
 */
import { dr4IsOut } from '../dr4/source';
import { starFacts } from '../facts';
import { starName } from '../names/name';
import type { Lang, T } from '../i18n';
import { classify } from '../sky/classify';
import { constellationOf, drawConstellation, loadSkyChart } from '../sky/constellation';
import type { Star } from '../sky/gaia';
import type { Literature } from '../sky/simbad';
import { hasDistance, visibility } from '../sky/physics';
import type { SkyFrame } from '../sky/zenith';
import { drawGalaxyFaceOn, isCloseUp, type GalaxyLabels } from './galaxy';
import { drawHr, drawStarPortrait } from './panels';
import { CREAM, FAINT, GOLD, INK, MONO, MUTED, PLATE, RULE, SANS, SERIF } from './theme';

/** What DR4 showed for this star, when its own data was available. */
export interface Dr4Summary {
  /** Calendar year of each pass. */
  years: number[];
  parallax: number;
  parallaxErr: number;
}

export interface CertificateInput {
  star: Star;
  frame: SkyFrame;
  title: string;
  dedication: string;
  /** Already formatted: "28 July 2025, 12:29 · Barcelona, Spain". */
  subtitle: string;
  /** SIMBAD result, or null if it couldn't be checked (the page then hedges). */
  literature: Literature | null;
  dr4: Dr4Summary | null;
  /** Formatted DR4 release date, for the "coming" line. */
  dr4Date: string;
  /** When the certificate was made (and the literature checked). */
  made: Date;
  t: T;
  lang: Lang;
}

// A4 at 200 dpi.
export const PAGE_W = 1654;
export const PAGE_H = 2339;
const M = 130;
const W = PAGE_W - 2 * M;

async function fontsReady() {
  await Promise.all([
    document.fonts.load(`500 80px ${SERIF}`),
    document.fonts.load(`italic 400 40px ${SERIF}`),
    document.fonts.load(`400 30px ${SANS}`),
    document.fonts.load(`600 30px ${SANS}`),
    document.fonts.load(`400 24px ${MONO}`),
    document.fonts.load(`500 24px ${MONO}`),
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

/** Letter-spaced text (canvas letterSpacing isn't everywhere yet). Returns its width. */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, tracking: number, align: 'left' | 'center' | 'right' = 'left') {
  const chars = [...text];
  const width = chars.reduce((w, c) => w + ctx.measureText(c).width + tracking, -tracking);
  let cx = align === 'left' ? x : align === 'center' ? x - width / 2 : x - width;
  ctx.textAlign = 'left';
  for (const c of chars) {
    ctx.fillText(c, cx, y);
    cx += ctx.measureText(c).width + tracking;
  }
  return width;
}

function kicker(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color = FAINT, align: 'left' | 'center' | 'right' = 'left') {
  ctx.font = `500 20px ${MONO}`;
  ctx.fillStyle = color;
  return spaced(ctx, text.toUpperCase(), x, y, 2.5, align);
}

/** "Fig. 2  Where to look — Lyra" */
function figTitle(ctx: CanvasRenderingContext2D, n: number, title: string, x: number, y: number, t: T, kind: 'fig' | 'table' = 'fig') {
  ctx.font = `400 21px ${MONO}`;
  ctx.fillStyle = FAINT;
  ctx.textAlign = 'left';
  const label = t(kind, { n });
  ctx.fillText(label, x, y);
  const lw = ctx.measureText(label).width;
  ctx.font = `600 25px ${SANS}`;
  ctx.fillStyle = CREAM;
  ctx.fillText(title, x + lw + 14, y);
}

function caption(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lines = 3) {
  ctx.font = `400 21px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'left';
  wrap(ctx, text, width).slice(0, lines).forEach((l, k) => ctx.fillText(l, x, y + k * 29));
}

function rule(ctx: CanvasRenderingContext2D, y: number, x = M, w = W) {
  ctx.fillStyle = RULE;
  ctx.fillRect(x, Math.round(y), w, 1.5);
}

function plate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = PLATE;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = RULE;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x + 0.75, y + 0.75, w - 1.5, h - 1.5);
}

/** Registration marks in the page corners, like a plate from an observatory archive. */
function cornerMarks(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = 'rgba(233, 231, 226, 0.3)';
  ctx.lineWidth = 1.5;
  const d = 64;
  const l = 34;
  for (const [x, y, sx, sy] of [
    [d, d, 1, 1],
    [PAGE_W - d, d, -1, 1],
    [d, PAGE_H - d, 1, -1],
    [PAGE_W - d, PAGE_H - d, -1, -1],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * l);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * l, y);
    ctx.stroke();
  }
}

export async function renderCertificate(input: CertificateInput): Promise<HTMLCanvasElement> {
  const [, sky] = await Promise.all([fontsReady(), loadSkyChart()]);
  const { star, frame, t, lang, literature } = input;
  const canvas = document.createElement('canvas');
  canvas.width = PAGE_W;
  canvas.height = PAGE_H;
  const ctx = canvas.getContext('2d')!;
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  cornerMarks(ctx);

  // Record header.
  const made = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(input.made);
  kicker(ctx, `My Gaia Star · ${t('cert.record')}`, M, 150);
  kicker(ctx, made, M + W, 150, FAINT, 'right');
  rule(ctx, 172);

  // Title, dedication, moment.
  let y = 290;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  ctx.font = `500 84px ${SERIF}`;
  for (const line of wrap(ctx, input.title, W).slice(0, 2)) {
    ctx.fillText(line, M, y);
    y += 92;
  }
  y -= 30;
  if (input.dedication.trim()) {
    ctx.font = `italic 400 38px ${SERIF}`;
    ctx.fillStyle = MUTED;
    for (const line of wrap(ctx, input.dedication.trim(), W).slice(0, 2)) {
      y += 52;
      ctx.fillText(line, M, y);
    }
    y += 8;
  }
  y += 56;
  ctx.font = `400 28px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(input.subtitle, M, y);
  y += 44;
  ctx.font = `400 24px ${MONO}`;
  ctx.fillStyle = CREAM;
  ctx.fillText(`Gaia DR3 ${star.id}`, M, y);
  // Its name, made from that number (src/names).
  ctx.font = `italic 400 30px ${SERIF}`;
  ctx.fillStyle = GOLD;
  for (const line of wrap(ctx, `“${starName(star.id, lang)}”`, W).slice(0, 2)) {
    y += 42;
    ctx.fillText(line, M, y);
  }

  // First look: the literature check.
  y += 50;
  const boxTop = y;
  const statement =
    literature === null
      ? t('cert.narrative')
      : literature.known
        ? t('first.known.title', { name: literature.name })
        : t('first.unknown.title');
  const detail =
    literature === null
      ? null
      : literature.known
        ? t('first.known.body', { papers: literature.papers === 1 ? t('papers.one') : t('papers.many', { n: literature.papers }) })
        : t('cert.firstLook.body', { date: made });
  ctx.font = `500 40px ${SERIF}`;
  const stLines = wrap(ctx, statement, W - 70).slice(0, 2);
  ctx.font = `400 23px ${SANS}`;
  const dtLines = detail ? wrap(ctx, detail, W - 70).slice(0, 2) : [];
  const boxH = 46 + (literature && !literature.known ? 34 : 0) + stLines.length * 50 + dtLines.length * 32 + 20;
  ctx.fillStyle = 'rgba(233, 231, 226, 0.04)';
  ctx.fillRect(M, boxTop, W, boxH);
  ctx.fillStyle = literature && !literature.known ? GOLD : 'rgba(233, 231, 226, 0.25)';
  ctx.fillRect(M, boxTop, 4, boxH);
  let by = boxTop + 54;
  if (literature && !literature.known) {
    kicker(ctx, t('first.badge'), M + 36, by - 8, GOLD);
    by += 34;
  }
  ctx.font = `500 40px ${SERIF}`;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'left';
  stLines.forEach(l => {
    ctx.fillText(l, M + 36, by);
    by += 50;
  });
  ctx.font = `400 23px ${SANS}`;
  ctx.fillStyle = MUTED;
  dtLines.forEach(l => {
    ctx.fillText(l, M + 36, by - 8);
    by += 32;
  });
  y = boxTop + boxH;

  // Fixed blocks, laid out from the bottom up.
  const footerY = PAGE_H - 100;
  const dr4H = input.dr4 ? 200 : 128;
  const dr4Top = footerY - 50 - dr4H;
  const ph = 290;
  const panelsTop = dr4Top - 64 - (ph + 26 + 40 + 3 * 29);
  const tableTop = panelsTop - 60 - 236;

  // Fig. 1: where to look — fills whatever space is left.
  let fig = 0;
  const nextFig = () => ++fig;
  const abbr = constellationOf(star.ra, star.dec);
  const conName = sky.constellations[abbr].names[lang];
  const chartTitleY = y + 66;
  figTitle(ctx, nextFig(), `${t('card.where')} — ${conName}`, M, chartTitleY, t);
  const chartTop = chartTitleY + 22;
  const chartBottom = tableTop - 100;
  plate(ctx, M, chartTop, W, chartBottom - chartTop);
  drawConstellation(
    ctx,
    { x: M, y: chartTop, w: W, h: chartBottom - chartTop },
    sky,
    abbr,
    { ra: star.ra, dec: star.dec, label: t('chart.yourStar') },
    { gold: GOLD, cream: CREAM, muted: MUTED, font: SANS, scale: 2.3 },
  );
  caption(ctx, `${t('fact.see')}: ${t(`see.${visibility(star)}`)}.`, M, chartBottom + 36, W, 1);

  // Table: measurements, three columns.
  const facts = starFacts(star, frame.date, t, lang)
    .filter(f => ![t('fact.position'), t('fact.rv'), t('fact.see')].includes(f.label))
    .slice(0, 6);
  figTitle(ctx, 1, t('table.measurements'), M, tableTop, t, 'table');
  const colW = W / 3;
  facts.forEach((f, i) => {
    const fx = M + (i % 3) * colW;
    const fy = tableTop + 30 + Math.floor(i / 3) * 104;
    rule(ctx, fy, fx, colW - 28);
    ctx.font = `400 20px ${SANS}`;
    ctx.fillStyle = FAINT;
    ctx.textAlign = 'left';
    ctx.fillText(f.label, fx, fy + 34);
    ctx.font = `400 27px ${SANS}`;
    ctx.fillStyle = CREAM;
    wrap(ctx, f.value, colW - 36).slice(0, 2).forEach((l, k) => ctx.fillText(l, fx, fy + 70 + k * 32));
  });

  // Three figures: what kind of star, HR diagram, Milky Way.
  const gap = 44;
  const pw = (W - 2 * gap) / 3;
  const px = [M, M + pw + gap, M + 2 * (pw + gap)];
  const top = panelsTop + 26;
  const kind = classify(star);
  figTitle(ctx, nextFig(), t('cert.kind'), px[0], panelsTop, t);
  figTitle(ctx, nextFig(), t('cert.hr'), px[1], panelsTop, t);
  figTitle(ctx, nextFig(), t('cert.mw'), px[2], panelsTop, t);
  for (const x of px) plate(ctx, x, top, pw, ph);

  drawStarPortrait(ctx, { x: px[0], y: top + 10, w: pw, h: ph - 80 }, star, kind, { sun: t('kind.sun'), star: t('chart.yourStar') });
  if (kind) {
    ctx.font = `500 34px ${SERIF}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    ctx.fillText(t(`kind.${kind.kind}`), px[0] + pw / 2, top + ph - 26);
  }
  const side = Math.min(pw, ph) - 20;
  await drawHr(ctx, { x: px[1] + (pw - side * 0.86) / 2, y: top + 10, w: side * 0.86, h: side }, star, {
    hotter: t('cert.hr.hotter'),
    cooler: t('cert.hr.cooler'),
    brighter: t('cert.hr.brighter'),
    yourStar: t('chart.yourStar'),
  });
  const galaxyLabels: GalaxyLabels = {
    sun: t('cert.mw.sun'),
    yourStar: t('chart.yourStar'),
    centre: t('galaxy.centre'),
    scale: ly => t('fact.distance.value', { ly: new Intl.NumberFormat(lang).format(ly) }),
    ly: ly => t('galaxy.ly', { ly: new Intl.NumberFormat(lang).format(ly) }),
      plane: t('galaxy.plane'),
    arm: name => t(`arm.${name}`),
  };
  drawGalaxyFaceOn(ctx, { x: px[2] + (pw - side) / 2, y: top + 10, w: side, h: side }, star, galaxyLabels);

  const capY = top + ph + 40;
  const sizeText =
    kind?.radiusSun != null ? t('kind.size', { x: formatRatio(kind.radiusSun, lang) }) : kind && !kind.sure ? t('kind.colourOnly') : t('kind.sizeUnknown');
  caption(ctx, sizeText, px[0], capY, pw);
  caption(ctx, hasDistance(star) ? t('cert.hr.caption') : t('cert.hr.unknown'), px[1], capY, pw);
  const mwCaption = isCloseUp(star) ? t('cert.mw.closeup') : hasDistance(star) ? t('cert.mw.caption') : t('cert.mw.unknown');
  caption(ctx, mwCaption, px[2], capY, pw);

  // Gaia DR4.
  rule(ctx, dr4Top);
  kicker(ctx, 'Gaia DR4', M, dr4Top + 46, input.dr4 ? GOLD : FAINT);
  if (input.dr4) {
    const d = input.dr4;
    ctx.font = `400 24px ${SANS}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'left';
    const nf = new Intl.NumberFormat(lang, { maximumFractionDigits: 3, minimumFractionDigits: 3 });
    wrap(ctx, t('cert.dr4.live', { n: d.years.length, plx: `${nf.format(d.parallax)} ± ${nf.format(d.parallaxErr)}` }), W - 260)
      .slice(0, 2)
      .forEach((l, k) => ctx.fillText(l, M + 260, dr4Top + 46 + k * 32));
    // One tick per pass, 2014–2020.
    const ty = dr4Top + 170;
    const x = (yr: number) => M + 260 + ((yr - 2014.5) / 5.7) * (W - 260);
    ctx.fillStyle = 'rgba(233, 231, 226, 0.6)';
    for (const yr of d.years) ctx.fillRect(Math.round(x(yr)) - 1, ty - 60, 2, 60);
    rule(ctx, ty, M + 260, W - 260);
    ctx.font = `400 18px ${MONO}`;
    ctx.fillStyle = FAINT;
    ctx.textAlign = 'center';
    for (let yr = 2015; yr <= 2020; yr++) ctx.fillText(String(yr), x(yr), ty + 26);
  } else {
    ctx.font = `400 23px ${SANS}`;
    ctx.fillStyle = MUTED;
    ctx.textAlign = 'left';
    wrap(ctx, t(dr4IsOut(input.made) ? 'cert.dr4.out' : 'cert.dr4.pending', { date: input.dr4Date }), W - 260)
      .slice(0, 3)
      .forEach((l, k) => ctx.fillText(l, M + 260, dr4Top + 46 + k * 31));
  }

  // Footer.
  rule(ctx, footerY - 40);
  ctx.font = `400 17px ${MONO}`;
  ctx.fillStyle = FAINT;
  ctx.textAlign = 'left';
  ctx.fillText(t('cert.footer'), M, footerY);

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
