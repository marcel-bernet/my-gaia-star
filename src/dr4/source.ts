/**
 * Where a star's DR4 epoch data comes from.
 *
 * Until DR4 is public (2 December 2026) every star gets the closest match from
 * ESA's June 2026 pre-release, clearly labelled as a stand-in. After that, if
 * the site is built with VITE_DR4_PROXY, each star's own data is fetched
 * through that proxy — ESA's archive sends no CORS headers, so a browser
 * cannot call it directly. See docs/DATA_ACCESS.md and proxy/.
 */
import type { Star } from '../sky/gaia';
import { fromPreview, fromVotable, type EpochAstrometry, type PreviewSource } from './epoch';

/** 2 December 2026, about 12:00 CET. */
export const DR4_RELEASE = new Date('2026-12-02T11:00:00Z');
const PROXY: string | undefined = import.meta.env.VITE_DR4_PROXY;

export const dr4IsOut = (now = new Date()) => now >= DR4_RELEASE;
export const daysToDr4 = (now = new Date()) => Math.max(0, Math.ceil((DR4_RELEASE.getTime() - now.getTime()) / 86400e3));

export interface PreviewEntry {
  meta: Omit<PreviewSource, 'transits'> & { g: number };
  data: EpochAstrometry;
}

let preview: Promise<PreviewEntry[]> | null = null;
export function loadPreview(): Promise<PreviewEntry[]> {
  preview ??= fetch(`${import.meta.env.BASE_URL}dr4-preview.json`)
    .then(r => {
      if (!r.ok) throw new Error(`dr4-preview.json: HTTP ${r.status}`);
      return r.json() as Promise<{ sources: PreviewSource[] }>;
    })
    .then(({ sources }) =>
      sources.map(({ transits, ...meta }) => {
        const gs = transits.map(t => t.g).filter((g): g is number => g !== null).sort((a, b) => a - b);
        return { meta: { ...meta, g: gs[gs.length >> 1] }, data: fromPreview({ ...meta, transits }) };
      }),
    )
    .catch(e => {
      preview = null;
      throw e;
    });
  return preview;
}

/** The pre-release star most like this one: similar brightness, and a quasar only for a quasar-like star. */
export function closestPreview(entries: PreviewEntry[], star: Pick<Star, 'g' | 'plx'>): PreviewEntry {
  const pool = entries.filter(e => e.meta.group === 'parallax' || e.meta.group === 'magnitude');
  return pool.reduce((best, e) => (Math.abs(e.meta.g - star.g) < Math.abs(best.meta.g - star.g) ? e : best));
}

export type Dr4Result =
  | { kind: 'live'; data: EpochAstrometry }
  | { kind: 'preview'; reason: 'not-yet' | 'no-proxy' | 'not-found' | 'error' };

const live = new Map<string, Promise<EpochAstrometry | null>>();

/**
 * This star's own DR4 epoch astrometry, when it can be had. DR4 keeps most
 * DR3 source_ids; for the rest, the proxy is expected to resolve them through
 * DR4's DR3 cross-match table and answer 404 if there is no match.
 */
export async function epochAstrometryFor(star: Pick<Star, 'id'>, signal?: AbortSignal): Promise<Dr4Result> {
  if (!dr4IsOut()) return { kind: 'preview', reason: 'not-yet' };
  if (!PROXY) return { kind: 'preview', reason: 'no-proxy' };
  let p = live.get(star.id);
  if (!p) {
    p = fetch(`${PROXY.replace(/\/$/, '')}/epoch-astrometry/${star.id}`, { signal }).then(async r => {
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`DR4 proxy: HTTP ${r.status}`);
      return fromVotable(await r.text())[0] ?? null;
    });
    live.set(star.id, p);
    p.catch(() => live.delete(star.id));
  }
  try {
    const data = await p;
    return data ? { kind: 'live', data } : { kind: 'preview', reason: 'not-found' };
  } catch (e) {
    if (signal?.aborted) throw e;
    console.warn(e);
    return { kind: 'preview', reason: 'error' };
  }
}
