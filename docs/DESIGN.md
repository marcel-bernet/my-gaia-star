# Design

My Gaia Star is set like one of Gaia's own engineering documents: a cool white sheet, black ink and hard rules. The real image is the star map, printed on the same sheet. The drawings are dark plates framed in ink, because they show the sky.

## Rules

- **Two typefaces, one family.** IBM Plex Mono for headings, labels and anything measured or catalogued (IDs, coordinates, magnitudes, figure numbers). IBM Plex Sans for anything you read at length: ledes, captions, hints, prose and the values in the measurements table. Canvas drawings and the certificate use the same fonts through `src/draw/theme.ts`.
- **One colour, and it means your star.** Orange (`--star`, `#c23b00` on the sheet, `SIGNAL` `#ff7a3d` on a dark plate) marks only the user's star: its name, its marker on the map and in every figure, and the "nobody has written about it" note. Never use it as a general accent. On the map, stars are ink and only yours is orange; each star's colour is shown in its card. In the DR4 section, a stand-in star from the pre-release is drawn in white (`EXAMPLE`), and only your star's own DR4 data is orange.
- **Rules, not boxes.** Black 1px rules separate sections, and hairlines separate rows. The only filled areas are the dark plates and the DR4 section, which shows a different kind of data. Corners are square.
- **One symbol.** The zenith crosshair (`ZenithMark`, the favicon, the map pin) is the site's only icon-like mark. Don't add decorative icons.
- **Uppercase mono is for labels.** Step labels, buttons, table labels and kickers. Sentences are never set in uppercase.
- **Motion is feedback.** Hover and selection, the spinner and the scroll to a new result. `prefers-reduced-motion` turns it off.

## The page, in three acts

1. **Ask.** One sentence and one button, *Find my star*. The place-and-moment form is a link away, and the search depth hides under *Advanced*. On phones the map stays hidden until there is something to show on it, so the words come first.
2. **Reveal.** The literature check is the headline ("No paper has singled out this star." in orange, or its SIMBAD name in ink), then three key facts as a ledger, then its Gaia number in words, then *Observation record* and *Share*.
3. **In detail.** The figures, the measurements table and the DR4 section, under their own heading.

Secondary things live in the footer: *Method & limitations*, *Find a star by its Gaia number*, *What's the point?*, *About*, and the author (linked to LinkedIn).

## Honest wording

The site says what the data supports and no more. The headline is the fact: "No paper has singled out this star" (true when SIMBAD has no entry). The claim beneath it is about human attention, not data: Gaia's software measured every star, but a person looks at one source only when it stands out. So the visitor is "almost certainly the first person to look at it on its own" when the star is fainter than G = 17, and "very likely" when it is brighter (`firstLookTier` in `src/facts.ts`; the reasoning is on the *Method & limitations* page). Distances carry their uncertainty. The pixel figure says it is a schematic. The words made from a Gaia number are an encoding, not a name: the IAU names stars, and no one can buy one, so the site never calls them names and the printable sheet is an *observation record*, not a certificate.

## The map

OSM tiles are turned grey by CSS and multiplied onto the sheet, so the map is printed on the page. The search circle is a dashed ink line.

Stars are drawn the way an engraved star chart draws them (`src/draw/mapStars.ts`): ink on the paper, in six size classes by G magnitude relative to the field, so most stars are small and a few bright ones stand out. Every star but the faintest sits in a soft ink glow that grows with brightness. The three brightest classes also carry four hairline diffraction spikes that fade towards their tips, as a telescope draws a bright star. Your star is drawn the same way in orange, under its reticle. Dots shrink with the circle on small screens (`dotScale`), and the readout shows a key drawn by the same `drawStar` (hidden on phones, where the map is short).

The stars are drawn by `StarMark` in `SkyMap.tsx`, a Leaflet `CircleMarker` that paints through `drawStar` and enlarges its repaint area to the glow and spikes. It uses Leaflet 1.9's canvas internals (the version is pinned), and it resets the shared canvas's alpha and dashes, which other layers leave behind.

Once a star is shown, **Hide the map** (in the masthead) turns the panel into one reading column, about 65 characters wide. Figures stay at most 480px wide there, because they are drawn 352 units wide and only get softer past that. A new search, or **Show on the map** for the constellation, brings the map back.

## The observation record

An A4 sheet in the same system (built in `src/certificate/`): a heavy rule at the top and bottom, the title in mono, the star's words in orange, the literature statement as a ruled note, and the drawings as dark plates framed in ink. Each drawing is clipped to its plate, so glows and labels can't smudge the paper. The sheet is mostly white so that it prints well.

## Not to do

Gradients, glows, blurred orbs, glass panels, rounded card grids, a background grid, crop marks around everything, a second accent colour, or any typeface outside Plex "because it's clean". Each detail should be something a Gaia document would have.
