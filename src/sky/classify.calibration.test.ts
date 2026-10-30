/**
 * The classifier against real stars: Gaia DR3 photometry and parallax for
 * 40 stars whose spectral types are known (types from SIMBAD). Regenerate
 * the fixture with scripts/calibration_stars.py.
 */
import { describe, expect, it } from 'vitest';
import stars from './calibration.fixtures.json';
import { classify, type Kind } from './classify';
import { vMagnitude } from './physics';

type Fixture = (typeof stars)[number];

/** What a spectral type like "K1.5Ib" or "G2Va" should become. */
function expected(sp: string): Kind[] | null {
  if (/^D[ABCOQZ]/.test(sp)) return ['white-dwarf'];
  const m = sp.match(/^d?([OBAFGKM])\d*(?:\.\d+)?[+-]?\s*(0|Ia|Iab|Ib|II|III|IV|V)?/);
  if (!m || !m[2]) return null;
  const [, cls, lum] = m;
  if (lum === '0' || (lum.startsWith('I') && lum !== 'II' && lum !== 'III' && lum !== 'IV')) return ['supergiant'];
  if (lum === 'II' || lum === 'III') return ['giant', 'red-giant', 'blue-giant'];
  // Dwarfs: allow the neighbouring colour bin, since types and colours overlap at the edges.
  const order: Kind[] = ['blue-ms', 'white-ms', 'yellow-white', 'yellow-dwarf', 'orange-dwarf', 'red-dwarf'];
  const i = { O: 0, B: 0, A: 1, F: 2, G: 3, K: 4, M: 5 }[cls]!;
  const dwarfs = order.slice(Math.max(0, i - 1), i + 2);
  // Subgiants (IV) are barely off the main sequence, so either reading is fair.
  return lum === 'IV' ? ['subgiant', ...dwarfs] : dwarfs;
}

const measurable = (s: Fixture) => s.plx !== null && s.plxErr !== null && s.plx / s.plxErr >= 5 && s.bpRp !== null;

describe('classifier calibration', () => {
  for (const s of stars.filter(measurable)) {
    const want = expected(s.sp);
    if (!want) continue;
    it(`${s.name} (${s.sp})`, () => {
      expect(want).toContain(classify(s)!.kind);
    });
  }

  it('estimates V from Gaia G and colour to within 0.25 mag', () => {
    for (const s of stars) {
      // Supergiants and very red stars are outside the transformation's validity.
      if (s.V === null || s.bpRp === null || s.bpRp > 2.75 || /I[ab]|Ia/.test(s.sp)) continue;
      expect(Math.abs(vMagnitude(s)! - s.V), s.name).toBeLessThan(0.25);
    }
  });
});
