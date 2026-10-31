/**
 * Everything a host or maintainer is likely to change, in one place: the
 * external services the site talks to, where the code lives, and the DR4
 * release settings. See docs/DATA_ACCESS.md for each service's limits.
 *
 * Build-time settings come from environment variables:
 *   BASE_PATH       URL path the site is served from (vite.config.ts; default /my-gaia-star/)
 *   VITE_DR4_PROXY  base URL of the DR4 epoch-data proxy (proxy/worker.js); unset = preview data only
 */

/** The author, linked from the footer. */
export const AUTHOR_URL = 'https://es.linkedin.com/in/marcel-bernet-marti';

/** Source code. Not linked from the site for now; kept so the link is easy to put back. */
export const REPO_URL = 'https://github.com/marcel-bernet/my-gaia-star';

export const SERVICES = {
  /** Gaia DR3 cone search (CDS VizieR ASU), tried first. */
  vizier: 'https://vizier.cds.unistra.fr/viz-bin/asu-tsv',
  /** Gaia DR3 via GAVO TAP (Heidelberg), used when VizieR is down. */
  gavoTap: 'https://dc.g-vo.org/tap/sync',
  /**
   * SIMBAD TAP: has anyone written about this star? Strasbourg first, then
   * the CfA mirror (same database, also with CORS) when CDS is down.
   */
  simbadTap: ['https://simbad.cds.unistra.fr/simbad/sim-tap/sync', 'https://simbad.harvard.edu/simbad/sim-tap/sync'],
  /** Place search and reverse geocoding. Limited to 1 request/s for the whole site. */
  nominatim: 'https://nominatim.openstreetmap.org',
  /** Map tiles. Swap for a provider with a free tier before a big launch (DATA_ACCESS.md §2). */
  tiles: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tilesAttribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/** A star's page in SIMBAD, looked up by its Gaia DR3 identifier. */
export const simbadUrl = (gaiaDr3Id: string) =>
  `https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(`Gaia DR3 ${gaiaDr3Id}`)}`;

/** Gaia DR4 publication: 2 December 2026, about 12:00 CET. */
export const DR4_RELEASE = new Date('2026-12-02T11:00:00Z');

/** Base URL of the DR4 epoch-data proxy, if this build has one. */
export const DR4_PROXY: string | undefined = import.meta.env.VITE_DR4_PROXY;
