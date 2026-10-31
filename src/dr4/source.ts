/**
 * Where a star's DR4 epoch data comes from.
 *
 * Until DR4 is public (2 December 2026) every star gets the closest match from
 * ESA's June 2026 pre-release, clearly labelled as a stand-in. After that, if
 * the site is built with VITE_DR4_PROXY, each star's own data is fetched
 * through that proxy — ESA's archive sends no CORS headers, so a browser
 * cannot call it directly. See docs/DATA_ACCESS.md and proxy/.
 */
import { DR4_PROXY as PROXY, DR4_RELEASE } from '../config';
import { abortable, fetchBundled, once, oncePerKey } from '../lib/cache';
import type { Star } from '../sky/gaia';
import { fromPreview, fromVotable, type EpochAstrometry, type PreviewSource } from './epoch';

export const dr4IsOut = (now = new Date()) => now >= DR4_RELEASE;
export const daysToDr4 = (now = new Date()) => Math.max(0, Math.ceil((DR4_RELEASE.getTime() - now.getTime()) / 86400e3));
/** True for the first 24 hours after the release. */
export const isReleaseDay = (now = new Date()) => dr4IsOut(now) && now.getTime() - DR4_RELEASE.getTime() < 86400e3;

export interface PreviewEntry {
  meta: Omit<PreviewSource, 'transits'> & { g: number };
  data: EpochAstrometry;
}

export const loadPreview = once(async (): Promise<PreviewEntry[]> => {
  const { sources } = await fetchBundled<{ sources: PreviewSource[] }>('dr4-preview.json');
  return sources.map(({ transits, ...meta }) => {
    const gs = transits
      .map(t => t.g)
      .filter((g): g is number => g !== null)
      .sort((a, b) => a - b);
    return { meta: { ...meta, g: gs[gs.length >> 1] }, data: fromPreview({ ...meta, transits }) };
  });
});

/** The pre-release star most like this one: similar brightness, and a quasar only for a quasar-like star. */
export function closestPreview(entries: PreviewEntry[], star: Pick<Star, 'g' | 'plx'>): PreviewEntry {
  const pool = entries.filter(e => e.meta.group === 'parallax' || e.meta.group === 'magnitude');
  return pool.reduce((best, e) => (Math.abs(e.meta.g - star.g) < Math.abs(best.meta.g - star.g) ? e : best));
}

export type Dr4Result =
  { kind: 'live'; data: EpochAstrometry } | { kind: 'preview'; reason: 'not-yet' | 'no-proxy' | 'not-found' | 'error' };

/**
 * This star's own DR4 epoch astrometry, when it can be had. DR4 keeps most
 * DR3 source_ids; for the rest, the proxy is expected to resolve them through
 * DR4's DR3 cross-match table and answer 404 if there is no match.
 */
export async function epochAstrometryFor(star: Pick<Star, 'id'>, signal?: AbortSignal): Promise<Dr4Result> {
  if (!dr4IsOut()) return { kind: 'preview', reason: 'not-yet' };
  if (!PROXY) return { kind: 'preview', reason: 'no-proxy' };
  try {
    const data = await abortable(fetchLive(star.id), signal);
    return data ? { kind: 'live', data } : { kind: 'preview', reason: 'not-found' };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(e);
    return { kind: 'preview', reason: 'error' };
  }
}

/** One star's epoch astrometry from the proxy, fetched once; null if DR4 has none. */
const fetchLive = oncePerKey(async (id: string) => {
  const r = await fetch(`${PROXY!.replace(/\/$/, '')}/epoch-astrometry/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`DR4 proxy: HTTP ${r.status}`);
  return fromVotable(await r.text())[0] ?? null;
});
