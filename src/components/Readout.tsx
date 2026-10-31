import type { Result } from '../types';
import { magnitudeScale, STAR_RADII } from '../draw/mapStars';
import { formatDec, formatRa } from '../format';
import { useI18n } from '../i18n';

/** The map's dot sizes, faintest to brightest, as drawn by SkyMap. */
function MagnitudeKey({ faintest, brightest, lang }: { faintest: number; brightest: number; lang: string }) {
  const nf = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const gap = 4;
  const xs = STAR_RADII.reduce<number[]>((acc, r, i) => [...acc, i ? acc[i - 1] + STAR_RADII[i - 1] + gap + r : r], []);
  const width = xs[xs.length - 1] + STAR_RADII[STAR_RADII.length - 1];
  const h = 2 * STAR_RADII[STAR_RADII.length - 1];
  return (
    <span className="mag-key">
      G {nf.format(faintest)}
      <svg width={width} height={h} viewBox={`0 0 ${width} ${h}`}>
        {STAR_RADII.map((r, i) => (
          <circle key={i} cx={xs[i]} cy={h / 2} r={r} fill="currentColor" />
        ))}
      </svg>
      {nf.format(brightest)}
    </span>
  );
}

/** Instrument-style readout over the map: where the zenith points, what was found there, and a key to the dot sizes. */
export default function Readout({ result }: { result: Result }) {
  const { t, lang } = useI18n();
  const { zenith } = result.frame;
  const scale = magnitudeScale(result.stars.map(s => s.g));
  return (
    <div className="readout mono" aria-hidden>
      <span>
        <b>{t('readout.zenith')}</b> {formatRa(zenith.ra)} {formatDec(zenith.dec)}
      </span>
      <span>{t('readout.sources', { n: new Intl.NumberFormat(lang).format(result.stars.length) })} · Gaia DR3</span>
      <MagnitudeKey faintest={scale.faintest} brightest={scale.brightest} lang={lang} />
    </div>
  );
}
