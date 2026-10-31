/**
 * Colours and fonts for everything drawn outside CSS: the canvas figures,
 * the certificate and the map's vector layers. Canvas can't read CSS
 * variables, so these mirror the tokens at the top of src/styles.css;
 * change both together.
 */

// Dark plates: the star card's figures, the DR4 plots, the certificate's figures.
export const PLATE = '#0b0c0e'; // --plate
export const SIGNAL = '#ff7a3d'; // your star, on a dark plate (--star, brightened for the dark ground)
export const CREAM = '#e9e7e2';
export const MUTED = '#9a9993';
export const FAINT = '#74736e';

/** The small on-screen DR4 plots use slightly fainter greys and rules. */
export const PLOT_MUTED = '#a4a39e';
export const PLOT_FAINT = '#6f6f6b';
export const PLOT_RULE = 'rgba(233, 231, 226, 0.12)';

// The sheet: the certificate page and the map.
export const SHEET = '#f3f4f1'; // --bg
export const INK = '#111316'; // --text
export const INK_2 = '#42464c'; // --text-2
export const INK_3 = '#5f646b'; // --text-3
export const INK_RULE = 'rgba(17, 19, 22, 0.3)'; // --rule-2
export const SIGNAL_INK = '#c23b00'; // --star: your star, on the sheet

// The map: the sky overhead is a plate laid over the paper map, see through enough to show the ground.
export const MAP_SKY_OPACITY = 0.9;
/** Constellation lines cross both the plate and the paper, so they take a grey that reads on each. */
export const MAP_LINE = '#8a8f96';

export const SANS = '"IBM Plex Sans", system-ui, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, monospace';
