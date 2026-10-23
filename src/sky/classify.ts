/**
 * What kind of star is it? A coarse reading of where it sits on the
 * colour–magnitude (HR) diagram relative to the main sequence.
 */
import type { Star } from './gaia';
import { absoluteMag, luminositySun, temperature } from './physics';

export type Kind =
  | 'white-dwarf'
  | 'red-dwarf'
  | 'orange-dwarf'
  | 'yellow-dwarf'
  | 'yellow-white'
  | 'white-ms'
  | 'blue-ms'
  | 'subgiant'
  | 'giant'
  | 'red-giant'
  | 'blue-giant'
  | 'supergiant'
  // Colour only: Gaia couldn't pin the distance, so dwarf vs giant is unknown.
  | 'red-star'
  | 'orange-star'
  | 'yellow-star'
  | 'white-star'
  | 'blue-star';

export interface Classification {
  kind: Kind;
  /** Radius in solar radii, when luminosity and temperature are known. */
  radiusSun: number | null;
  /** False when based on colour alone. */
  sure: boolean;
}

/**
 * Main-sequence ridge: absolute G magnitude by BP−RP colour, from
 * Pecaut & Mamajek's dwarf table (B5V … M7V), Gaia bands.
 */
const RIDGE: [number, number][] = [
  [-0.3, -2.4],
  [-0.13, -1.1],
  [0.0, 1.1],
  [0.38, 2.6],
  [0.73, 4.4],
  [0.82, 4.67],
  [0.98, 5.7],
  [1.4, 7.0],
  [1.84, 8.2],
  [2.5, 10.3],
  [3.1, 12.3],
  [3.8, 14.5],
];

export function mainSequenceMag(bpRp: number): number {
  if (bpRp <= RIDGE[0][0]) return RIDGE[0][1];
  for (let i = 1; i < RIDGE.length; i++) {
    const [x1, y1] = RIDGE[i];
    if (bpRp <= x1) {
      const [x0, y0] = RIDGE[i - 1];
      return y0 + ((bpRp - x0) / (x1 - x0)) * (y1 - y0);
    }
  }
  const [x0, y0] = RIDGE[RIDGE.length - 2];
  const [x1, y1] = RIDGE[RIDGE.length - 1];
  return y1 + ((bpRp - x1) / (x1 - x0)) * (y1 - y0);
}

function byColour(c: number): Kind {
  if (c < -0.1) return 'blue-star';
  if (c < 0.45) return 'white-star';
  if (c < 1.0) return 'yellow-star';
  if (c < 1.75) return 'orange-star';
  return 'red-star';
}

function dwarfByColour(c: number): Kind {
  if (c < -0.1) return 'blue-ms';
  if (c < 0.4) return 'white-ms';
  if (c < 0.72) return 'yellow-white';
  if (c < 1.0) return 'yellow-dwarf';
  if (c < 1.75) return 'orange-dwarf';
  return 'red-dwarf';
}

export function classify(star: Pick<Star, 'bpRp' | 'plx' | 'plxErr' | 'g' | 'teff'>): Classification | null {
  const c = star.bpRp;
  if (c === null) return null;
  const M = absoluteMag(star);
  if (M === null) return { kind: byColour(c), radiusSun: null, sure: false };

  const dM = M - mainSequenceMag(c); // > 0: fainter than the main sequence
  let kind: Kind;
  if (dM > 3.5) kind = 'white-dwarf';
  else if (M < -3.5) kind = 'supergiant';
  else if (dM < -1.8) {
    if (c < 0.3) kind = 'blue-giant';
    else if (c < 1.1 && dM > -3) kind = 'subgiant';
    else kind = c >= 0.95 ? 'red-giant' : 'giant';
  } else if (dM < -0.9 && c >= 0.4 && c < 1.1) kind = 'subgiant';
  else kind = dwarfByColour(c);

  const L = luminositySun(star);
  const T = temperature(star);
  const radiusSun = L !== null && T !== null ? Math.sqrt(L) * Math.pow(5772 / T, 2) : null;
  return { kind, radiusSun, sure: true };
}
