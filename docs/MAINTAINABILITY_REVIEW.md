# Maintainability review: handing My Gaia Star over

Reviewed 30 October 2026, at commit `8c5037b`. Scope: everything under `src/`, `proxy/`, `scripts/`, the build and CI setup, and the docs. Baseline: `npm test` gives 77 passing tests (7 live tests skipped), and `tsc --noEmit` is clean.

## 1. Verdict

The code is in better shape than "vibe coded" suggests. The hard parts are already done well:

- **The architecture is simple.** It's a static site with no backend, no accounts and no database. Anyone who can run `npm run dev` can work on it.
- **The domain logic is pure and tested.** `src/sky/`, `src/names/` and `src/dr4/epoch.ts` are plain TypeScript functions with no React in them. They are checked against astropy, against 40 real stars and against ESA's own file.
- **Comments explain *why*, not *what*.** Examples are CORS, rate limits, and why IDs travel as CSV and not JSON. Keep these.
- **`docs/DATA_ACCESS.md` is a real operations document.** Most projects of this size don't have one.

Three things make it read as "AI wrote this" and make it harder to take over:

1. **Blurry boundaries.** Drawing code lives in three folders. UI components import helpers from the certificate renderer, and shared types are imported from `App.tsx`. The same few patterns (caching loaders, palettes, CSV parsing, date padding) were written again and again instead of once.
2. **No guard rails for a second person.** There's no formatter, no linter (yet the code has `eslint-disable` comments), no architecture doc, and no single place that lists the external services and settings.
3. **Leftovers from iteration.** There are unused translation keys, comments that tell the story of past versions ("replaces the old backend", "the panel sits beside the map *now*"), a stale file reference, and dense one-liners.

None of this needs a rewrite. About **two to three days of mechanical refactoring, with no change in behaviour**, would get it to a state where a new maintainer can find any feature within minutes. The plan is in §5.

> ⚠️ **Deadline before the handoff:** Gaia DR4 is due on **2 December 2026**, about 5 weeks from now. On that date the DR4 section changes behaviour on its own, and some of its text becomes wrong (see §3.5). Either deal with it before the handoff, or put it at the top of the new maintainer's to-do list.

## 2. The codebase in one page

This is the overview a new maintainer needs first. Today it is spread across the README, `DATA_ACCESS.md` and the source files.

```
Browser only (GitHub Pages)
│
├─ App.tsx ............. all app state: place, time, depth, result, selected star, dialogs
│   ├─ SkyMap .......... Leaflet map; stars projected onto the ground (sky/zenith.ts)
│   └─ Panel ........... the left column: form (01 place, 02 when, 03 depth)
│       ├─ StarFinder .. find a star by Gaia ID or by its generated name (names/)
│       └─ StarCard .... the star's page: name, SIMBAD check, figures, facts table
│           └─ Dr4Section  DR4 epoch-astrometry figures (dr4/)
│   └─ dialogs ......... Certificate, Share, About, "What's the point?", Name
│
├─ sky/ ......... astronomy (zenith, time zones, classification, physics, constellations)
│                  + network: gaia.ts (VizieR → GAVO), simbad.ts
├─ names/ ....... reversible source_id ↔ sentence (en/es/ca)
├─ dr4/ ......... DR4 data: parsing + fitting (epoch.ts), where it comes from (source.ts), plots
├─ certificate/ . A4 canvas renderer + galaxy/HR/portrait drawings (also used by StarCard)
├─ geo.ts ....... Nominatim place search / reverse geocoding
├─ i18n.tsx ..... all ~300 strings × 3 languages, and the React context
└─ public/ ...... bundled data built by scripts/*.py (committed; rebuild rarely)

External services (all called straight from the visitor's browser):
  VizieR, GAVO (Gaia DR3) · SIMBAD (literature) · Nominatim (place names) · OSM tiles
  + ESA DataLink via proxy/worker.js (Cloudflare Worker), only after DR4 and only if deployed
```

**About "the database":** there isn't one. Data comes from four sources:

