/**
 * How stars are drawn on the map: ink on the paper, in a few size classes
 * by brightness so a size means something and the readout can show a key.
 * Each star is a dot in a soft ink glow; the brightest also get the
 * diffraction spikes a telescope puts on a bright star. Your star is the
 * only coloured one.
 */

/** Dot radius (px) for each class, faintest first. The faint end stays big enough to see at a glance. */
export const STAR_RADII = [2.4, 2.9, 3.6, 4.5, 5.6, 7];

/**
 * The classes are drawn for a search circle about 300 px in radius. A smaller
 * circle (a phone, or zoomed out) shrinks the dots with it, down to 60%, so a
 * crowded field doesn't turn into one black mass. A bigger one (zoomed in)
 * grows them, but much more slowly than the map: the stars spread apart and
 * have room, yet stay points rather than discs. Each zoom level doubles the
 * circle and grows the dots by ~27%, up to 2.5×.
 */
export function dotScale(circleRadiusPx: number) {
  const ratio = circleRadiusPx / 300;
  if (ratio <= 1) return Math.max(0.6, ratio);
  return Math.min(2.5, ratio ** 0.35);
}

export interface MagnitudeScale {
  /** Brightest and faintest G in the field: the two ends of the key. */
  brightest: number;
  faintest: number;
  /** Size class for a G magnitude, 0 (faintest) … STAR_RADII.length − 1. */
  classOf: (g: number) => number;
}

/**
 * Classes are relative to the field, so a naked-eye search and a deep one both
 * use the whole range. Squaring keeps most stars small, as on a real chart: a
 * few bright dots stand out of many faint ones.
 */
export function magnitudeScale(gs: number[]): MagnitudeScale {
  const brightest = Math.min(...gs);
  const faintest = Math.max(...gs);
  const span = Math.max(faintest - brightest, 1);
  const top = STAR_RADII.length - 1;
  return {
    brightest,
    faintest,
    classOf: g => {
      const bright = 1 - (g - brightest) / span;
      return Math.min(top, Math.floor(bright * bright * STAR_RADII.length));
    },
  };
}

/** Classes from this one up get diffraction spikes: only the few bright stars. */
const SPIKED_FROM = 3;

const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ');

/** How far a star's drawing reaches from its centre (px): the area to repaint. */
export function starExtent(cls: number, k: number) {
  const r = STAR_RADII[cls] * k;
  const glow = r * (2.4 + 0.3 * cls);
  const spike = cls >= SPIKED_FROM ? r * (2.6 + 1.1 * (cls - SPIKED_FROM)) : 0;
  return Math.ceil(Math.max(glow, r + spike)) + 1;
}

/**
 * One star at (x, y): glow, spikes, then the dot. `colour` is a #rrggbb ink;
 * `k` scales the class sizes to the screen (dotScale).
 */
export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, cls: number, k: number, colour: string) {
  const r = STAR_RADII[cls] * k;
  const ink = rgb(colour);

  // A soft glow: stronger and wider for brighter stars, nothing for the faintest.
  if (cls > 0) {
    const reach = r * (2.4 + 0.3 * cls);
    const glow = ctx.createRadialGradient(x, y, r * 0.6, x, y, reach);
    glow.addColorStop(0, `rgba(${ink}, ${0.1 + 0.035 * cls})`);
    glow.addColorStop(1, `rgba(${ink}, 0)`);
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, reach, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Four hairline spikes, fading towards their tips.
  if (cls >= SPIKED_FROM) {
    const len = r + r * (2.6 + 1.1 * (cls - SPIKED_FROM));
    ctx.lineWidth = Math.max(0.75, 0.5 * k + 0.35);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const fade = ctx.createLinearGradient(x, y, x + dx * len, y + dy * len);
      fade.addColorStop(0, `rgba(${ink}, 0.85)`);
      fade.addColorStop(1, `rgba(${ink}, 0)`);
      ctx.strokeStyle = fade;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + dx * len, y + dy * len);
      ctx.stroke();
    }
  }

  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fill();
}
