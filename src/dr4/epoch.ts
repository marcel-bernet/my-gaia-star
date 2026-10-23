/**
 * Gaia DR4 epoch astrometry: every time Gaia's telescopes swept over a star,
 * one along-scan position per CCD it crossed.
 *
 * The same shape comes from two places: the June 2026 pre-release bundled
 * with the site (public/dr4-preview.json, built by scripts/dr4_prerelease.py),
 * and — once DR4 is public — ESA's DataLink VOTables, parsed here.
 *
 * What a measurement is: `w`, the star's offset in milliarcseconds from a
 * fixed reference point (ra0, dec0), measured *along the scan direction*
 * only. The scan direction has position angle `psi` (from north through
 * east), so  w ≈ Δα*·sin ψ + Δδ·cos ψ.  The across-scan position is ~100×
 * less precise and is not used.
 */
import { Body, HelioVector } from 'astronomy-engine';

export interface Ccd {
  /** Years since J2010.0 (TCB), i.e. 2010 + year fraction gives the calendar year. */
  t: number;
  /** Scan position angle, degrees. */
  psi: number;
  /** Along-scan offset from (ra0, dec0) and its standard error, mas. */
  w: number;
  e: number;
  /** Used by Gaia's astrometric solution (AGIS). */
  used: boolean;
}

export interface Transit {
  id: string;
  g: number | null;
  /** Window class: 0–1 = 2-D windows (G < 13), 2 = 1-D (13–16), 3 = short 1-D (G > 16). */
  gClass: number;
  /** Along-scan parallax factor. */
  pf: number;
  ccds: Ccd[];
}

export interface EpochAstrometry {
  sourceId: string;
  ra0: number;
  dec0: number;
  transits: Transit[];
}

const NS_PER_YEAR = 365.25 * 86400e9;
/** Middle of the DR4 data (mid-2014 to early 2020). */
export const REF_YEAR = 2017.5;

export const calendarYear = (t: number) => 2010 + t;

/** ns since J2010.0 as a decimal string (too large for a double to hold exactly). */
function nsToYears(ns: string | bigint): number {
  const b = BigInt(ns);
  const whole = b / 1_000_000_000n;
  const frac = Number(b % 1_000_000_000n) / 1e9;
  return (Number(whole) + frac) / (NS_PER_YEAR / 1e9);
}

// --- Preview JSON -----------------------------------------------------------

export interface PreviewTransit {
  id: string;
  g: number | null;
  gClass: number;
  pf: number;
  t0: string;
  dt: number[];
  psi: number[];
  w: (number | null)[];
  e: (number | null)[];
  used: number[];
}

export interface PreviewSource {
  id: string;
  name: string | null;
  group: 'parallax' | 'magnitude' | 'qso' | 'orbit';
  ra0: number;
  dec0: number;
  transits: PreviewTransit[];
}

export function fromPreview(s: PreviewSource): EpochAstrometry {
  return {
    sourceId: s.id,
    ra0: s.ra0,
    dec0: s.dec0,
    transits: s.transits.map(tr => {
      const t0 = nsToYears(tr.t0);
      return {
        id: tr.id,
        g: tr.g,
        gClass: tr.gClass,
        pf: tr.pf,
        ccds: tr.dt.map((dt, i) => ({
          t: t0 + dt / 1000 / (NS_PER_YEAR / 1e9),
          psi: tr.psi[i],
          w: tr.w[i] ?? NaN,
          e: tr.e[i] ?? NaN,
          used: tr.used[i] === 1,
        })),
      };
    }),
  };
}

// --- VOTable (BINARY2 / BINARY) --------------------------------------------

interface Field {
  name: string;
  datatype: string;
  variable: boolean;
  fixed: number;
}

const SIZES: Record<string, number> = {
  boolean: 1, unsignedByte: 1, char: 1, short: 2, int: 4, long: 8, float: 4, double: 8,
};

function readValue(v: DataView, p: number, type: string): number | bigint | boolean | string {
  switch (type) {
    case 'boolean': {
      const c = String.fromCharCode(v.getUint8(p));
      return c === 'T' || c === 't' || c === '1';
    }
    case 'unsignedByte': return v.getUint8(p);
    case 'char': return String.fromCharCode(v.getUint8(p));
    case 'short': return v.getInt16(p);
    case 'int': return v.getInt32(p);
    case 'long': return v.getBigInt64(p);
    case 'float': return v.getFloat32(p);
    case 'double': return v.getFloat64(p);
  }
  throw new Error(`VOTable datatype ${type} not supported`);
}