| Source | Type | Where it is set | Where it is used |
|---|---|---|---|
| Bundled JSON/PNG in `public/` | Static files | Rebuilt by `scripts/*.py` | `gaia.ts`, `constellation.ts`, `dr4/source.ts`, `certificate/panels.ts` |
| CDS VizieR, GAVO TAP | Public read-only APIs | Constants at the top of `sky/gaia.ts` | `starsAround`, `starById` |
| SIMBAD TAP | Public API | Constant in `sky/simbad.ts` | `literatureFor` |
| Nominatim, OSM tiles | Public, **limited per site** | `geo.ts`, a literal URL in `SkyMap.tsx` | Place names, map |
| ESA DataLink | Needs `proxy/worker.js` + `VITE_DR4_PROXY` | `proxy/worker.js`, `dr4/source.ts` | DR4 section, certificate |

Recommendation 4.1 below gathers all of these into one `src/config.ts`. Then "change the geocoder" or "point at the DR4 catalogue" becomes a one-file change.

## 3. Findings

Each finding has a location and a concrete fix. Severity reflects the cost to a *new maintainer*, not to users: the site works.

### 3.1 Structure and boundaries

**S1. `App.tsx` holds all the state. `Panel` passes 22 props through to `StarCard`.** (High)
`App.tsx` has 13 `useState` hooks, 5 effects, a search callback and a memo. Between them they handle the geocoding debounce, the search with abort, URL sync, the SIMBAD debounce, sky-chart loading and the constellation overlay. Most of `Panel`'s props are not used by `Panel` at all. They are passed straight down to `StarCard` (`literature`, `onMap`, `onToggleMap`, `onCertificate`, `onBackToZenith`, `resultPlaceName`…).
*Fix:* Move each concern into its own hook in `src/state/`: `usePlaceName(place, lang)`, `useStarSearch()` (owns `result`, `status`, `selectedId` and the abort controller), `useLiterature(starId)`, `useUrlSync(...)`. Render `StarCard` from `App` next to `Panel` (pass it as `children`), not through it. `App` drops to about 80 lines that read like a table of contents.

**S2. Drawing code is spread across three folders.** (Medium)
- `sky/constellation.ts` is supposed to be astronomy. It also contains a 210-line canvas function, `drawConstellation`, with 8 positional parameters, and `drawTargetMarker`.
- `certificate/galaxy.ts` and `certificate/panels.ts` are also used by the live `StarCard`, so they aren't certificate-only.
- `certificate/panels.ts` imports a drawing helper from `sky/constellation.ts`, which is the wrong direction.

*Fix:* Create `src/draw/` (constellation chart, galaxy, HR, portrait, DR4 plots, shared canvas helpers). Keep `sky/` free of canvas code, and keep only the A4 page layout in `certificate/`. Change `drawConstellation(ctx, box, sky, abbr, target, style, ground, furniture)` to take a single options object.

**S3. Helpers sit in the wrong modules.** (Medium)
- `formatRatio` is defined in `certificate/render.ts` but used by `StarCard` and `ShareDialog`. Move it, `formatRa` and `formatDec` from `facts.ts`, and the various `Intl.NumberFormat` one-offs into `src/format.ts`.
- The `Figure` component is exported from `StarCard.tsx` and imported by `Dr4Section.tsx`. Give it its own file.

**S4. Types are duplicated or imported from `App.tsx`.** (Medium)
- `Place` is defined twice with different shapes (`App.tsx`: `name: string | null`; `geo.ts`: `name: string`).
- `Status` is defined in `App.tsx` and again inline in `StarFinder.tsx`.
- `Literature | 'loading' | 'error' | null` is written out four times.
- Five components `import type … from '../App'`.

*Fix:* Add `src/types.ts` with `Place`, `Result`, `Status` and `LiteratureState`.

### 3.2 Duplication

