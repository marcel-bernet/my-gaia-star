/** Human-readable facts about a star, shared by the star card and the certificate. */
import { formatDec, formatNumber, formatRa, twoSigFigs } from './format';
import type { T } from './i18n';
import { classify } from './sky/classify';
import type { Star } from './sky/gaia';
import {
  distanceLy,
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

export interface Fact {
  label: string;
  value: string;
}

export function starFacts(star: Star, seenAt: Date, t: T, locale: string): Fact[] {
  const facts: Fact[] = [];
  const ly = distanceLy(star);
  facts.push({
    label: t('fact.distance'),
    value: ly === null ? t('fact.distance.unknown') : t('fact.distance.value', { ly: twoSigFigs(ly, locale) }),
  });
  const year = lightDepartureYear(star, seenAt);
  if (year !== null && ly !== null && ly < 20000) {
    facts.push({
      label: t('fact.light'),
      value:
        year > 0
          ? t('fact.light.value', { year: String(year) })
          : t('fact.light.valueBce', { year: formatNumber(Math.round((1 - year) / 10) * 10, locale) }),
    });
  }
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