/** Rows of a binary-serialised VOTable, as plain objects (arrays for array fields). */
export function parseVotableRows(xml: string): Record<string, unknown>[] {
  // Plain string parsing rather than DOMParser, so this also runs in tests (Node).
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1] ?? null;
  const fields: Field[] = [...xml.matchAll(/<FIELD\b[^>]*>/g)].map(([tag]) => {
    const size = attr(tag, 'arraysize');
    return {
      name: attr(tag, 'name')!,
      datatype: attr(tag, 'datatype')!,
      variable: !!size && size.endsWith('*'),
      fixed: size && !size.endsWith('*') ? Number(size) : 1,
    };
  });
  const m = xml.match(/<(BINARY2?)>\s*<STREAM[^>]*>([\s\S]*?)<\/STREAM>/);
  if (!m) throw new Error('VOTable has no binary STREAM');
  const binary2 = m[1] === 'BINARY2';
  const b64 = m[2].replace(/\s+/g, '');
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const mask = binary2 ? Math.ceil(fields.length / 8) : 0;

  const rows: Record<string, unknown>[] = [];
  let p = 0;
  while (p < bytes.length) {
    const nulls = bytes.subarray(p, p + mask);
    p += mask;
    const row: Record<string, unknown> = {};
    fields.forEach((f, i) => {
      const n = f.variable ? view.getInt32(p) : f.fixed;
      if (f.variable) p += 4;
      const size = SIZES[f.datatype];
      const values = Array.from({ length: n }, (_, k) => readValue(view, p + k * size, f.datatype));
      p += n * size;
      const isNull = binary2 && (nulls[i >> 3] >> (7 - (i & 7))) & 1;
      row[f.name] = isNull ? null : f.variable || n > 1 ? (f.datatype === 'char' ? values.join('') : values) : values[0];
    });
    rows.push(row);
  }
  return rows;
}

/** DR4 `epoch_astrometry` VOTable → one EpochAstrometry per source in it. */
export function fromVotable(xml: string): EpochAstrometry[] {
  const bySource = new Map<string, EpochAstrometry>();
  for (const r of parseVotableRows(xml)) {
    const id = String(r.source_id);
    let s = bySource.get(id);
    if (!s) {
      s = { sourceId: id, ra0: r.ra0 as number, dec0: r.dec0 as number, transits: [] };
      bySource.set(id, s);
    }
    const times = r.obs_time_tcb as bigint[];
    const psi = r.scan_pos_angle as number[];
    const w = r.centroid_pos_al as number[];
    const e = r.centroid_pos_error_al as number[];
    const used = r.used_by_agis_al as boolean[];
    s.transits.push({
      id: String(r.transit_id),
      g: (r.g_mag as number) ?? null,
      gClass: r.g_class as number,
      pf: r.parallax_factor_al as number,
      ccds: times.map((ns, i) => ({ t: nsToYears(ns), psi: psi[i], w: w[i], e: e[i], used: used[i] })),
    });
  }
  for (const s of bySource.values()) s.transits.sort((a, b) => a.ccds[0].t - b.ccds[0].t);
  return [...bySource.values()];
}

// --- Five-parameter fit ------------------------------------------------------

export interface Fit {
  /** Offset of the star at REF_YEAR from (ra0, dec0), mas. */
  dRa: number;
  dDec: number;
  parallax: number;
  pmRa: number;
  pmDec: number;
  /** Standard errors, same order and units. */
  errors: [number, number, number, number, number];
  /** RMS along-scan residual over the CCDs used, mas. */
  rms: number;
  /** sqrt(χ²/dof): ~1 for a single star that fits; larger hints at a companion. */
  uwe: number;
  nUsed: number;
}

/** Along-scan offset predicted by fit `f` at time t (years since J2010) and angle psi (deg), mas. */
export function predictAl(f: Pick<Fit, 'dRa' | 'dDec' | 'parallax' | 'pmRa' | 'pmDec'>, t: number, psi: number, pf: number) {
  const s = Math.sin((psi * Math.PI) / 180);
  const c = Math.cos((psi * Math.PI) / 180);
  const tau = calendarYear(t) - REF_YEAR;
  return s * (f.dRa + f.pmRa * tau) + c * (f.dDec + f.pmDec * tau) + pf * f.parallax;
}