| # | What | Where | Fix |
|---|---|---|---|
| D1 | **Palette and fonts defined 4×, with clashing meanings.** `INK` is the dark background (`#0c0d0f`) in `certificate/theme.ts`, but the light text colour (`#e9e7e2`) in `dr4/plots.ts`. `RULE` is 0.14, 0.12 and (in CSS) 0.09 alpha. Font stacks are copied into `galaxy.ts`, `panels.ts`, `plots.ts` and `StarCard.tsx`. | `certificate/theme.ts`, `dr4/plots.ts:7-11`, `galaxy.ts:26-27`, `panels.ts:17`, `StarCard.tsx:161`, `styles.css:6-20` | One `src/draw/theme.ts` with semantic names (`bg`, `text`, `textMuted`, `textFaint`, `accent`, `rule`). Note in `styles.css` that the two must match. |
| D2 | "Fetch a bundled JSON once, cache the promise, forget it on error" is written 5×. | `gaia.ts:194`, `constellation.ts:27`, `country.ts:15`, `dr4/source.ts:25`, `panels.ts:72` | A 10-line `loadOnce(url, transform)` in `src/lib/cache.ts`. |
| D3 | "Memoise a promise per key, delete on failure" is written 3×. | `simbad.ts:17`, `geo.ts:39`, `dr4/source.ts:55` | `memoAsync(fn)` in the same file. |
| D4 | Two CSV parsers: a naive one in `gaia.ts` (no quote handling) and a correct one in `simbad.ts`. | `gaia.ts:92`, `simbad.ts:19` | Keep the correct one in `src/lib/csv.ts` and use it in both places. |
| D5 | The Gaia column list and the GAVO ADQL `SELECT` are written twice: once for the cone search and once for the lookup by ID. | `gaia.ts:143-147`, `gaia.ts:248-250` | One `GAVO_COLUMNS` constant and a `gavoQuery(where, orderBy)` helper. |
| D6 | Zero-padded local date strings built by hand 3×. | `App.tsx:32`, `StarFinder.tsx:8`, `time.ts` (`instantToWallTime`) | One `pad`/`localDateString` helper in `sky/time.ts`. |
| D7 | The DR4 release date is formatted in two places with the same `Intl` options. | `Dr4Section.tsx`, `CertificateDialog.tsx` | `formatDate(d, lang)` in `format.ts`. |
| D8 | The SIMBAD object URL is built 2×, and the GitHub repo URL is hard-coded 3×, including **the current owner's account name**, which a new owner will have to hunt for. | `StarCard.tsx:89,307`; `Panel.tsx:232`, `AboutDialog.tsx:15`, `proxy/worker.js:52` | `config.ts` (`REPO_URL`, `simbadUrl(id)`). |
| D9 | Magic numbers: canvas width `352` (7×), light-years per kpc `3261.56` (2×, while `LY_PER_PC` already exists), the DR3/DR4 counts in `Panel.tsx:104-112`. | various | Named constants: `FIGURE_W`, `LY_PER_KPC`, `GAIA_STATS`. |

### 3.3 Dead code and stale content

- **8 unused translation keys** (24 strings in total): `cert.mw.centre`, `cert.chart`, `cert.constellation`, `kind.notToScale`, `fact.kind`, `fact.constellation`, `source`, `close`. Delete them.
- **`close` is unused, but `Dialog.tsx:21` hard-codes `aria-label="Close"`**, so screen-reader users get English in the Spanish and Catalan versions. This is a small real bug: use `t('close')`.
- **`eslint-disable` comments with no ESLint installed** (`App.tsx:112,165`, `SkyMap.tsx:73,90`). Either add ESLint with `react-hooks` (recommended, see 4.2) or remove the comments.
- **Comments that tell the history, not the code:** "Replaces the old astropy backend" (`zenith.ts:5`), "as the old backend's default did" (`App.tsx:93`), "The panel sits beside the map now, not over it" (`SkyMap.tsx:66`). A new maintainer has never seen the old version. Reword them to describe what the code does today.
- **Stale reference:** `scripts/hr_density.py` says "keep in sync with HR_AXES in src/certificate/hr.ts", but that file doesn't exist. It's in `certificate/panels.ts`.
- **`_services` test-only export** in `gaia.ts:258`. Acceptable, but name it clearly (`__test__`) or export the two functions directly.

### 3.4 Readability

