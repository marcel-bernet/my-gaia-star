import { describe, expect, it } from 'vitest';
import { absoluteMag, galacticHeightKpc, hasDistance, distanceLy, galacticPlanePosition, lightDepartureYear, spectralClass, toGalactic } from './physics';

describe('physics', () => {
  it('puts the Galactic Centre at l=0, b=0', () => {
    // Sgr A*
    const { l, b } = toGalactic(266.41683, -29.00781);
    expect(Math.min(l, 360 - l)).toBeLessThan(0.1);
    expect(Math.abs(b)).toBeLessThan(0.1);
  });

  it('turns parallax into distance and a departure year', () => {
    const star = { plx: 100, g: 5, ra: 0, dec: 0 };
    expect(distanceLy(star)).toBeCloseTo(32.6156, 3);
    expect(absoluteMag(star)).toBeCloseTo(5, 6);
    expect(lightDepartureYear(star, new Date('2026-01-01T00:00:00Z'))).toBe(1993);
  });

  it('ignores parallaxes that are mostly noise', () => {
    expect(hasDistance({ plx: 0.2, plxErr: 0.3 })).toBe(false);
    expect(hasDistance({ plx: 2, plxErr: 0.1 })).toBe(true);
    expect(distanceLy({ plx: 0.2, plxErr: 0.3 })).toBeNull();
  });

  it('classifies the Sun as G-type', () => {
    expect(spectralClass({ teff: 5772, bpRp: null })).toMatch(/^G[0-9]$/);
    expect(spectralClass({ teff: null, bpRp: 0.82 })).toMatch(/^G/);
  });

  it('places a star towards the Galactic Centre between the Sun and the centre', () => {
    const p = galacticPlanePosition({ ra: 266.41683, dec: -29.00781, plx: 0.25 })!; // 4 kpc
    expect(p.x).toBeCloseTo(0, 1);
    expect(p.y).toBeCloseTo(-4.2, 1);
  });

  it('puts a star towards the north Galactic pole above the plane', () => {
    // NGP: RA 192.86°, Dec +27.13°; 1 kpc away.
    expect(galacticHeightKpc({ ra: 192.85948, dec: 27.12825, plx: 1 })).toBeCloseTo(1.0208, 3);
    expect(galacticHeightKpc({ ra: 12.85948, dec: -27.12825, plx: 1 })).toBeCloseTo(-0.9792, 3);
  });
});
