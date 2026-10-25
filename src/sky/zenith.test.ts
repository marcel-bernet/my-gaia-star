import { describe, expect, it } from 'vitest';
import { groundToSky, skyFrame, starToLatLng, subStellarPoint } from './zenith';
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

describe('ground ↔ sky', () => {
  it('maps a star to the ground and back', () => {
    const f = skyFrame(41.38, 2.17, new Date('2025-07-28T10:29:00Z'));
    for (const [dRa, dDec] of [
      [0, 0],
      [3, -2],
      [-12, 8],
      [25, 15],
    ]) {
      const ra = f.zenith.ra + dRa;
      const dec = f.zenith.dec + dDec;
      const [lat, lon] = starToLatLng(f, ra, dec);
      expect(f.offset(ra, dec).sep).toBeCloseTo(sepOnGround(41.38, 2.17, lat, lon), 6);
      const back = groundToSky(f, lat, lon);
      expect(back.ra).toBeCloseTo((ra + 360) % 360, 5);
      expect(back.dec).toBeCloseTo(dec, 5);
    }
  });
});

function sepOnGround(lat1: number, lon1: number, lat2: number, lon2: number) {
  const r = Math.PI / 180;
  const c = Math.sin(lat1 * r) * Math.sin(lat2 * r) + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return Math.acos(c) / r;
}

describe('subStellarPoint', () => {
  it('puts the star at the zenith', () => {
    const when = new Date('2026-10-25T21:00:00Z');
    for (const [ra, dec] of [
      [101.287, -16.716],
      [279.23, 38.78],
      [10, 85],
      [200, -60],
    ]) {
      const p = subStellarPoint(ra, dec, when);
      const z = skyFrame(p.lat, p.lon, when).zenith;
      const sep = Math.hypot((z.ra - ra) * Math.cos((dec * Math.PI) / 180), z.dec - dec) * 3600;
      expect(sep).toBeLessThan(1);
    }
  });
});
