# My Gaia Star

**Above you is a star no one has ever looked at closely.** ESA's Gaia has measured almost two billion stars. Nearly all of them are points in a catalogue — counted in statistics, plotted by the million — and only a tiny fraction has ever been studied on its own. My Gaia Star finds the star that is — or was — straight above you, checks the astronomical literature (SIMBAD) to see whether anyone has ever singled it out, and lets you make a certificate of it.

When Gaia DR4 comes out (2 December 2026) it will publish, for the first time, the raw measurements behind the catalogue: every pass Gaia made over every star, and the pixels it recorded. Each star's page already has a DR4 section, filled for now with real data from ESA's June 2026 pre-release; see [docs/DATA_ACCESS.md](docs/DATA_ACCESS.md) for how it switches to each star's own data, and for what could rate-limit a public deployment.

Pick a place (search, your location, or tap the map), choose *right now* or any past moment, and My Gaia Star draws the stars overhead on the map — one degree of sky from the zenith becomes one degree on the ground, in the same compass direction. Tap any star for its distance, colour, brightness and motion, what kind of star it is (red dwarf, Sun-like star, red giant…) drawn to scale next to the Sun, and a finder chart of the constellation it lies in. Every star also gets a name: a sentence made from its Gaia number (*Seven wise dolphins climb gracefully beyond the red mirror of the giant sky, under the full moon*), the same star in English, Spanish and Catalan. Type a Gaia ID or a name, and the site takes you to wherever on Earth that star is overhead, now or at any moment. Then download an A4 certificate (PDF or PNG) with the constellation chart, the star's portrait, its place on Gaia's colour–magnitude diagram and its position in the Milky Way. Every result is a shareable link. English, Spanish and Catalan.

It is a **static site**: no backend, no accounts, nothing to keep running.

## How it works

| Job | Where it happens |
|---|---|
| Zenith at a place and time (precession, nutation, aberration) | In the browser, with [astronomy-engine](https://github.com/cosinekitty/astronomy). Checked against astropy to ≈5″ (`src/sky/zenith.test.ts`). |
| Local time at the chosen place, including historical DST | `@photostructure/tz-lookup` + `Intl` (`src/sky/time.ts`) |
| Gaia DR3 stars around the zenith | [CDS VizieR](https://vizier.cds.unistra.fr/) cone search (`I/355/gaiadr3`), falling back to [GAVO](https://dc.g-vo.org/) TAP (`gaia.dr3lite`) if VizieR is down (`src/sky/gaia.ts`) |
| Naked-eye stars (G < 6) | Bundled: `public/naked-eye.json` |
| HR diagram background | Bundled: `public/hr-density.png`, a 2-D histogram of 1.9 M Gaia stars within 200 pc |
| Has anyone written about it? | SIMBAD TAP (CDS): is `Gaia DR3 <id>` an identifier of a catalogued object, and in how many papers (`src/sky/simbad.ts`) |
| DR4 epoch astrometry | Today: ESA's DR4 pre-release, bundled (`public/dr4-preview.json`). After 2 Dec 2026: ESA DataLink through `proxy/worker.js`. Parsed and fitted (position, parallax, proper motion) in the browser (`src/dr4/`) |
| Kind of star and size | From its position relative to the main sequence on the HR diagram; radius from luminosity and temperature (`src/sky/classify.ts`) |
| Constellation | IAU boundaries via astronomy-engine; finder chart from bundled `public/sky-chart.json` (`src/sky/constellation.ts`), with the country below drawn under it (Natural Earth 1:50m via `world-atlas`, `src/sky/country.ts`); it can also be laid on the map at true size |
| Star names | The 63-bit source_id, scrambled reversibly and split into eleven word choices (32 × 16 × 64⁹ = 2⁶³ sentences, one per ID), with Spanish and Catalan agreement (`src/names/`) |
| Find a star again | Gaia DR3 lookup by source_id (VizieR, GAVO fallback), then the point on Earth where it is at the zenith (`subStellarPoint` in `src/sky/zenith.ts`) |
| Certificate | Drawn on a `<canvas>`, saved with jsPDF (`src/certificate/`) |
| Place names | OpenStreetMap Nominatim |

Why not the ESA Gaia archive directly? It sends no CORS headers, so browsers can't call it. VizieR's *TAP* endpoint is unusable from browsers too (it sends `Access-Control-Allow-Origin` twice). Wide magnitude-limited cones are slow on every mirror, which is why the naked-eye stars ship with the site and the "bright" depth probes a small cone before choosing its radius.

### Search depths

| Depth | Stars | Typical time |
|---|---|---|
| Eye | G < 6 within 20° (bundled) | instant |
| Bright | the 400 nearest with G < 13 | 1–4 s |
| Faint | the 400 nearest with G < 19, within 0.3° | 0.6–1.5 s |
| Deepest | the 400 nearest of any brightness, within 400″ | < 1 s |

"Your star" is the nearest star to the zenith whose Gaia parallax is good to 20% and which has a colour — so its certificate can place it on the HR diagram and in the Galaxy.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173/my-gaia-star/
npm test           # unit tests (offline)
LIVE=1 npx vitest run gaia.live   # also query the real Gaia services
npm run build      # static site in dist/
```

The bundled data files are built once and committed. To rebuild them (needs Python 3; the HR map also needs `numpy` and `pillow`):

```bash
python3 scripts/naked_eye_stars.py
python3 scripts/hr_density.py
python3 scripts/sky_chart.py
python3 scripts/dr4_prerelease.py path/to/GAIA_DR4_PRERELEASE_EPOCH_ASTROMETRY_RAW.xml   # see the script for the download
```

## Deploy

Pushing to `main` builds and publishes to GitHub Pages (`.github/workflows/deploy.yml`). One-time setup: **Settings → Pages → Source: GitHub Actions**. The site is served from `/my-gaia-star/`; for a custom domain, build with `BASE_PATH=/`.

## Credits

An independent project using ESA Gaia data; not affiliated with or endorsed by ESA.


Star data: ESA/Gaia/DPAC, Gaia DR3 — served by CDS VizieR (Strasbourg) and GAVO (Heidelberg). DR4 preview: ESA/Gaia/DPAC, Gaia DR4 pre-release (June 2026). Literature: SIMBAD, CDS, Strasbourg. Map data © OpenStreetMap contributors. Constellation figures, boundaries, names and the Hipparcos chart stars come from [d3-celestial](https://github.com/ofrohn/d3-celestial) © Olaf Frohn (BSD 3-clause). This work has made use of data from the European Space Agency (ESA) mission Gaia, processed by the Gaia Data Processing and Analysis Consortium (DPAC).
