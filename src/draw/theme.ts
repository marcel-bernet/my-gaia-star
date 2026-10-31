/**
 * Colours and fonts for everything drawn on a <canvas>: the certificate, the
 * star card's figures and the DR4 plots. Canvas can't read CSS variables, so
 * these mirror the tokens at the top of src/styles.css; change both together.
 */
export const BG = '#0c0d0f'; // --bg
export const PLATE = '#08090b'; // --plate
export const GOLD = '#e8c98f'; // --star: reserved for the user's star
export const CREAM = '#e9e7e2'; // --text
export const MUTED = '#9a9993'; // secondary text on the certificate
export const FAINT = '#74736e'; // --text-3
export const RULE = 'rgba(233, 231, 226, 0.14)';

/** The small on-screen DR4 plots use the page's greys and a fainter rule. */
export const PLOT_MUTED = '#a4a39e'; // --text-2
export const PLOT_FAINT = '#6f6f6b';
export const PLOT_RULE = 'rgba(233, 231, 226, 0.12)';

export const SERIF = '"Source Serif 4 Variable", Georgia, serif';
export const SANS = '"IBM Plex Sans", system-ui, sans-serif';
export const MONO = '"IBM Plex Mono", ui-monospace, monospace';
