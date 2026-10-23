/**
 * Has anyone written about this star? SIMBAD (CDS, Strasbourg) lists the
 * objects that appear in the astronomical literature, with how many papers
 * mention each. Most Gaia stars are not in it: no one has ever singled them out.
 *
 * One small TAP query per star looked at, straight from the browser (SIMBAD
 * sends CORS headers). CDS asks for at most ~6 queries per second per IP;
 * each visitor has their own IP, and we debounce and cache, so a busy site
 * does not add up against one limit.
 */
const TAP = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync';

export type Literature =
  | { known: false }
  | { known: true; name: string; papers: number; type: string | null };

const cache = new Map<string, Promise<Literature>>();

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"' && line[i + 1] === '"') (cur += '"'), i++;
      else if (c === '"') quoted = false;
      else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') out.push(cur), (cur = '');
    else cur += c;
  }
  out.push(cur);
  return out;
}

export function parseLiterature(csv: string): Literature {
  const [, row] = csv.split(/\r?\n/).filter(l => l.trim() !== '');
  if (!row) return { known: false };
  const [name, papers, type] = parseCsvLine(row);
  return { known: true, name: name.replace(/\s+/g, ' ').trim(), papers: Number(papers) || 0, type: type || null };
}

export function literatureFor(gaiaDr3Id: string, signal?: AbortSignal): Promise<Literature> {
  if (!/^\d{1,20}$/.test(gaiaDr3Id)) return Promise.resolve({ known: false });
  let p = cache.get(gaiaDr3Id);
  if (!p) {
    const adql =
      'SELECT b.main_id, b.nbref, b.otype FROM basic AS b JOIN ident AS i ON i.oidref = b.oid ' +
      `WHERE i.id = 'Gaia DR3 ${gaiaDr3Id}'`;
    const params = new URLSearchParams({ REQUEST: 'doQuery', LANG: 'ADQL', FORMAT: 'csv', QUERY: adql });
    p = fetch(`${TAP}?${params}`, { signal: AbortSignal.timeout(15_000) })
      .then(r => {
        if (!r.ok) throw new Error(`SIMBAD: HTTP ${r.status}`);
        return r.text();
      })
      .then(parseLiterature);
    cache.set(gaiaDr3Id, p);
    p.catch(() => cache.delete(gaiaDr3Id));
  }
  if (!signal) return p;
  return Promise.race([
    p,
    new Promise<never>((_, reject) => signal.addEventListener('abort', () => reject(signal.reason), { once: true })),
  ]);
}