- **No formatter.** You can see it in the code: a 170-character one-liner (`StarCard.tsx:121`), mis-indented JSX in `StarFinder.tsx` (`<select>`), comma-operator tricks (`SkyMap.tsx:151`: `e => (L.DomEvent.stopPropagation(e), onSelectStar(s.id))`; `simbad.ts:26`: `(cur += '"'), i++`). Prettier fixes most of this in one commit.
- **Long drawing functions:** `renderCertificate` (~230 lines of absolute coordinates), `drawConstellation` (~210), `drawGalaxyFaceOn` (~120), `drawSkyPath` (~130). Long drawing code is normal. What helps is splitting each into named sections (`drawHeader`, `drawFirstLook`, `drawFigures`, `drawFacts`, `drawFooter`), each taking and returning `y`, so a maintainer can find "the dedication line" without reading 230 lines.
- **`Dr4Section` has 5 `useCallback` wrappers** that only exist because `CanvasArt` redraws when `draw` changes identity. Give `CanvasArt` a `deps` array, or memoise inside it, so callers pass plain arrow functions.
- **`i18n.tsx` is 965 lines,** almost all of it data. Split it into `src/i18n/{en,es,ca}.ts` and `src/i18n/index.tsx`. Translators then never touch React code, and `Dict = Record<Key, string>` still enforces that every language has every key.
- **Dynamic keys bypass the type check:** `t(\`kind.${kind}.about\` as Key)`, `t(\`name.slot.${s}\` as Key)`. Either list these keys as typed maps (`KIND_ABOUT: Record<Kind, Key>`), or add a test that checks every possible dynamic key exists.

### 3.5 Operations and handoff

- **DR4 date (2 Dec 2026).** `dr4/source.ts` switches automatically. Once the date has passed:
  - Without `VITE_DR4_PROXY`, the reason becomes `'no-proxy'` and the stand-in is shown. That works.
  - **The text goes stale:** the countdown badge reads "Today" forever (`daysToDr4()` clamps to 0 → `dr4.today`). `dr4.lead` says "On {date} ESA *publishes*…" and `dr4.standin` says "Until then…", both in the future tense. Add post-release versions of these strings, chosen by `dr4IsOut()`.
  - The proxy's `RETRIEVAL_TYPE`/`RELEASE` values are still guesses (`DATA_ACCESS.md` already has the checklist).
- **The proxy has no config file and no tests.** Add a `proxy/wrangler.toml` (name, `ALLOWED_ORIGIN`, compatibility date) so deploying it is `cd proxy && npx wrangler deploy`, not a long command copied from a comment. `ALLOWED_ORIGIN` defaults to `*` if unset; make it required.
- **Python scripts have no dependency file.** Requirements are only written in each script's docstring. Add `scripts/requirements.txt` and one line in the README.
- **No Node version pin.** CI uses Node 22. Add `"engines": { "node": ">=22" }` and an `.nvmrc`.
- **No lint step in CI.** It only runs `npm test` and `npm run build`. Add `npm run lint` and `npm run format:check` once they exist.
- **The README is written for visitors, not maintainers.** Add an `ARCHITECTURE.md` (the map in §2 plus the "where do I change…?" table in §6), or a short "For maintainers" section in the README.

## 4. Recommendations

### 4.1 One configuration file

```ts
// src/config.ts — everything a host or maintainer might need to change.
export const REPO_URL = 'https://github.com/<owner>/my-gaia-star';
export const SERVICES = {
  vizier: 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv',
  gavoTap: 'https://dc.g-vo.org/tap/sync',
  simbadTap: 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync',
  nominatim: 'https://nominatim.openstreetmap.org',
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tilesAttribution: '&copy; OpenStreetMap contributors',
};
export const DR4_PROXY = import.meta.env.VITE_DR4_PROXY; // unset: preview data only
export const DR4_RELEASE = new Date('2026-12-02T11:00:00Z');
```

This is the single biggest help for a handoff. The two changes most likely to be needed under load, switching the tile provider and the geocoder (see `DATA_ACCESS.md` §2), become edits to this one file.

### 4.2 Guard rails (about 1 hour)

- Prettier (`printWidth: 130`, which matches the current style), applied in its own commit so `git blame` can skip it (`.git-blame-ignore-revs`).
- ESLint with `typescript-eslint` and `eslint-plugin-react-hooks`. The hooks rule will flag the two effects that currently silence it, and that's useful.
- Scripts: `"lint"`, `"format"`, `"check": "tsc --noEmit && eslint . && vitest run"`. Run `check` in CI.

### 4.3 Target layout

