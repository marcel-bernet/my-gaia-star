/**
 * Gaia DR3 straight from the browser.
 *
 * ESA's own archive sends no CORS headers, so browsers can't use it. What
 * works, tested in a real browser (Node and curl ignore CORS, so they prove
 * nothing here):
 *  - CDS VizieR's ASU cone search (I/355/gaiadr3): fast for small cones,
 *    sorted by distance server-side. VizieR's *TAP* service is unusable — it
 *    sends Access-Control-Allow-Origin twice, which browsers reject.
 *  - GAVO's TAP service in Heidelberg (gaia.dr3lite): our fallback when
 *    VizieR is down.
 *  - Naked-eye stars ship with the site (public/naked-eye.json), because a
 *    20° cone is slow on every mirror and ~7 000 stars is a small file.
 *
 * Query time on both services grows with the number of stars of *any*
 * brightness in the cone, so the "bright" depth probes a small cone first and
 * only then asks for the radius it actually needs.
 */
import { SERVICES } from '../config';

export type Depth = 'naked-eye' | 'bright' | 'faint' | 'all';

export const DEPTHS: Depth[] = ['naked-eye', 'bright', 'faint', 'all'];

export interface Star {
  id: string;
  ra: number;
  dec: number;
  /** Gaia G magnitude. */
  g: number;
  bpRp: number | null;
  /** Parallax and its standard error, milliarcseconds. */
  plx: number | null;
  plxErr: number | null;
  pmRa: number | null;
  pmDec: number | null;
  /** Radial velocity, km/s. */
  rv: number | null;
  /** GSP-Phot effective temperature, K (not available from the fallback). */
  teff: number | null;
}

interface Cone {
  radiusDeg: number;
  maxMag: number | null;
  limit: number;
}

export const NAKED_EYE_RADIUS_DEG = 20;
const LIMIT = 400;
const FAINT: Cone = { radiusDeg: 0.3, maxMag: 19, limit: LIMIT };
const ALL: Cone = { radiusDeg: 400 / 3600, maxMag: null, limit: LIMIT };
const BRIGHT_PROBE: Cone = { radiusDeg: 0.25, maxMag: 13, limit: LIMIT };
const BRIGHT_MAX_RADIUS_DEG = 1.5;

const VIZIER_COLUMNS = ['Source', 'RA_ICRS', 'DE_ICRS', 'Gmag', 'BP-RP', 'Plx', 'e_Plx', 'pmRA', 'pmDE', 'RV', 'Teff'];
const TIMEOUT_MS = 30_000;

export class CatalogueUnavailable extends Error {}

function num(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

async function get(url: string, signal?: AbortSignal): Promise<Response> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, { signal: signal ? AbortSignal.any([signal, timeout]) : timeout }).catch(e => {
    if (signal?.aborted) throw e;
    throw new CatalogueUnavailable(String(e));
  });
  if (!res.ok) throw new CatalogueUnavailable(`HTTP ${res.status} from ${new URL(url).host}`);
  return res;
}

export function parseTsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter(l => l.trim() !== '' && !l.startsWith('#'));
  // Header, units, dashes, then data.
  if (lines.length < 3) return [];
  const names = lines[0].split('\t').map(s => s.trim());
  return lines.slice(3).map(l => {
    const cells = l.split('\t');
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? '']));
  });
}

/** TAP CSV with only numeric cells: a header row, no quoting needed. */
export function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
  if (lines.length < 1) return [];
  const names = lines[0].split(',').map(s => s.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(l => {
    const cells = l.split(',');
    return Object.fromEntries(names.map((n, i) => [n, cells[i] ?? '']));
  });
}

async function vizierCone(ra: number, dec: number, cone: Cone, signal?: AbortSignal): Promise<Star[]> {
  const sign = dec >= 0 ? '+' : '';
  const params = new URLSearchParams({
    '-source': 'I/355/gaiadr3',
    // Decimal points matter: "180 +40" is not parsed as degrees.
    '-c': `${ra.toFixed(6)} ${sign}${dec.toFixed(6)}`,
    '-c.rs': (cone.radiusDeg * 3600).toFixed(1),
    '-out': VIZIER_COLUMNS.join(','),
    '-sort': '_r',
    '-out.max': String(cone.limit),
  });
  if (cone.maxMag !== null) params.set('Gmag', `<${cone.maxMag}`);
  const res = await get(`${SERVICES.vizier}?${params}`, signal);
  return parseTsv(await res.text()).flatMap(toStar);
}

function toStar(r: Record<string, string>): Star[] {
  const ra = num(r.RA_ICRS);
  const dec = num(r.DE_ICRS);
  const g = num(r.Gmag);
  if (ra === null || dec === null || g === null) return [];
  return [
    {
      id: r.Source.trim(),
      ra,
      dec,
      g,
      bpRp: num(r['BP-RP']),
      plx: num(r.Plx),
      plxErr: num(r.e_Plx),
      pmRa: num(r.pmRA),
      pmDec: num(r.pmDE),
      rv: num(r.RV),
      teff: num(r.Teff),
    },
  ];
}

