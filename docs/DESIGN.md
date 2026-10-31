# Design

My Gaia Star is set like one of Gaia's own engineering documents: a cool white sheet, black ink and hard rules. The real image is the star map, printed on the same sheet. The drawings are dark plates framed in ink, because they show the sky.

## Rules

- **Two typefaces, one family.** IBM Plex Mono for headings, labels and anything measured or catalogued (IDs, coordinates, magnitudes, figure numbers). IBM Plex Sans for anything you read at length: ledes, captions, hints, prose and the values in the measurements table. Canvas drawings and the certificate use the same fonts through `src/draw/theme.ts`.
- **One colour, and it means your star.** Orange (`--star`, `#c23b00` on the sheet, `SIGNAL` `#ff7a3d` on a dark plate) marks only the user's star: its name, its marker on the map and in every figure, and the "nobody has written about it" note. Never use it as a general accent. Star colours on the map are data (temperature), not decoration.
- **Rules, not boxes.** Black 1px rules separate sections, and hairlines separate rows. The only filled areas are the dark plates and the DR4 section, which shows a different kind of data. Corners are square.
- **One symbol.** The zenith crosshair (`ZenithMark`, the favicon, the map pin) is the site's only icon-like mark. Don't add decorative icons.
- **Uppercase mono is for labels.** Step labels, buttons, table labels and kickers. Sentences are never set in uppercase.
- **Motion is feedback.** Hover and selection, the spinner and the scroll to a new result. `prefers-reduced-motion` turns it off.

## The map

OSM tiles are turned grey by CSS and multiplied onto the sheet, so the map is printed on the page rather than set in a window. Stars keep their real colour inside a thin ink outline, so pale stars still show on white. The search circle and the constellation are drawn in ink, and only your star's reticle is orange. Colours for the vector layers live in `theme.ts` (`INK`, `INK_3`).

Once a star is shown, **Hide the map** (in the masthead) turns the panel into one reading column, about 65 characters wide. Figures stay at most 480px wide there, because they are drawn 352 units wide and only get softer past that. A new search, or **Show on the map** for the constellation, brings the map back.

## The certificate

An A4 sheet in the same system: a heavy rule at the top and bottom, the title in mono, the star's name in orange, the literature statement as a ruled note, and the drawings as dark plates framed in ink. Each drawing is clipped to its plate, so glows and labels can't smudge the paper. The sheet is mostly white so that it prints well.

## Not to do

Gradients, glows, blurred orbs, glass panels, rounded card grids, a background grid, crop marks around everything, a second accent colour, or any typeface outside Plex "because it's clean". Each detail should be something a Gaia document would have.
