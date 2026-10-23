import { describe, expect, it } from 'vitest';
import skyJson from '../../public/sky-chart.json';
import { constellationOf, type SkyChartData } from './constellation';

const sky = skyJson as unknown as SkyChartData;

describe('constellations', () => {
  it('knows famous stars', () => {
    expect(constellationOf(279.2347, 38.7837)).toBe('Lyr'); // Vega
    expect(constellationOf(37.9546, 89.2641)).toBe('UMi'); // Polaris
    expect(constellationOf(101.2872, -16.7161)).toBe('CMa'); // Sirius
    expect(constellationOf(88.7929, 7.4071)).toBe('Ori'); // Betelgeuse
  });

  it('has chart data, in every language, for whatever the lookup returns', () => {
    for (let dec = -88; dec <= 88; dec += 4) {
      for (let ra = 0; ra < 360; ra += 4) {
        const c = sky.constellations[constellationOf(ra, dec)];
        expect(c, `${ra},${dec}`).toBeDefined();
        expect(c.lines.length + c.bounds.length).toBeGreaterThan(0);
        expect(c.names.en && c.names.es && c.names.ca).toBeTruthy();
      }
    }
  });
});
