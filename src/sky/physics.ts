/** What we can say about a star from its Gaia numbers. */
import type { Star } from './gaia';

const DEG = Math.PI / 180;
export const LY_PER_PC = 3.26156;

/** Effective temperature (K): Gaia's own GSP-Phot value, else from BP−RP colour. */
export function temperature(star: Pick<Star, 'teff' | 'bpRp'>): number | null {
  if (star.teff) return star.teff;
  if (star.bpRp === null) return null;
  const c = star.bpRp;
  return 4600 * (1 / (0.92 * c + 1.7) + 1 / (0.92 * c + 0.62));
}

/** Approximate blackbody colour for a temperature, as an [r, g, b] in 0–255. */
export function temperatureToRgb(tempK: number): [number, number, number] {
  const t = Math.max(1000, Math.min(40000, tempK)) / 100;
  const clamp = (v: number) => Math.round(Math.max(0, Math.min(255, v)));
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  return [clamp(r), clamp(g), clamp(b)];
}

export function starColor(star: Pick<Star, 'teff' | 'bpRp'>): string {
  const t = temperature(star);
  if (t === null) return 'rgb(235,235,245)';
  const [r, g, b] = temperatureToRgb(t);
  return `rgb(${r},${g},${b})`;
}

type WithParallax = Pick<Star, 'plx'> & { plxErr?: number | null };

/**
 * Whether 1/parallax is a usable distance: positive and measured to better
 * than 20%. Faint, far stars often fail this — their parallax is mostly noise.
 */
export function hasDistance(star: WithParallax): boolean {
  if (star.plx === null || star.plx <= 0) return false;
  return star.plxErr == null || star.plx / star.plxErr >= 5;
}

/** Distance in parsecs, only when the parallax is meaningful. */
export function distancePc(star: WithParallax): number | null {
  return hasDistance(star) ? 1000 / star.plx! : null;
}

export function distanceLy(star: WithParallax): number | null {
  const pc = distancePc(star);
  return pc === null ? null : pc * LY_PER_PC;
}

/** Calendar year in which the light we see from it set off, given when we look. */
export function lightDepartureYear(star: WithParallax, seenAt: Date): number | null {
  const ly = distanceLy(star);
  if (ly === null) return null;
  return Math.round(seenAt.getUTCFullYear() + seenAt.getUTCMonth() / 12 - ly);
}

/** Absolute G magnitude. */
export function absoluteMag(star: WithParallax & Pick<Star, 'g'>): number | null {
  if (!hasDistance(star)) return null;
  return star.g + 5 * Math.log10(star.plx!) - 10;
}

/** Luminosity relative to the Sun, from absolute G (M_G,sun ≈ 4.67). */
export function luminositySun(star: WithParallax & Pick<Star, 'g'>): number | null {
  const m = absoluteMag(star);
  return m === null ? null : Math.pow(10, (4.67 - m) / 2.5);
}

/** Total proper motion, mas/yr. */
export function properMotion(star: Pick<Star, 'pmRa' | 'pmDec'>): number | null {
  return star.pmRa === null || star.pmDec === null ? null : Math.hypot(star.pmRa, star.pmDec);
}

/**
 * Coarse spectral class (e.g. "G2") from temperature. Giants are cooler than
 * dwarfs of the same type (a G9.5 III star is ~4 900 K), so they get their own scale.
 */
export function spectralClass(star: Pick<Star, 'teff' | 'bpRp'>, giant = false): string | null {
  const t = temperature(star);
  if (t === null) return null;
  // Lower edge of each class, hottest first, with the subclass span.
  const classes: [string, number, number][] = [
    ['O', 30000, 50000],
    ['B', 10000, 30000],
    ['A', 7500, 10000],
    ['F', 6000, 7500],
    giant ? ['G', 4900, 6000] : ['G', 5200, 6000],
    giant ? ['K', 3850, 4900] : ['K', 3700, 5200],
    giant ? ['M', 2400, 3850] : ['M', 2400, 3700],
  ];
  for (const [name, lo, hi] of classes) {
    if (t >= lo) {
      const sub = Math.min(9, Math.max(0, Math.floor(((hi - Math.min(t, hi)) / (hi - lo)) * 10)));
      return `${name}${sub}`;
    }
  }
  return 'M9';
}

/** ICRS → galactic (l, b) in degrees. */
export function toGalactic(raDeg: number, decDeg: number): { l: number; b: number } {
  // ICRS→Galactic rotation (Hipparcos definition).
  const M = [
    [-0.0548755604162154, -0.873437090234885, -0.4838350155487132],
    [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
    [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669],
  ];
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  const v = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const [x, y, z] = M.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  return { l: ((Math.atan2(y, x) / DEG) + 360) % 360, b: Math.asin(z) / DEG };
}

export const SUN_GALACTOCENTRIC_KPC = 8.2;

/**
 * Face-on position in the Galaxy, kpc, as seen from the north Galactic pole:
 * Galactic Centre at the origin, Sun at (0, −8.2), so l = 90° (the direction
 * the Sun orbits in) points to −x and the Galaxy turns clockwise.
 */
export function galacticPlanePosition(star: WithParallax & Pick<Star, 'ra' | 'dec'>): { x: number; y: number } | null {
  const pc = distancePc(star);
  if (pc === null) return null;
  const { l, b } = toGalactic(star.ra, star.dec);
  const d = (pc / 1000) * Math.cos(b * DEG);
  return { x: -d * Math.sin(l * DEG), y: -SUN_GALACTOCENTRIC_KPC + d * Math.cos(l * DEG) };
}

/**
 * Johnson V magnitude — what naked-eye limits are quoted in — from Gaia G and
 * BP−RP (Riello et al. 2021, valid for −0.5 < BP−RP < 2.75; clamped outside).
 * Red stars look brighter to Gaia than to the eye, so this matters for them.
 */
export function vMagnitude(star: Pick<Star, 'g' | 'bpRp'>): number {
  const c = Math.max(-0.5, Math.min(2.75, star.bpRp ?? 0.8));
  return star.g - (-0.02704 + 0.01424 * c - 0.2156 * c * c + 0.01426 * c * c * c);
}

export type Visibility = 'city' | 'suburbs' | 'rural' | 'dark' | 'binoculars' | 'telescope' | 'large-telescope';

/** What it takes to see the star yourself, by its V magnitude. */
export function visibility(star: Pick<Star, 'g' | 'bpRp'>): Visibility {
  const v = vMagnitude(star);
  if (v < 2.5) return 'city';
  if (v < 4) return 'suburbs';
  if (v < 5.5) return 'rural';
  if (v < 6.5) return 'dark';
  if (v < 10) return 'binoculars';
  if (v < 14) return 'telescope';
  return 'large-telescope';
}

export const nakedEye = (v: Visibility) => v === 'city' || v === 'suburbs' || v === 'rural' || v === 'dark';

/** The Sun sits ~21 pc above the Galactic mid-plane (Bennett & Bovy 2019). */
export const SUN_HEIGHT_KPC = 0.0208;

/** Height above (+) or below (−) the Galaxy's mid-plane, kpc. */
export function galacticHeightKpc(star: WithParallax & Pick<Star, 'ra' | 'dec'>): number | null {
  const pc = distancePc(star);
  if (pc === null) return null;
  const { b } = toGalactic(star.ra, star.dec);
  return (pc / 1000) * Math.sin(b * DEG) + SUN_HEIGHT_KPC;
}