async function gavoCone(ra: number, dec: number, cone: Cone, signal?: AbortSignal): Promise<Star[]> {
  const where = [`1=CONTAINS(POINT('ICRS',ra,dec),CIRCLE('ICRS',${ra},${dec},${cone.radiusDeg}))`];
  if (cone.maxMag !== null) where.push(`phot_g_mean_mag<${cone.maxMag}`);
  const adql =
    `SELECT TOP ${cone.limit} source_id,ra,dec,phot_g_mean_mag,phot_bp_mean_mag-phot_rp_mean_mag AS bp_rp,` +
    `parallax,parallax_error,pmra,pmdec,radial_velocity,` +
    `DISTANCE(POINT('ICRS',ra,dec),POINT('ICRS',${ra},${dec})) AS d ` +
    `FROM gaia.dr3lite WHERE ${where.join(' AND ')} ORDER BY d`;
  // CSV rather than JSON: JSON numbers would round the 19-digit Gaia IDs.
  const params = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: adql });
  const res = await get(`${SERVICES.gavoTap}?${params}`, signal);
  return parseCsv(await res.text()).flatMap(fromGavo);
}

function fromGavo(r: Record<string, string>): Star[] {
  const ra = num(r.ra);
  const dec = num(r.dec);
  const g = num(r.phot_g_mean_mag);
  if (ra === null || dec === null || g === null) return [];
  return [
    {
      id: r.source_id.trim(),
      ra,
      dec,
      g,
      bpRp: num(r.bp_rp),
      plx: num(r.parallax),
      plxErr: num(r.parallax_error),
      pmRa: num(r.pmra),
      pmDec: num(r.pmdec),
      rv: num(r.radial_velocity),
      teff: null,
    },
  ];
}

/** VizieR first; GAVO if VizieR is down. */
async function cone(ra: number, dec: number, c: Cone, signal?: AbortSignal): Promise<Star[]> {
  try {
    return await vizierCone(ra, dec, c, signal);
  } catch (e) {
    if (!(e instanceof CatalogueUnavailable)) throw e;
    console.warn('VizieR unavailable, trying GAVO:', e.message);
    return gavoCone(ra, dec, c, signal);
  }
}

/** The radius that should hold `want` stars, given `got` in a probe of radius `r`. */
export function radiusFor(r: number, got: number, want: number, max: number): number {
  if (got >= want) return r;
  // Star counts grow with area; aim 15% wide, since density isn't uniform.
  return Math.min(max, r * Math.sqrt(want / Math.max(got, 1)) * 1.15);
}

let nakedEye: Promise<Star[]> | null = null;
function loadNakedEye(): Promise<Star[]> {
  nakedEye ??= fetch(`${import.meta.env.BASE_URL}naked-eye.json`)
    .then(r => {
      if (!r.ok) throw new CatalogueUnavailable(`naked-eye.json: HTTP ${r.status}`);
      return r.json() as Promise<{ columns: string[]; rows: (string | number | null)[][] }>;
    })
    .then(({ columns, rows }) =>
      rows.map(row => {
        const o = Object.fromEntries(columns.map((c, i) => [c, row[i]]));
        return { ...o, id: String(o.id) } as unknown as Star;
      }),
    )
    .catch(e => {
      nakedEye = null;
      throw e;
    });
  return nakedEye;
}

export function sepDeg(ra1: number, dec1: number, ra2: number, dec2: number): number {
  const r = Math.PI / 180;
  const s = Math.sin(dec1 * r) * Math.sin(dec2 * r) + Math.cos(dec1 * r) * Math.cos(dec2 * r) * Math.cos((ra1 - ra2) * r);
  return Math.acos(Math.max(-1, Math.min(1, s))) / r;
}

/** Stars around an ICRS position, nearest first. */
export async function starsAround(ra: number, dec: number, depth: Depth, signal?: AbortSignal): Promise<Star[]> {
  let stars: Star[];
  if (depth === 'naked-eye') {
    stars = (await loadNakedEye()).filter(s => sepDeg(ra, dec, s.ra, s.dec) <= NAKED_EYE_RADIUS_DEG);
  } else if (depth === 'bright') {
    stars = await cone(ra, dec, BRIGHT_PROBE, signal);
    const r = radiusFor(BRIGHT_PROBE.radiusDeg, stars.length, LIMIT, BRIGHT_MAX_RADIUS_DEG);
    if (r > BRIGHT_PROBE.radiusDeg) stars = await cone(ra, dec, { ...BRIGHT_PROBE, radiusDeg: r }, signal);
  } else {
    stars = await cone(ra, dec, depth === 'faint' ? FAINT : ALL, signal);
  }
  return stars
    .map(s => ({ s, d: sepDeg(ra, dec, s.ra, s.dec) }))
    .sort((a, b) => a.d - b.d)
    .map(x => x.s);
}

/** One star by its Gaia DR3 source_id, or null if there is none. VizieR first; GAVO if VizieR is down. */
export async function starById(id: string, signal?: AbortSignal): Promise<Star | null> {
  if (!/^\d{1,19}$/.test(id)) return null;
  try {
    const params = new URLSearchParams({
      '-source': 'I/355/gaiadr3',
      Source: id,
      '-out': VIZIER_COLUMNS.join(','),
      '-out.max': '1',
    });
    const res = await get(`${SERVICES.vizier}?${params}`, signal);
    return (
      parseTsv(await res.text())
        .flatMap(r => toStar(r))
        .find(s => s.id === id) ?? null
    );
  } catch (e) {
    if (!(e instanceof CatalogueUnavailable)) throw e;
    const adql =
      'SELECT source_id,ra,dec,phot_g_mean_mag,phot_bp_mean_mag-phot_rp_mean_mag AS bp_rp,' +
      `parallax,parallax_error,pmra,pmdec,radial_velocity FROM gaia.dr3lite WHERE source_id=${id}`;
    const params = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: adql });
    const res = await get(`${SERVICES.gavoTap}?${params}`, signal);
    return parseCsv(await res.text()).flatMap(r => fromGavo(r))[0] ?? null;
  }
}

/** For tests: query one service directly. */
export const _services = { vizierCone, gavoCone };
