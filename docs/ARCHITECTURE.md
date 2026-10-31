# Architecture: how My Gaia Star works, for whoever maintains it next

Read this first, then [DATA_ACCESS.md](DATA_ACCESS.md) for the outside services and their limits. For the visual rules (type, colour, what not to add), see [DESIGN.md](DESIGN.md).

## The short version

- **A static site.** React + TypeScript, built by Vite into `dist/`, hosted on GitHub Pages. There is no backend, no database and no accounts. Everything runs in the visitor's browser.
- **Data comes from three places:**
  - files bundled in `public/`, built once by `scripts/*.py` and committed;
  - public astronomy services, called straight from the browser: CDS VizieR, GAVO and SIMBAD, plus OpenStreetMap for place names and map tiles;
  - after Gaia DR4 (2 December 2026), ESA's archive, through a small optional proxy in `proxy/`.
  - later, optionally, our own catalogue server instead of VizieR/GAVO/SIMBAD: set `VITE_API_BASE` at build time. The contract, security and privacy rules are in [BACKEND.md](BACKEND.md).
- **One settings file.** Every service URL, the repository link and the DR4 settings are in `src/config.ts`.
- **Locked down by default.** The build writes a Content-Security-Policy listing exactly the services in `config.ts` (`src/csp.ts`), and refuses unsafe `VITE_*` settings.

## What happens when someone uses it