/** Weighted least squares of position, parallax and proper motion — Gaia's "5-parameter" model. */
export function fitFiveParameters(ea: EpochAstrometry): Fit | null {
  const N = Array.from({ length: 5 }, () => new Array<number>(5).fill(0));
  const b = new Array<number>(5).fill(0);
  const rows: { a: number[]; w: number; e: number }[] = [];
  for (const tr of ea.transits) {
    for (const c of tr.ccds) {
      if (!c.used || !Number.isFinite(c.w) || !(c.e > 0)) continue;
      const s = Math.sin((c.psi * Math.PI) / 180);
      const co = Math.cos((c.psi * Math.PI) / 180);
      const tau = calendarYear(c.t) - REF_YEAR;
      const a = [s, co, tr.pf, s * tau, co * tau];
      rows.push({ a, w: c.w, e: c.e });
      const wt = 1 / (c.e * c.e);
      for (let i = 0; i < 5; i++) {
        b[i] += a[i] * c.w * wt;
        for (let j = 0; j < 5; j++) N[i][j] += a[i] * a[j] * wt;
      }
    }
  }
  if (rows.length < 10) return null;
  const inv = invert(N);
  if (!inv) return null;
  const x = inv.map(r => r.reduce((sum, v, j) => sum + v * b[j], 0));
  let ss = 0;
  let chi2 = 0;
  for (const r of rows) {
    const res = r.w - r.a.reduce((sum, v, j) => sum + v * x[j], 0);
    ss += res * res;
    chi2 += (res / r.e) ** 2;
  }
  return {
    dRa: x[0],
    dDec: x[1],
    parallax: x[2],
    pmRa: x[3],
    pmDec: x[4],
    errors: inv.map((r, i) => Math.sqrt(r[i])) as Fit['errors'],
    rms: Math.sqrt(ss / rows.length),
    uwe: Math.sqrt(chi2 / (rows.length - 5)),
    nUsed: rows.length,
  };
}

function invert(m: number[][]): number[][] | null {
  const n = m.length;
  const a = m.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    if (Math.abs(a[piv][col]) < 1e-300) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    const d = a[col][col];
    for (let j = 0; j < 2 * n; j++) a[col][j] /= d;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f) for (let j = 0; j < 2 * n; j++) a[r][j] -= f * a[col][j];
    }
  }
  return a.map(r => r.slice(n));
}

// --- Per-transit summary -----------------------------------------------------

export interface TransitPoint {
  id: string;
  /** Calendar year (decimal). */
  year: number;
  psi: number;
  pf: number;
  /** Weighted mean along-scan offset of the CCDs used, and its error, mas. */
  w: number;
  e: number;
  nCcd: number;
  nUsed: number;
  gClass: number;
}

/** One point per transit (CCDs averaged), the way the plots show them. */
export function transitPoints(ea: EpochAstrometry): TransitPoint[] {
  return ea.transits.flatMap(tr => {
    const ok = tr.ccds.filter(c => c.used && Number.isFinite(c.w) && c.e > 0);
    if (ok.length === 0) return [];
    let sw = 0;
    let s = 0;
    let st = 0;
    let sp = 0;
    for (const c of ok) {
      const wt = 1 / (c.e * c.e);
      sw += wt;
      s += c.w * wt;
      st += c.t;
      sp += c.psi;
    }
    return [
      {
        id: tr.id,
        year: calendarYear(st / ok.length),
        psi: sp / ok.length,
        pf: tr.pf,
        w: s / sw,
        e: 1 / Math.sqrt(sw),
        nCcd: tr.ccds.length,
        nUsed: ok.length,
        gClass: tr.gClass,
      },
    ];
  });
}

// --- Parallax ellipse --------------------------------------------------------

/**
 * Where a star at (ra, dec) appears displaced by one milliarcsecond of
 * parallax at a given moment, as (east, north) components. Uses the Earth's
 * barycentric position; Gaia, at L2, is 1% further out — invisible in a plot.
 */
export function parallaxDisplacement(raDeg: number, decDeg: number, year: number): { e: number; n: number } {
  const date = new Date(Date.UTC(2000, 0, 1, 12) + (year - 2000) * 365.25 * 86400e3);
  const sun = HelioVector(Body.SSB, date);
  const earthHelio = HelioVector(Body.Earth, date);
  // Earth relative to the barycentre, equatorial J2000, AU.
  const X = earthHelio.x - sun.x;
  const Y = earthHelio.y - sun.y;
  const Z = earthHelio.z - sun.z;
  const a = (raDeg * Math.PI) / 180;
  const d = (decDeg * Math.PI) / 180;
  return {
    e: X * Math.sin(a) - Y * Math.cos(a),
    n: X * Math.cos(a) * Math.sin(d) + Y * Math.sin(a) * Math.sin(d) - Z * Math.cos(d),
  };
}
