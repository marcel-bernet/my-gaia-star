/** Human-readable facts about a star, shared by the star card and the certificate. */
import { formatDec, formatNumber, formatRa, twoSigFigs, roundToError } from './format';
import type { T } from './i18n';
import { classify } from './sky/classify';
import type { Star } from './sky/gaia';
import {
  distanceLy,
  distanceLyError,
  galacticHeightKpc,
  lightDepartureYear,
  LY_PER_KPC,
  luminositySun,
  properMotion,
  spectralClass,
  temperature,
  visibility,
  vMagnitude,
} from './sky/physics';

/**
 * How sure the site is that a star no paper has singled out was never looked
 * at by anyone on its own. Gaia, like every large survey, processes its stars
 * automatically; a person looks at one source when it stands out, and that is
 * what lands it in a paper and in SIMBAD. Fainter than G = 17, where most of
 * Gaia's stars are, nothing makes anyone look: "almost certainly". Brighter
 * stars do get glanced at (finder charts, observing runs) without anything
 * being published: "very likely".
 */
export const UNSEEN_G = 17;
export function firstLookTier(star: Pick<Star, 'g'>): 'faint' | 'bright' {
  return star.g >= UNSEEN_G ? 'faint' : 'bright';
}

export interface Fact {
  label: string;
  value: string;
}

/** "2,700 ± 400 light-years", or why there is no distance. */
export function distanceText(star: Star, t: T, locale: string): string {
  const ly = distanceLy(star);
  if (ly === null) return t('fact.distance.unknown');
  const err = distanceLyError(star);
  if (err === null) return t('fact.distance.value', { ly: twoSigFigs(ly, locale) });
  const r = roundToError(ly, err);
  return t('fact.distance.valueErr', { ly: formatNumber(r.value, locale, r.digits), err: formatNumber(r.err, locale, r.digits) });
}

/**
 * When the light we see set off ("640 BCE"), rounded to the distance's
 * uncertainty, and that uncertainty in years (null when under a year).
 */
export function lightDeparture(star: Star, seenAt: Date, t: T, locale: string): { when: string; err: string | null } | null {
  const ly = distanceLy(star);
  const year = lightDepartureYear(star, seenAt);
  if (year === null || ly === null || ly >= 20000) return null;
  const err = distanceLyError(star);
  // Under a year of uncertainty (the nearest stars) the plain year says it all.
  const r = err && err >= 1 ? roundToError(year, err) : null;
  const y = r ? r.value : year;
  // Year 0 is 1 BCE; once rounded to the uncertainty that offset is noise.
  const bce = r ? Math.max(1, -y) : Math.round((1 - y) / 10) * 10;
  const when = y > 0 ? t('fact.light.value', { year: String(y) }) : t('fact.light.valueBce', { year: formatNumber(bce, locale) });
  return { when, err: r ? formatNumber(r.err, locale) : null };
}

/** "640 BCE, give or take 400 years". */
export function lightText(star: Star, seenAt: Date, t: T, locale: string): string | null {
  const l = lightDeparture(star, seenAt, t, locale);
  if (!l) return null;
  return l.err ? t('fact.light.err', { when: l.when, err: l.err }) : l.when;
}

export function starFacts(star: Star, seenAt: Date, t: T, locale: string): Fact[] {
  const facts: Fact[] = [];
  facts.push({ label: t('fact.distance'), value: distanceText(star, t, locale) });
  const light = lightText(star, seenAt, t, locale);
  if (light) facts.push({ label: t('fact.light'), value: light });
  const z = galacticHeightKpc(star);
  if (z !== null) {
    const ly = twoSigFigs(Math.abs(z) * LY_PER_KPC, locale);
    facts.push({ label: t('fact.height'), value: t(z >= 0 ? 'fact.height.above' : 'fact.height.below', { ly }) });
  }
  const temp = temperature(star);
  const kind = classify(star)?.kind;
  const cls = spectralClass(star, kind === 'giant' || kind === 'red-giant' || kind === 'supergiant' || kind === 'subgiant');
  if (temp !== null && cls) {
    facts.push({
      label: t('fact.colour'),
      value: t('fact.colour.value', { temp: formatNumber(Math.round(temp / 50) * 50, locale), cls }),
    });
  }
  facts.push({
    label: t('fact.brightness'),
    value: t('fact.brightness.value', { v: formatNumber(vMagnitude(star), locale, 1) }),
  });
  facts.push({ label: t('fact.see'), value: t(`see.${visibility(star)}`) });
  const lum = luminositySun(star);
  if (lum !== null)
    facts.push({ label: t('fact.luminosity'), value: t('fact.luminosity.value', { x: twoSigFigs(lum, locale) }) });
  const pm = properMotion(star);
  // 1° = 3.6 million mas: how long the star takes to drift one degree across the sky.
  if (pm !== null && pm > 0.05) {
    facts.push({
      label: t('fact.motion'),
      value: t('fact.motion.value', { pm: formatNumber(pm, locale, 1), years: twoSigFigs(3.6e6 / pm, locale) }),
    });
  }
  if (star.rv !== null) {
    facts.push({
      label: t('fact.rv'),
      value: t('fact.rv.value', {
        v: formatNumber(Math.abs(star.rv), locale, 1),
        dir: star.rv >= 0 ? t('fact.rv.away') : t('fact.rv.towards'),
      }),
    });
  }
  facts.push({ label: t('fact.position'), value: `${formatRa(star.ra)}  ${formatDec(star.dec)}` });
  return facts;
}