1. **Pick a place and a moment.** `components/Panel.tsx` leads with one button, *Find my star* (the browser's location, right now, every star Gaia saw: `findHere` in `App.tsx`). The place-and-moment form, with the depth under *Advanced*, opens from a link or a map tap. A map tap or a shared link gives a point without a name, and `state/usePlace.ts` asks Nominatim for one (`geo.ts`). While the search runs, `Progress` in `Panel.tsx` ticks off its real stages (zenith, catalogue, literature).
2. **Find the zenith.** `sky/zenith.ts` turns place and time into the sky coordinates straight overhead. It uses astronomy-engine, adds aberration, and is checked against astropy in `zenith.test.ts`. `sky/time.ts` handles "14:30 on Lima's clocks".
3. **Ask Gaia for the stars around it.** `sky/gaia.ts` queries VizieR first and falls back to GAVO, nearest star first. The "Eye" depth reads the bundled `public/naked-eye.json` instead. `state/useStarSearch.ts` runs the search, cancels a previous one, and picks "your star": the nearest one with a distance and a colour.
4. **Draw them on the map.** `components/SkyMap.tsx` uses Leaflet. One degree of sky from the zenith is drawn one degree of ground from the place (`starToLatLng` in `sky/zenith.ts`).
5. **Show the star.** `components/StarCard.tsx` reads in two acts:
   - *the reveal*: the SIMBAD literature check as the headline (`sky/simbad.ts` via `state/useLiterature.ts`), three key facts (kind, when its light left, where to look), its Gaia number in words (`names/`), and the record and share buttons;
   - *in detail*: the figures (`draw/`), the facts table (`facts.ts`, with distance uncertainties from the parallax error) and the DR4 section (`components/Dr4Section.tsx`, data from `dr4/`).
6. **Share or keep it.** (The footer also opens `MethodDialog.tsx`, *Method & limitations*: how each number is made, for astronomers. Keep it true when the method changes.)
   - The address bar always holds a link that reproduces the screen (`urlState.ts`, `state/useUrlSync.ts`). It always carries the moment and the star: the zenith crosses the 400″ search circle in about a minute, so a link without them would show another star.
   - `components/ShareDialog.tsx` pre-fills posts.
   - `certificate/render.ts` draws an A4 page on a canvas, and `certificate/download.ts` saves it as PNG or PDF. The certificate makes no network requests of its own.
7. **Find a star again.** `components/StarFinder.tsx`, in a dialog from the footer (`FindDialog.tsx`), takes a Gaia ID or its words, looks the star up (`starById`), and goes to wherever on Earth it is overhead (`subStellarPoint`).

## Where things are

```
src/
  main.tsx, App.tsx      entry point; App lays out map, panel and dialogs
  config.ts              outside services, repo URL, DR4 date and proxy  ← start here to change a provider
  csp.ts                 Content-Security-Policy and build-setting checks (used by vite.config.ts)
  api/                   our own catalogue server, when VITE_API_BASE is set: contract.ts (types + checks), client.ts
  types.ts               Place, Result, Status, LiteratureState
  state/                 React hooks holding the app's state (search, place, SIMBAD check, URL, map overlay)
  components/            React components; dialogs use the native <dialog> via Dialog.tsx
  sky/                   astronomy and catalogues, no React and no drawing:
                           zenith, time zones, Gaia queries, SIMBAD, physics, star types, constellations, countries
  names/                 the reversible Gaia ID ↔ sentence names (en/es/ca)
  dr4/                   DR4 epoch data: parsing and fitting (epoch.ts), where it comes from (source.ts)
  draw/                  every <canvas> drawing: finder chart, galaxy, HR diagram, star portrait, DR4 plots
                           theme.ts is the canvas palette, which must match the CSS tokens in styles.css
  certificate/           the A4 page layout (render.ts) and saving it (download.ts)
  i18n/                  en.ts (defines every key), es.ts, ca.ts, index.tsx (provider and t())
  lib/                   small helpers: load-once caching, CSV parsing
  format.ts, facts.ts    numbers, dates and coordinates as text; the facts table
  geo.ts                 Nominatim place search and reverse geocoding
  styles.css             all styles; design tokens at the top
public/                  bundled data, served as is
scripts/                 Python scripts that build the bundled data (run rarely; see below)
proxy/                   Cloudflare Worker for DR4 data (not deployed yet)
```

The layers depend downwards only: `components` and `state` use everything; `certificate` uses `draw`, `sky` and `names`; `draw` uses `sky`; `sky`, `names` and `dr4` use only `lib`, `config`, `api` and the `Lang` type; `api` uses only `config` (and `sky`'s types). Keep it that way: it is what lets the logic be tested without a browser.

## Bundled data

| File | Built by | Used by |
|---|---|---|
| `public/naked-eye.json` | `scripts/naked_eye_stars.py` | the "Eye" depth (`sky/gaia.ts`) |
| `public/sky-chart.json` | `scripts/sky_chart.py` (from d3-celestial) | finder charts, map overlay (`sky/constellation.ts`) |
| `public/hr-density.png` | `scripts/hr_density.py` (needs `pip install -r scripts/requirements.txt`) | the HR diagram (`draw/hr.ts`; keep `HR_AXES` in step with the script) |
| `public/dr4-preview.json`, `src/dr4/fixtures/one-source.vot` | `scripts/dr4_prerelease.py` (from ESA's pre-release file) | the DR4 section until real DR4 data is connected; parser test |
| `src/sky/calibration.fixtures.json` | `scripts/calibration_stars.py` | star-type calibration test |
| `public/og-image.png`, `public/story-{en,es,ca}.png`, `public/apple-touch-icon.png` | `scripts/share_cards.sh` (renders `scripts/og_image.html`) | link previews, the Instagram story card, the home-screen icon |

Country outlines come from the `world-atlas` npm package. Nothing needs rebuilding unless you want newer data.

## Things that will bite you

- **Never reorder, insert or remove words in `src/names/lexicon.ts`.** A word's position *is* the encoding. Changing the lists silently renames every star, and breaks every name people have saved. Fixing a translation in place is fine.
- **Gaia IDs are 19-digit numbers and must stay strings.** JavaScript numbers round them. That's why the Gaia queries ask for CSV and TSV, not JSON.
- **Nominatim and OSM tiles are rate-limited for the whole site, not per visitor.** See DATA_ACCESS.md §2 before any launch or press. Change providers in `config.ts`.
- **The canvas palette (`draw/theme.ts`) mirrors the CSS tokens (`styles.css`).** Change both together.
- **Translations:** add a key to `i18n/en.ts` first. TypeScript then reports where `es.ts` and `ca.ts` are missing it, and `i18n.test.ts` checks that `{placeholders}` match.
- **DR4 day (2 December 2026):** the site switches its wording automatically. Showing each star's *own* DR4 data needs the proxy deployed. See the checklist in DATA_ACCESS.md §1.

## Working on it

```bash
npm install
npm run dev            # http://localhost:5173/my-gaia-star/
npm run check          # types, lint, formatting, unit tests (CI runs the same)
npm run format         # fix formatting
LIVE=1 npx vitest run gaia.live   # also query the real Gaia services
npm run build          # static site in dist/
```

- **Unit tests** cover the logic, not the UI. That logic is: zenith maths, time zones, names, star types, CSV/TSV/VOTable parsing, the DR4 fit and translations.
- **After UI changes, click through by hand:** a search, a star, the certificate and the share dialog, in each language.
- **Code style:** Prettier formats it (130 columns, single quotes). ESLint checks it, including React's hooks rules. Comments explain *why* something is done; keep them current when the code changes.

## Deploying

- **The site:** pushing to `main` runs `.github/workflows/deploy.yml`. It runs lint, the format check, the tests and the build, then publishes to GitHub Pages. One-time setup: *Settings → Pages → Source: GitHub Actions*.
  - The site is served from `/my-gaia-star/`. For a custom domain, build with `BASE_PATH=/`.
  - To host elsewhere, upload `dist/` to any static host.
- **The DR4 proxy (optional):**
  1. Set `ALLOWED_ORIGIN` in `proxy/wrangler.toml`.
  2. Run `cd proxy && npx wrangler deploy`.
  3. Rebuild the site with `VITE_DR4_PROXY=<the worker's URL>`.
- **Our own catalogue server (optional, not built yet):** build with `VITE_API_BASE=https://…`. Read [BACKEND.md](BACKEND.md) first; it lists what the server must do for security and privacy.
- **If you move the repository:** update `REPO_URL` in `src/config.ts` and the `User-Agent` in `proxy/worker.js`.