```
src/
  main.tsx, App.tsx          App.tsx ≈ 80 lines: hooks + layout
  config.ts                  services, URLs, dates, env (new)
  types.ts                   Place, Result, Status, LiteratureState (new)
  format.ts                  numbers, ratios, RA/Dec, dates (from facts.ts + render.ts)
  facts.ts                   starFacts only
  state/                     useStarSearch, usePlaceName, useLiterature, useUrlSync (from App.tsx)
  lib/                       cache.ts (loadOnce, memoAsync), csv.ts
  i18n/                      index.tsx, en.ts, es.ts, ca.ts
  components/                React only; Figure.tsx gets its own file
  sky/                       astronomy + catalogue clients, no canvas
  names/                     unchanged
  dr4/                       epoch.ts, source.ts (data only)
  draw/                      theme.ts, canvas helpers, constellation, galaxy, hr, portrait, dr4 plots
  certificate/               render.ts (page layout only), download.ts
```

## 5. Plan

Each phase is behaviour-preserving and can be checked the same way: `npm test`, `npm run build`, then click through one search, one star, one certificate and one share in each language.

**Phase 0 — before 2 December (½ day).** DR4 post-release text (§3.5). Confirm the DataLink names on the day, using the checklist in `DATA_ACCESS.md`.

**Phase 1 — tidy-up, no structural change (½–1 day).**
1. Prettier + ESLint + `check` script + CI step (4.2).
2. Delete the 8 dead keys; fix the `Dialog` aria-label; remove or reword the history comments; fix the `hr.ts` reference.
3. `config.ts` (4.1), `types.ts` (S4), a single palette (D1), named constants (D9).
4. `scripts/requirements.txt`, `proxy/wrangler.toml`, `.nvmrc`/`engines`.

**Phase 2 — remove duplication, simplify state (1–1½ days).**
5. `lib/cache.ts` and `lib/csv.ts` (D2–D4); the GAVO query helper (D5); date helpers (D6–D7).
6. `format.ts` and `Figure.tsx` (S3).
7. Split `App.tsx` into hooks and render `StarCard` outside `Panel` (S1).
8. Split `i18n.tsx` (3.4).

**Phase 3 — optional, when someone next works on the visuals (1 day).**
9. Move canvas code into `draw/` (S2); give `drawConstellation` an options object.
10. Split `renderCertificate` into section functions; add `deps` to `CanvasArt`.

**Phase 4 — handover docs (2 hours).**
11. `ARCHITECTURE.md`: §2 of this review, the table below, and how to run, test, deploy and rebuild data.

## 6. "Where do I change…?" (for the new maintainer)

| I want to… | Today | After the refactor |
|---|---|---|
| Change map tiles or the geocoder | `SkyMap.tsx` (literal URL), `geo.ts` | `config.ts` |
| Switch the cone search to Gaia DR4 | `sky/gaia.ts` (`I/355/gaiadr3`, `gaia.dr3lite`, column names) | `config.ts` + the column mapping in `sky/gaia.ts` |
| Turn on real DR4 data | Deploy `proxy/worker.js`, build with `VITE_DR4_PROXY` | Same, plus `proxy/wrangler.toml` |
| Edit or translate text | `i18n.tsx` (all three languages in one 965-line file) | `i18n/es.ts` etc. |
| Change the certificate layout | `certificate/render.ts` (`renderCertificate`, one long function) | The relevant `draw…Section` function |
| Change colours | `styles.css` + `certificate/theme.ts` + `dr4/plots.ts` + inline copies | `styles.css` + `draw/theme.ts` |
| Change the search depths | `sky/gaia.ts` (cone constants) + `Panel.tsx` (`DEPTH_MAG`) + `i18n` hints | Same; consider one `DEPTHS` table holding all three |
| Rebuild the bundled data | `scripts/*.py` (dependencies in the docstrings) | `pip install -r scripts/requirements.txt` |
| Host somewhere other than GitHub Pages | `BASE_PATH=/ npm run build`, upload `dist/` | Unchanged |

## 7. What not to change

- **The static, backend-free design.** It's the main reason this is cheap to hand over.
- **`sky/zenith.ts`, `sky/time.ts`, `names/`, `dr4/epoch.ts` and their tests.** They are correct, verified against external references, and well commented. Move them if the layout changes, but don't rewrite them.
- **The word lists in `names/lexicon.ts`.** Their order *is* the encoding. Reordering or removing an entry silently renames every star. The file already says this; the new owner must be told too.
- **`docs/DATA_ACCESS.md`.** Keep it, and update its date when something changes.
