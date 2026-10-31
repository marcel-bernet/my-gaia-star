/**
 * Place names via OpenStreetMap Nominatim. Their usage policy asks for at most
 * one request per second and no search-as-you-type, so we only search on submit.
 */
import { SERVICES } from './config';
import type { Place } from './types';

/** A place found by name: unlike a tapped point, it always has a name. */
export type FoundPlace = Place & { name: string };

interface NominatimResult {
  lat: string;
  lon: string;
  name?: string;
  display_name: string;
  address?: Record<string, string>;
}

function shortName(r: NominatimResult): string {
  const a = r.address ?? {};
  const local = a.city || a.town || a.village || a.hamlet || a.suburb || a.municipality || a.county || r.name;
  const region = a.country;
  if (local && region && local !== region) return `${local}, ${region}`;
  return local || region || r.display_name.split(',').slice(0, 2).join(',');
}

export async function searchPlace(query: string, lang: string): Promise<FoundPlace | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', addressdetails: '1', 'accept-language': lang });
  const res = await fetch(`${SERVICES.nominatim}/search?${params}`);
  if (!res.ok) return null;
  const [r] = (await res.json()) as NominatimResult[];
  return r ? { lat: Number(r.lat), lon: Number(r.lon), name: shortName(r) } : null;
}

// Reverse lookups are cached (≈100 m cells) so re-tapping or reloading a shared
// link doesn't ask Nominatim again: the 1 request/s limit is for the whole site.
const names = new Map<string, Promise<string | null>>();

export function placeName(lat: number, lon: number, lang: string): Promise<string | null> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)},${lang}`;
  try {
    const saved = sessionStorage.getItem(`place:${key}`);
    if (saved !== null) return Promise.resolve(saved || null);
  } catch {
    /* storage blocked */
  }
  let p = names.get(key);
  if (!p) {
    p = reverse(lat, lon, lang).then(name => {
      try {
        sessionStorage.setItem(`place:${key}`, name ?? '');
      } catch {
        /* storage blocked */
      }
      return name;
    });
    names.set(key, p);
  }
  return p;
}

async function reverse(lat: number, lon: number, lang: string): Promise<string | null> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    format: 'jsonv2',
    zoom: '12',
    addressdetails: '1',
    'accept-language': lang,
  });
  try {
    const res = await fetch(`${SERVICES.nominatim}/reverse?${params}`);
    if (!res.ok) return null;
    const r = (await res.json()) as NominatimResult & { error?: string };
    return r.error ? null : shortName(r);
  } catch {
    return null;
  }
}
