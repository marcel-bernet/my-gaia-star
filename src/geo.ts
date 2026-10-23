/**
 * Place names via OpenStreetMap Nominatim. Their usage policy asks for at most
 * one request per second and no search-as-you-type, so we only search on submit.
 */
const BASE = 'https://nominatim.openstreetmap.org';

export interface Place {
  lat: number;
  lon: number;
  name: string;
}

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

export async function searchPlace(query: string, lang: string): Promise<Place | null> {
  const params = new URLSearchParams({ q: query, format: 'jsonv2', limit: '1', addressdetails: '1', 'accept-language': lang });
  const res = await fetch(`${BASE}/search?${params}`);
  if (!res.ok) return null;
  const [r] = (await res.json()) as NominatimResult[];
  return r ? { lat: Number(r.lat), lon: Number(r.lon), name: shortName(r) } : null;
}

export async function placeName(lat: number, lon: number, lang: string): Promise<string | null> {
  const params = new URLSearchParams({
    lat: lat.toFixed(5),
    lon: lon.toFixed(5),
    format: 'jsonv2',
    zoom: '12',
    addressdetails: '1',
    'accept-language': lang,
  });
  try {
    const res = await fetch(`${BASE}/reverse?${params}`);
    if (!res.ok) return null;
    const r = (await res.json()) as NominatimResult & { error?: string };
    return r.error ? null : shortName(r);
  } catch {
    return null;
  }
}
