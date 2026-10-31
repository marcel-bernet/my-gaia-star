/**
 * The contract between this site and its own catalogue server, for when the
 * public services (VizieR, GAVO, SIMBAD) are replaced by a database we host.
 * Nothing calls a server until VITE_API_BASE is set; see docs/BACKEND.md.
 *
 * Pure types and checks, no fetching, so a server written in TypeScript can
 * import this file and both sides agree by construction.
 *
 * The rules that keep it safe:
 *  - The browser never sends a query. It names an operation and a few typed
 *    parameters; the server owns the SQL, the cone sizes and the row limits.
 *  - Every answer is untrusted until it passes the checks below: a broken or
 *    compromised server must not be able to put anything odd on screen.
 *  - Requests carry only what the answer needs: never the visitor's place,
 *    time, language or any identifier.
 */
import type { Depth, Star } from '../sky/gaia';
import type { Literature } from '../sky/simbad';

export const API_VERSION = 'v1';

/** Depths the server answers; 'naked-eye' is always read from the bundled file. */
export type ServerDepth = Exclude<Depth, 'naked-eye'>;
const SERVER_DEPTHS: readonly ServerDepth[] = ['bright', 'faint', 'all'];

/** The most stars a cone may return (the public services are asked for the same). */
export const MAX_STARS = 400;

/** Answers larger than this are refused unread (a full cone is ~60 kB of JSON). */
export const MAX_RESPONSE_BYTES = 2_000_000;

/** A Gaia source_id: a decimal string, never a JS number (19 digits overflow). */
export const SOURCE_ID = /^\d{1,19}$/;

// ---- Requests ----------------------------------------------------------------

/**
 * POST /v1/cone — the stars around the zenith, nearest first.
 *
 * POST, not GET: the zenith *is* the visitor's position (declination is their
 * latitude; right ascension and the request time give their longitude). A body
 * stays out of URL access logs, proxy logs and caches, where a query string
 * would not.
 */
export interface ConeRequest {
  ra: number;
  dec: number;
  depth: ServerDepth;
}

/** Checks and normalises a cone request; throws on anything out of range. */
export function coneRequest(ra: number, dec: number, depth: Depth): ConeRequest {
  if (!Number.isFinite(ra) || !Number.isFinite(dec) || dec < -90 || dec > 90) throw new RangeError('cone: bad position');
  if (!(SERVER_DEPTHS as readonly string[]).includes(depth)) throw new RangeError(`cone: depth ${depth} is not served`);
  // 1e-6° is 3.6 mas: as precise as the public queries, and no more.
  const round = (x: number) => Math.round(x * 1e6) / 1e6;
  return { ra: round(((ra % 360) + 360) % 360), dec: round(dec), depth: depth as ServerDepth };
}

/** The GET paths; ids are checked against SOURCE_ID before they are built. */
export const paths = {
  cone: () => `/${API_VERSION}/cone`,
  /** One star → { star: Star | null } */
  star: (id: string) => `/${API_VERSION}/stars/${id}`,
  /** Literature check → Literature */
  literature: (id: string) => `/${API_VERSION}/literature/${id}`,
  /** DR4 epoch astrometry → BINARY2 VOTable, or 404. Same shape as proxy/worker.js. */
  epochAstrometry: (id: string) => `/${API_VERSION}/epoch-astrometry/${id}`,
};

// ---- Responses -----------------------------------------------------------------

export class BadResponse extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function finite(v: unknown, field: string, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max)
    throw new BadResponse(`${field}: not a number in range`);
  return v;
}

function finiteOrNull(v: unknown, field: string, min?: number, max?: number): number | null {
  return v === null || v === undefined ? null : finite(v, field, min, max);
}

/** Plain text, bounded, with control characters removed. */
function text(v: unknown, field: string, maxLength: number): string {
  if (typeof v !== 'string' || v.length > maxLength) throw new BadResponse(`${field}: not a short string`);
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
}

export function parseStar(v: unknown): Star {
  if (!isObj(v)) throw new BadResponse('star: not an object');
  if (typeof v.id !== 'string' || !SOURCE_ID.test(v.id)) throw new BadResponse('star.id: not a Gaia source_id string');
  return {
    id: v.id,
    ra: finite(v.ra, 'ra', 0, 360),
    dec: finite(v.dec, 'dec', -90, 90),
    g: finite(v.g, 'g', -2, 25),
    bpRp: finiteOrNull(v.bpRp, 'bpRp', -10, 15),
    plx: finiteOrNull(v.plx, 'plx', -1e4, 1e4),
    plxErr: finiteOrNull(v.plxErr, 'plxErr', 0, 1e4),
    pmRa: finiteOrNull(v.pmRa, 'pmRa', -1e5, 1e5),
    pmDec: finiteOrNull(v.pmDec, 'pmDec', -1e5, 1e5),
    rv: finiteOrNull(v.rv, 'rv', -1e4, 1e4),
    teff: finiteOrNull(v.teff, 'teff', 0, 1e6),
  };
}

/** { stars: Star[] }, at most MAX_STARS. */
export function parseCone(v: unknown): Star[] {
  if (!isObj(v) || !Array.isArray(v.stars)) throw new BadResponse('cone: no stars array');
  if (v.stars.length > MAX_STARS) throw new BadResponse('cone: too many stars');
  return v.stars.map(parseStar);
}

/** { star: Star | null } */
export function parseStarById(v: unknown, id: string): Star | null {
  if (!isObj(v) || !('star' in v)) throw new BadResponse('star: no star field');
  if (v.star === null) return null;
  const star = parseStar(v.star);
  if (star.id !== id) throw new BadResponse('star: answered for another id');
  return star;
}

/** { known: false } | { known: true, name, papers, type } */
export function parseLiteratureResponse(v: unknown): Literature {
  if (!isObj(v) || typeof v.known !== 'boolean') throw new BadResponse('literature: no known flag');
  if (!v.known) return { known: false };
  return {
    known: true,
    name: text(v.name, 'name', 200),
    papers: Math.round(finite(v.papers, 'papers', 0, 1e6)),
    type: v.type === null || v.type === undefined ? null : text(v.type, 'type', 40) || null,
  };
}
