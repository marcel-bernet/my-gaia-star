# Data access: today, on DR4 day, and at scale

Status 23 October 2026. Gaia DR4 is announced for **2 December 2026, ~12:00 CET**.

## 1. What each star needs, and where it comes from

| What | Today (DR3 + pre-release) | After DR4 |
|---|---|---|
| Stars around the zenith | CDS VizieR cone search `I/355/gaiadr3`, GAVO TAP fallback (`src/sky/gaia.ts`) | Same, switched to the DR4 catalogue once CDS/GAVO host it (they usually do within days to weeks). Until then, DR3 positions + DR4 epoch data by `source_id`. |
| "Has anyone looked at it?" | SIMBAD TAP: `basic` ⨝ `ident` on `Gaia DR3 <id>` → name + number of papers (`src/sky/simbad.ts`) | Same. SIMBAD adds `Gaia DR4 …` identifiers over time; keep querying by the DR3 id too. |
| Epoch astrometry (every pass, every CCD) | Bundled stand-in: ESA's June 2026 pre-release, 12 sources, 1 008 transits (`public/dr4-preview.json`, built by `scripts/dr4_prerelease.py`) | ESA DataLink, one star at a time, through the proxy in `proxy/worker.js` (`src/dr4/source.ts` switches automatically once `VITE_DR4_PROXY` is set and the release date has passed) |
| Epoch photometry (light curve), epoch RVs, XP/RVS epoch spectra | — | Same DataLink route, one more `PRODUCTS` entry in the proxy and one more figure each. Epoch RVs only exist for G_RVS ≤ 14, so very few zenith stars will have them. |
| **The pixels** (`epoch_image`, DL1, 113 TB total) | Schematic of the real window geometry for each pass (window class is real data; the shading is not, and the caption says so) | DataLink, same route. Rough size per star: ~70 passes × ~10 CCDs × 18×12 samples ≈ 0.3–1 MB — fine one star at a time, cached at the edge. |

### Why a proxy at all

Measured on 23 Oct 2026 by sending an `Origin` header and reading the response headers:

| Endpoint | CORS for a browser? |
|---|---|
| `gea.esac.esa.int/tap-server` (ESA TAP) | **No** |
| `gea.esac.esa.int/data-server` (ESA DataLink) | **No** |
| `vizier.cds.unistra.fr/viz-bin/asu-tsv` | Yes (`*`) |
| `dc.g-vo.org/tap` (GAVO) | Yes (echoes origin) |
| `simbad.cds.unistra.fr/simbad/sim-tap` | Yes (`*`) |
| `simbad.harvard.edu/simbad/sim-tap` (CfA mirror, fallback) | Yes |
| `gaia.aip.de/tap` | No |

DR4 epoch products will be served first (and possibly only) by ESA, so the site needs a small server-side hop. `proxy/worker.js` is a ~70-line Cloudflare Worker: it maps `/epoch-astrometry/<source_id>` to DataLink, adds CORS, and caches each answer for a year (a data release never changes).

