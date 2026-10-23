// Hits the real services. Run with: LIVE=1 npx vitest run gaia.live
// Note this can't catch CORS problems — check those in a browser.
import { describe, expect, it } from 'vitest';
import { _services, starsAround, type Depth } from './gaia';

declare const process: { env: Record<string, string | undefined> };

describe.runIf(process.env.LIVE)('Gaia services (live)', () => {
  for (const depth of ['bright', 'faint', 'all'] as Depth[]) {
    for (const [ra, dec] of [
      [266.4, -29.0], // Galactic Centre: the densest sky
      [146.9, 41.4],
    ]) {
      it(`${depth} at ${ra},${dec}`, { timeout: 60_000 }, async () => {
        const t = Date.now();
        const stars = await starsAround(ra, dec, depth);
        console.log(depth, ra, dec, stars.length, 'stars in', Date.now() - t, 'ms');
        expect(stars.length).toBeGreaterThan(10);
        expect(stars[0].id).toMatch(/^\d{15,19}$/);
      });
    }
  }

  it('GAVO fallback returns the same nearest star', { timeout: 60_000 }, async () => {
    const cone = { radiusDeg: 0.05, maxMag: null, limit: 20 };
    const [v, g] = await Promise.all([_services.vizierCone(146.9, 41.4, cone), _services.gavoCone(146.9, 41.4, cone)]);
    expect(g[0].id).toBe(v[0].id);
    expect(g[0].plx).toBeCloseTo(v[0].plx!, 3);
  });
});
