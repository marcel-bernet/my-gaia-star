/**
 * Has anyone written about this star? SIMBAD (CDS, Strasbourg) lists the
 * objects that appear in the astronomical literature, with how many papers
 * mention each. Most Gaia stars are not in it: no one has ever singled them out.
 *
 * One small TAP query per star looked at, straight from the browser (SIMBAD
 * and its CfA mirror send CORS headers). CDS asks for at most ~6 queries per second per IP;
 * each visitor has their own IP, and we debounce and cache, so a busy site
 * does not add up against one limit.
 */
import { apiEnabled, apiLiterature } from '../api/client';
import { SERVICES } from '../config';
import { abortable, oncePerKey } from '../lib/cache';
import { parseCsvLine } from '../lib/csv';

export type Literature = { known: false } | { known: true; name: string; papers: number; type: string | null };

export function parseLiterature(csv: string): Literature {
  const [, row] = csv.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!row) return { known: false };
  const [name, papers, type] = parseCsvLine(row);
  return { known: true, name: name.replace(/\s+/g, ' ').trim(), papers: Number(papers) || 0, type: type || null };
}

/** Looked up once per star; the signal only stops this caller waiting. */
export function literatureFor(gaiaDr3Id: string, signal?: AbortSignal): Promise<Literature> {
  if (!/^\d{1,20}$/.test(gaiaDr3Id)) return Promise.resolve({ known: false });
  return abortable(lookUp(gaiaDr3Id), signal);
}

const lookUp = oncePerKey(async (gaiaDr3Id: string) => {
  if (apiEnabled()) return apiLiterature(gaiaDr3Id);
  const adql =
    'SELECT b.main_id, b.nbref, b.otype FROM basic AS b JOIN ident AS i ON i.oidref = b.oid ' +
    `WHERE i.id = 'Gaia DR3 ${gaiaDr3Id}'`;
  const params = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: adql });
  // The answer takes well under a second; a server that hangs (CDS does, when
  // it is down) is given up on quickly so the mirror gets its turn.
  let lastError: unknown;
  for (const tap of SERVICES.simbadTap) {
    try {
      const r = await fetch(`${tap}?${params}`, { signal: AbortSignal.timeout(6_000) });
      if (!r.ok) throw new Error(`SIMBAD: HTTP ${r.status}`);
      return parseLiterature(await r.text());
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
});