DataLink format check (DR3, today): `?RETRIEVAL_TYPE=EPOCH_PHOTOMETRY&ID=…&RELEASE=Gaia+DR3&FORMAT=votable` returns a single **BINARY2 VOTable** — the same serialisation as the DR4 pre-release, which `src/dr4/epoch.ts` parses (tested against an untouched slice of ESA's file). Note `DATA_STRUCTURE=INDIVIDUAL` is now rejected ("deprecated – use DATAMODEL…"); leave it out.

### DR4-day checklist

1. Read the DR4 data model: confirm the DataLink `RETRIEVAL_TYPE` names (`EPOCH_ASTROMETRY`? `EPOCH_IMAGE`?) and the `RELEASE` string; fix `PRODUCTS` in `proxy/worker.js`.
2. Pull one real star through the proxy; run it through `fromVotable` (the pre-release columns — `obs_time_tcb`, `scan_pos_angle`, `centroid_pos_al`, `centroid_pos_error_al`, `used_by_agis_al`, `parallax_factor_al` — are what the code reads; check none were renamed).
3. DR3 → DR4 identifiers: most `source_id`s carry over. For the rest, DR4 ships a DR3 cross-match table; resolve in the proxy (one TAP query, cached) and keep the site on DR3 ids until VizieR/GAVO serve DR4 cones.
4. `cd proxy && npx wrangler deploy` (settings in `proxy/wrangler.toml`), rebuild the site with `VITE_DR4_PROXY=…`, push.
5. Then: swap the cone search to DR4 when `I/3xx/gaiadr4` (VizieR) or a GAVO `gaia.dr4lite` appears; add the light curve; then the pixels.

## 2. Will a public site get blocked?

The key fact: **everything except the DR4 proxy runs in each visitor's browser**, so each visitor's requests come from their own IP. Per-IP limits apply to them individually, not to the site. The only limits that add up across all visitors are those defined *per application* (Nominatim, OSM tiles) — and anything that funnels through one server (the DR4 proxy).

**The certificate is safe:** it is drawn entirely in the browser from data already loaded plus bundled files (`hr-density.png`, `sky-chart.json`). `src/certificate/` makes no network requests at all, so issuing certificates cannot get the site blocked, at any volume.

| Service | Calls per visitor | Limit (documented) | Counts against | Risk if the site gets popular | Mitigation |
|---|---|---|---|---|---|
| **CDS VizieR** (Gaia cone) | 1–2 per search | No published number; CDS blocks IPs that burst | Each visitor's IP | Low. A viral day is extra load on CDS, not a block on you | GAVO fallback already in place. If traffic grows past ~10k searches/day, let CDS know through their contact page — a heads-up is appreciated. |
| **GAVO** (fallback) | 0 normally | Fair use | Visitor IP | Low | — |
| **SIMBAD** (first-look check) | 1 per star selected; debounced 350 ms and cached | ~6 queries/s per IP, 1-min blacklist when exceeded ([CDS, 2015](https://cds.unistra.fr/news/2015/08/24-limitation-burst-queries)) | Visitor IP | Low: a person can't tap stars at 6/s after the debounce | Already debounced + cached. |
| **OSM Nominatim** (place names) | 1 per typed search, 1 per map tap (debounced 700 ms, cached per ~100 m) | **1 request/s absolute max for the whole application**; no autocomplete; must send Referer/UA ([policy](https://operations.osmfoundation.org/policies/nominatim/)) | **The whole site** | **Medium–high.** 1 req/s is 86 400/day *if perfectly spread*; peaks hit it far sooner. This is the first thing that would get blocked | Already: search on submit only, debounce, cache. If traffic grows: drop reverse geocoding on tap (show the time-zone city instead), and use Photon (komoot) or a paid geocoder with a free tier (MapTiler, Stadia, LocationIQ) for search. |
| **OSM tiles** | ~20–60 tiles per visit | No number; "heavy use" may be blocked without notice; valid Referer required; no prefetching ([policy](https://operations.osmfoundation.org/policies/tiles/)) | **The whole site** (by Referer) | **Medium** for a viral spike | Before a launch/press push: switch to a tile provider with a free tier (MapTiler, Stadia, CARTO) or self-host Protomaps PMTiles. One-line change in `src/config.ts`. |
| **ESA archive via DR4 proxy** | 1 per star *not yet cached* | Anonymous archive use is fair-use; all proxy traffic arrives from Cloudflare's IPs | **The proxy, i.e. the whole site** | **Medium** on DR4 day, when every science user also hits the archive | Edge cache for a year (immutable data) → ESA sees each star roughly once per edge location; identify the proxy in `User-Agent`; add a per-IP limit in the Worker if abused; the site falls back to the preview automatically on any error. Email the Gaia helpdesk before launch. |
| **GitHub Pages** (the site itself) | ~0.5–0.8 MB first visit | Soft limit 100 GB/month bandwidth | The site | Low until ~100k visits/month | Move to Cloudflare Pages (no bandwidth cap) if needed; `dr4-preview.json` (104 kB gzipped) is only fetched when the DR4 section opens. |

**Bottom line:** the Gaia data services (CDS, GAVO, SIMBAD) will not block you, because each visitor queries them directly. The two things to fix before any big launch are the shared OpenStreetMap services (geocoder first, then tiles). The DR4 proxy is the one piece you operate yourself, and caching makes it cheap for ESA.
