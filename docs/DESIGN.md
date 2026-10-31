# Design

My Gaia Star should look like an observer's notebook set like a printed almanac, not like a product landing page. The site has one real image, the map with real stars on it. Everything else is type, rules and figures.

## Rules

- **Three typefaces, three jobs.** Source Serif 4 for anything you read: headlines, ledes, captions, hints, prose, values in the measurements table. IBM Plex Mono for anything measured or catalogued: IDs, coordinates, magnitudes, figure numbers, kickers. IBM Plex Sans only for things you press and short form labels. Plex Sans and Plex Mono are one family, so the site uses two voices, not three. Canvas drawings use the same fonts through `src/draw/theme.ts`.
- **Gold means your star.** `--star` is used only for the user's star: its name, its figure, the zenith mark, the "nobody has written about it" note. Never use it as a general accent.
- **Rules, not boxes.** Group things with hairlines, dotted leaders and left rules. The only filled surfaces are the plates that hold a drawing and the DR4 section, which is a different kind of data. Corners are square (`--radius: 2px`).
- **One symbol.** The zenith crosshair (`ZenithMark`, the favicon, the map pin) is the site's only icon-like mark. Don't add decorative icons.
- **Uppercase mono is for metadata only.** Kickers, badges and figure numbers. Form labels and step labels are ordinary sentence case.
- **Motion is feedback.** Hover and selection transitions, a spinner, the scroll to a new result. `prefers-reduced-motion` turns all of it off, and the spinner pulses instead.

## Decisions worth keeping

| Element | Looks like | Why |
|---|---|---|
| Landing numbers | A ledger: label, dotted leader, count | A row of big numbers is the start-up-metrics cliché, and it wrapped badly on phones |
| Search depth | One magnitude scale, the chosen limit marked on its rule | It is one quantity, brightest to faintest, not four products |
| Main action when disabled | An outline | A grey slab as the first thing a visitor sees reads as broken |
| "What's the point?" | An italic note in the margin | It is an aside, and the pill it replaced was the only rounded control |
| Star name | An unboxed epigraph with a hanging quote | It is the star's sentence; a box around it made it one card among others |

## Not to do

Gradients, glows, blurred orbs, glass panels, rounded card grids, a second accent colour, or Inter "because it's clean". The page should still read as a deliberate printed object with the CSS turned halfway off.
