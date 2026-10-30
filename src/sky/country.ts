/**
 * Country outlines (Natural Earth 1:50m, via world-atlas), fetched only when
 * a finder chart needs to draw the ground under the stars.
 */
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import countriesUrl from 'world-atlas/countries-50m.json?url';
import { once } from '../lib/cache';

/** [lon, lat] rings; holes are drawn even-odd. */
export interface Country {
  name: string;
  rings: [number, number][][];
}

export const loadCountries = once(async (): Promise<Country[]> => {
  const r = await fetch(countriesUrl);
  if (!r.ok) throw new Error(`countries: HTTP ${r.status}`);
  const topo = (await r.json()) as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  return feature(topo, topo.objects.countries).features.flatMap(f => {
    const g = f.geometry;
    if (!g) return [];
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
    return [{ name: f.properties?.name ?? '', rings: polys.flat() as [number, number][][] }];
  });
});

function inRing(lon: number, lat: number, ring: [number, number][]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** The country a point lies in, if any (not at sea). */
export function countryAt(countries: Country[], lat: number, lon: number): Country | null {
  return countries.find(c => c.rings.reduce((n, r) => n + (inRing(lon, lat, r) ? 1 : 0), 0) % 2 === 1) ?? null;
}
