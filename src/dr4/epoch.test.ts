import { describe, expect, it } from 'vitest';
import previewJson from '../../public/dr4-preview.json';
import votable from './fixtures/one-source.vot?raw';
import {
  calendarYear,
  fitFiveParameters,
  fromPreview,
  fromVotable,
  parallaxDisplacement,
  transitPoints,
  type PreviewSource,
} from './epoch';

const preview = previewJson as unknown as { sources: PreviewSource[] };
const byName = (id: string) => fromPreview(preview.sources.find(s => s.id === id)!);

describe('DR4 pre-release epoch astrometry', () => {
  // Parallaxes as listed on https://www.cosmos.esa.int/web/gaia/dr4-prerelease
  it.each([
    ['4181040337841125632', 1.0, 0.1], // HD 183633
    ['1663617687609809280', 10.1, 0.1], // LSPM J1324+6124
    ['20694084440761600', 4.9, 0.1],
    ['3937211745905473024', 25.6, 0.2], // HD 114762
    ['1457486023639239296', 13.6, 0.1], // Gaia-4
  ])('recovers the parallax of %s', (id, plx, tol) => {
    const fit = fitFiveParameters(byName(id))!;
    expect(Math.abs(fit.parallax - plx)).toBeLessThan(tol);
  });

  it('finds no parallax for a quasar', () => {
    const fit = fitFiveParameters(byName('2237987199365376'))!;
    expect(Math.abs(fit.parallax)).toBeLessThan(3 * fit.errors[2]);
    expect(Math.hypot(fit.pmRa, fit.pmDec)).toBeLessThan(1);
  });

  it('flags the unmodelled orbit of Gaia BH3', () => {
    expect(fitFiveParameters(byName('4318465066420528000'))!.uwe).toBeGreaterThan(5);
    expect(fitFiveParameters(byName('4181040337841125632'))!.uwe).toBeLessThan(2);
  });

  it('matches HD 114762’s DR3 proper motion (−582.9, −1.8 mas/yr)', () => {
    const fit = fitFiveParameters(byName('3937211745905473024'))!;
    expect(fit.pmRa).toBeCloseTo(-582.9, -1);
    expect(fit.pmDec).toBeCloseTo(-1.8, -1);
  });

  it('spans Gaia’s first 66 months', () => {
    const pts = transitPoints(byName('4181040337841125632'));
    expect(pts[0].year).toBeGreaterThan(2014.5);
    expect(pts.at(-1)!.year).toBeLessThan(2020.2);
  });

  it('agrees with Gaia’s own parallax factors', () => {
    // pf_AL = (east, north) displacement · scan direction (sin ψ, cos ψ).
    const s = byName('1663617687609809280');
    let worst = 0;
    for (const p of transitPoints(s)) {
      const d = parallaxDisplacement(s.ra0, s.dec0, p.year);
      const r = (p.psi * Math.PI) / 180;
      worst = Math.max(worst, Math.abs(d.e * Math.sin(r) + d.n * Math.cos(r) - p.pf));
    }
    expect(worst).toBeLessThan(0.03);
  });
});

describe('VOTable parser', () => {
  it('reads ESA’s binary VOTable exactly like the preview file', () => {
    const [fromVot] = fromVotable(votable);
    const fromJson = byName('2237987199365376');
    expect(fromVot.sourceId).toBe('2237987199365376');
    expect(fromVot.transits.length).toBe(fromJson.transits.length);
    const a = fromVot.transits[5].ccds[3];
    const b = fromJson.transits[5].ccds[3];
    expect(a.w).toBeCloseTo(b.w, 2);
    expect(a.psi).toBeCloseTo(b.psi, 3);
    expect(a.used).toBe(b.used);
    expect(calendarYear(a.t)).toBeCloseTo(calendarYear(b.t), 6);
    expect(fitFiveParameters(fromVot)!.parallax).toBeCloseTo(fitFiveParameters(fromJson)!.parallax, 2);
  });
});
