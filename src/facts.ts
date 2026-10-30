/** Human-readable facts about a star, shared by the star card and the certificate. */
import type { T } from './i18n';
import { classify } from './sky/classify';
import type { Star } from './sky/gaia';
import {
  distanceLy,
  galacticHeightKpc,
  lightDepartureYear,
  luminositySun,
  properMotion,
  spectralClass,
  temperature,
  visibility,
  vMagnitude,
} from './sky/physics';

export interface Fact {
  label: string;
  value: string;
}

function fmt(locale: string, n: number, digits = 0) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
}

/** Two significant figures, with thousands separators for big numbers. */
function sig(locale: string, n: number) {
  if (n >= 100) return fmt(locale, Number(n.toPrecision(2)));
  return new Intl.NumberFormat(locale, { maximumSignificantDigits: 2 }).format(n);
}

export function formatRa(raDeg: number) {
  const h = raDeg / 15;
  const hh = Math.floor(h);
  const mm = Math.floor((h - hh) * 60);
  const ss = ((h - hh) * 60 - mm) * 60;
  return `${hh}h ${String(mm).padStart(2, '0')}m ${ss.toFixed(1).padStart(4, '0')}s`;
}

export function formatDec(decDeg: number) {
  const sign = decDeg < 0 ? '−' : '+';
  const a = Math.abs(decDeg);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = Math.round(((a - d) * 60 - m) * 60);
  return `${sign}${d}° ${String(m).padStart(2, '0')}′ ${String(s).padStart(2, '0')}″`;
}

export function starFacts(star: Star, seenAt: Date, t: T, locale: string): Fact[] {
  const facts: Fact[] = [];
  const ly = distanceLy(star);
  facts.push({
    label: t('fact.distance'),
    value: ly === null ? t('fact.distance.unknown') : t('fact.distance.value', { ly: sig(locale, ly) }),
  });
  const year = lightDepartureYear(star, seenAt);
  if (year !== null && ly !== null && ly < 20000) {
    facts.push({
      label: t('fact.light'),
      value:
        year > 0
          ? t('fact.light.value', { year: String(year) })
          : t('fact.light.valueBce', { year: fmt(locale, Math.round((1 - year) / 10) * 10) }),
    });
  }
  const z = galacticHeightKpc(star);
  if (z !== null) {
    const ly = sig(locale, Math.abs(z) * 3261.56);
    facts.push({ label: t('fact.height'), value: t(z >= 0 ? 'fact.height.above' : 'fact.height.below', { ly }) });
  }
  const temp = temperature(star);
  const kind = classify(star)?.kind;
  const cls = spectralClass(star, kind === 'giant' || kind === 'red-giant' || kind === 'supergiant' || kind === 'subgiant');
  if (temp !== null && cls) {
    facts.push({
      label: t('fact.colour'),
      value: t('fact.colour.value', { temp: fmt(locale, Math.round(temp / 50) * 50), cls }),
    });
  }
  facts.push({ label: t('fact.brightness'), value: t('fact.brightness.value', { v: fmt(locale, vMagnitude(star), 1) }) });
  facts.push({ label: t('fact.see'), value: t(`see.${visibility(star)}`) });
  const lum = luminositySun(star);
  if (lum !== null) facts.push({ label: t('fact.luminosity'), value: t('fact.luminosity.value', { x: sig(locale, lum) }) });
  const pm = properMotion(star);
  // 1° = 3.6 million mas: how long the star takes to drift one degree across the sky.
  if (pm !== null && pm > 0.05) {
    facts.push({
      label: t('fact.motion'),
      value: t('fact.motion.value', { pm: fmt(locale, pm, 1), years: sig(locale, 3.6e6 / pm) }),
    });
  }
  if (star.rv !== null) {
    facts.push({
      label: t('fact.rv'),
      value: t('fact.rv.value', {
        v: fmt(locale, Math.abs(star.rv), 1),
        dir: star.rv >= 0 ? t('fact.rv.away') : t('fact.rv.towards'),
      }),
    });
  }
  facts.push({ label: t('fact.position'), value: `${formatRa(star.ra)}  ${formatDec(star.dec)}` });
  return facts;
}
