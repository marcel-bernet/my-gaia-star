/**
 * How stars are drawn on the map: points of light in their own colours on
 * the dark plate of sky laid over the map, in a few size classes by
 * brightness, so a size means something and the readout can show a key.
 * Your star is the orange one.
 */

/** Dot radius (px) for each class, faintest first. */
export const STAR_RADII = [1.75, 2.4, 3.2, 4.2, 5.4, 6.8];

/**
 * The classes are drawn for a search circle about 300 px in radius. A smaller
 * circle (a phone, or zoomed out) shrinks the dots with it, down to 55%, so a
 * crowded field doesn't turn into one black mass.
 */
export function dotScale(circleRadiusPx: number) {
  return Math.min(1, Math.max(0.55, circleRadiusPx / 300));
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

/**
 * A star's colour as the eye sees it at night: a tint, not a hue. Mixing the
 * real colour (an `rgb(r,g,b)` string) halfway to white keeps blue stars
 * bluish and red ones warm, and leaves full orange to your star alone.
 */
export function starTint(rgb: string, toWhite = 0.5): string {
  const [r, g, b] = (rgb.match(/\d+/g) ?? ['255', '255', '255']).map(Number);
  const mix = (c: number) => Math.round(c + (255 - c) * toWhite);
  return `rgb(${mix(r)},${mix(g)},${mix(b)})`;
}
