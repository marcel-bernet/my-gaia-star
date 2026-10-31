/**
 * DR4 epoch-data proxy for My Gaia Star — a Cloudflare Worker (free tier is plenty).
 *
 * Why it exists: ESA's Gaia archive sends no CORS headers, so the browser
 * cannot fetch DataLink products itself. This forwards one star at a time,
 * adds CORS, and caches every answer at the edge for a year: a data release
 * never changes, so ESA sees each star at most once per edge location,
 * however many people look at it.
 *
 *   GET /epoch-astrometry/<source_id>  →  VOTable (BINARY2), or 404
 *
 * Deploy:  cd proxy && npx wrangler deploy     (settings in proxy/wrangler.toml)
 * Then build the site with VITE_DR4_PROXY=https://my-gaia-star-dr4.<you>.workers.dev
 *
 * TO CHECK ON RELEASE DAY (2 Dec 2026): the DataLink RETRIEVAL_TYPE name for
 * DR4 epoch astrometry and the RELEASE string. DR3 used e.g.
 * RETRIEVAL_TYPE=EPOCH_PHOTOMETRY&RELEASE=Gaia+DR3&FORMAT=votable, and
 * returns a BINARY2 VOTable — the same format as the June 2026 pre-release,
 * which src/dr4/epoch.ts already parses.
 */
const DATALINK = 'https://gea.esac.esa.int/data-server/data';
const PRODUCTS = {
  'epoch-astrometry': 'EPOCH_ASTROMETRY',
  // Later, same pattern: 'epoch-photometry': 'EPOCH_PHOTOMETRY', 'epoch-image': '…'
};
const YEAR = 365 * 86400;

export default {
  async fetch(request, env, ctx) {
    const origin = env.ALLOWED_ORIGIN || '*';
    const cors = {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });
    if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: cors });

    const url = new URL(request.url);
    const m = url.pathname.match(/^\/([a-z-]+)\/(\d{1,20})$/);
    const type = m && PRODUCTS[m[1]];
    if (!type) return new Response('Not found', { status: 404, headers: cors });
    const id = m[2];

    const cache = caches.default;
    const key = new Request(`${url.origin}/${m[1]}/${id}`);
    let res = await cache.match(key);
    if (!res) {
      const params = new URLSearchParams({ RETRIEVAL_TYPE: type, ID: id, RELEASE: 'Gaia DR4', FORMAT: 'votable' });
      const upstream = await fetch(`${DATALINK}?${params}`, {
        headers: { 'User-Agent': 'my-gaia-star-dr4-proxy (+https://github.com/marcel-bernet/my-gaia-star)' },
      });
      const body = await upstream.text();
      // DataLink answers "no data" with an empty table (or an error page): cache that as a 404 too.
      const empty = !upstream.ok || !body.includes('<STREAM');
      if (!upstream.ok && upstream.status >= 500 && !body.includes('No data')) {
        return new Response('Gaia archive unavailable', { status: 502, headers: { ...cors, 'Retry-After': '60' } });
      }
      res = new Response(empty ? 'No DR4 epoch data for this source' : body, {
        status: empty ? 404 : 200,
        headers: {
          'Content-Type': empty ? 'text/plain' : 'application/x-votable+xml',
          'Cache-Control': `public, max-age=${empty ? 86400 : YEAR}, immutable`,
        },
      });
      ctx.waitUntil(cache.put(key, res.clone()));
    }
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
    return out;
  },
};
