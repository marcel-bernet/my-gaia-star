import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../i18n';
import { constellationOf, constellationOnGround, loadSkyChart, type SkyChartData } from '../sky/constellation';
import type { Star } from '../sky/gaia';
import type { Result } from '../types';

/** The selected star's constellation, laid on the ground at the size it spans in the sky (null when off). */
export function useConstellationOverlay(on: boolean, result: Result | null, selected: Star | null) {
  const { lang } = useI18n();
  const [sky, setSky] = useState<SkyChartData | null>(null);
  useEffect(() => {
    if (on && !sky) loadSkyChart().then(setSky, e => console.error(e));
  }, [on, sky]);
  return useMemo(() => {
    if (!on || !sky || !result || !selected) return null;
    const abbr = constellationOf(selected.ra, selected.dec);
    return { ...constellationOnGround(result.frame, sky, abbr), name: sky.constellations[abbr].names[lang] };
  }, [on, sky, result, selected, lang]);
}
