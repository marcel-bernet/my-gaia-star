/** Turning numbers, angles and dates into text, in the visitor's language. */

/** At most `digits` decimals: 8400, 14.8. */
export function formatNumber(n: number, locale: string, digits = 0): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

/** Two significant figures, with thousands separators for big numbers: 8,400 · 6.1 · 0.42. */
export function twoSigFigs(n: number, locale: string): string {
  if (n >= 100) return formatNumber(Number(n.toPrecision(2)), locale);
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }).format(n);
}

/** "2 December 2026", in the locale's own order. */
export function formatLongDate(d: Date, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** Right ascension: "7h 01m 15.2s". */
export function formatRa(raDeg: number): string {
  const h = raDeg / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}

/** Declination: "+41° 24′ 37″". */
export function formatDec(decDeg: number): string {
  const sign = decDeg < 0 ? '−' : '+';
  const a = Math.abs(decDeg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  return `${sign}${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}
