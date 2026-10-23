/**
 * The keepsake: an A4 page drawn on a canvas, then saved as PNG or PDF.
 * Drawn rather than templated so it looks identical everywhere and needs
 * no server.
 */
import type { T } from '../i18n';
import { starFacts } from '../facts';
import type { Star } from '../sky/gaia';
import { hasDistance } from '../sky/physics';
import type { SkyFrame } from '../sky/zenith';
import { drawHr, drawMilkyWay, drawSkyChart, rng, type Box } from './panels';
import { CREAM, GOLD, INK, MUTED } from './theme';

export interface CertificateInput {
  star: Star;
  stars: Star[];
  frame: SkyFrame;
  title: string;
  dedication: string;
  /** Already formatted: "28 July 2025, 12:29 · Barcelona, Spain". */
  subtitle: string;
  t: T;
  locale: string;
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

export async function renderCertificate(input: CertificateInput): Promise<HTMLCanvasElement> {
  await fontsReady();
  const { star, stars, frame, t, locale } = input;
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
  for (let i = 0; i < 260; i++) {
    ctx.fillStyle = `rgba(239,232,218,${0.08 + rand() * 0.35})`;
    const r = 0.6 + rand() * 1.6;
    ctx.beginPath();
    ctx.arc(rand() * PAGE_W, rand() * PAGE_H, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Thin gold frame.
  ctx.strokeStyle = 'rgba(232,201,143,0.35)';
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, PAGE_W - 120, PAGE_H - 120);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GOLD;
  ctx.font = `600 24px ${SANS}`;
  spaced(ctx, `GAIA DR3 ${star.id}`, cx, 175, 6);

  let y = 290;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  ctx.font = `400 92px ${SERIF}`;
  for (const line of wrap(ctx, input.title, PAGE_W - 2 * M - 80).slice(0, 2)) {
    ctx.fillText(line, cx, y);
    y += 104;
  }
  y -= 30;
  if (input.dedication.trim()) {
    ctx.font = `italic 400 42px ${SERIF}`;
    ctx.fillStyle = GOLD;
    for (const line of wrap(ctx, input.dedication.trim(), PAGE_W - 2 * M - 160).slice(0, 2)) {
      y += 56;
      ctx.fillText(line, cx, y);
    }
    y += 14;
  }
  y += 56;
  ctx.font = `400 32px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.fillText(input.subtitle, cx, y);

  // Sky chart.
  const chartTop = y + 70;
  const chartSize = Math.min(600, 1200 - chartTop);
  drawSkyChart(
    ctx,
    { x: cx - chartSize / 2, y: chartTop, w: chartSize, h: chartSize },
    frame,
    stars,
    star,
    { n: 'N', e: 'E' },
  );
  y = chartTop + chartSize + 50;
  ctx.font = `600 22px ${SANS}`;
  ctx.fillStyle = MUTED;
  spaced(ctx, t('cert.chart').toUpperCase(), cx, y, 4);

  // Narrative.
  y += 70;
  ctx.font = `italic 400 34px ${SERIF}`;
  ctx.fillStyle = CREAM;
  ctx.textAlign = 'center';
  for (const line of wrap(ctx, t('cert.narrative'), 1150)) {
    ctx.fillText(line, cx, y);
    y += 50;
  }

  // Facts: three columns.
  y += 40;
  const facts = starFacts(star, frame.date, t, locale).filter(f => f.label !== t('fact.position')).slice(0, 6);
  const colW = (PAGE_W - 2 * M) / 3;
  facts.forEach((f, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    const fx = M + col * colW + colW / 2;
    const fy = y + row * 120;
    ctx.textAlign = 'center';
    ctx.font = `600 20px ${SANS}`;
    ctx.fillStyle = MUTED;
    spaced(ctx, f.label.toUpperCase(), fx, fy, 3);
    ctx.font = `400 32px ${SANS}`;
    ctx.fillStyle = CREAM;
    ctx.textAlign = 'center';
    const lines = wrap(ctx, f.value, colW - 30);
    lines.slice(0, 2).forEach((l, k) => ctx.fillText(l, fx, fy + 46 + k * 38));
  });
  y += Math.ceil(facts.length / 3) * 120 + 40;

  // Two diagrams side by side.
  const panelTop = y;
  const panelH = PAGE_H - 160 - panelTop - 120;
  const colX = [M + 40, cx + 40];
  const panelW = cx - M - 80;
  const side = Math.min(panelW, panelH);

  ctx.font = `600 22px ${SANS}`;
  ctx.fillStyle = MUTED;
  spaced(ctx, t('cert.hr').toUpperCase(), colX[0] + panelW / 2, panelTop, 4);
  spaced(ctx, t('cert.mw').toUpperCase(), colX[1] + panelW / 2, panelTop, 4);

  const hrBox: Box = { x: colX[0] + (panelW - side * 0.9) / 2, y: panelTop + 34, w: side * 0.9, h: side };
  await drawHr(ctx, hrBox, star, { hotter: t('cert.hr.hotter'), cooler: t('cert.hr.cooler'), brighter: t('cert.hr.brighter') });
  const mwBox: Box = { x: colX[1] + (panelW - side) / 2, y: panelTop + 34, w: side, h: side };
  drawMilkyWay(ctx, mwBox, star, { sun: t('cert.mw.sun'), centre: t('cert.mw.centre') });

  ctx.font = `400 22px ${SANS}`;
  ctx.fillStyle = MUTED;
  ctx.textAlign = 'center';
  const capY = panelTop + 34 + side + 48;
  const mwCaption = hasDistance(star) ? t('cert.mw.caption') : t('cert.mw.unknown');
  wrap(ctx, t('cert.hr.caption'), panelW - 20).forEach((l, k) => ctx.fillText(l, colX[0] + panelW / 2, capY + k * 30));
  wrap(ctx, mwCaption, panelW - 20).forEach((l, k) => ctx.fillText(l, colX[1] + panelW / 2, capY + k * 30));

  ctx.font = `400 20px ${SANS}`;
  ctx.fillStyle = 'rgba(143,151,173,0.7)';
  ctx.fillText(t('cert.footer'), cx, PAGE_H - 100);

  return canvas;
}

export async function downloadPng(canvas: HTMLCanvasElement, filename: string) {
  const blob = await new Promise<Blob>(r => canvas.toBlob(b => r(b!), 'image/png'));
  save(blob, filename);
}

export async function downloadPdf(canvas: HTMLCanvasElement, filename: string) {
  const { jsPDF } = await import('jspdf');
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
  pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 210, 297);
  save(pdf.output('blob'), filename);
}

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
