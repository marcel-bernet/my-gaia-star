import { describe, expect, it } from 'vitest';
import { skyFrame } from './zenith';
// Reference values produced with astropy using the original backend's maths.
import fixtures from './zenith.fixtures.json';

const ARCSEC = 1 / 3600;
// astropy applies IERS UT1−UTC (up to ±0.9 s ≈ ±14″ of Earth rotation);
// astronomy-engine treats UTC as UT1. Irrelevant next to the smallest
// search cone (400″), so we only demand agreement to that level.
const TOL = 8 * ARCSEC;

describe('skyFrame', () => {
  for (const c of fixtures) {
    it(`matches astropy at ${c.lat},${c.lon} ${c.iso}`, () => {
      const f = skyFrame(c.lat, c.lon, new Date(c.iso));
      const dRa = (f.zenith.ra - c.ra) * Math.cos((c.dec * Math.PI) / 180);
      expect(Math.abs(dRa)).toBeLessThan(TOL);
      expect(Math.abs(f.zenith.dec - c.dec)).toBeLessThan(TOL);
      for (const p of c.probes) {
        const o = f.offset(p.ra, p.dec);
        expect(Math.abs(o.east - p.east)).toBeLessThan(TOL);
        expect(Math.abs(o.north - p.north)).toBeLessThan(TOL);
      }
    });
  }
});
