/**
 * How stars are drawn on the map, the way a printed atlas does it: ink dots
 * in a few size classes by brightness, so a size means something and the
 * readout can show a key for it. Your star is the only coloured one.
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
