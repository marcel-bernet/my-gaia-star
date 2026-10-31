import type { Result } from '../types';
import { useEffect, useRef } from 'react';
import { drawStar, magnitudeScale, STAR_RADII, starExtent } from '../draw/mapStars';
import { INK } from '../draw/theme';
import { formatDec, formatRa } from '../format';
import { useI18n } from '../i18n';

// The key draws the signs at 60%, spaced by their dots so glows and spikes may overlap a little.
const KEY_K = 0.6;
const KEY_R = STAR_RADII.map(r => r * KEY_K);
const KEY_X = KEY_R.reduce<number[]>((xs, r, i) => [...xs, i ? xs[i - 1] + KEY_R[i - 1] + 9 + r : 0], []);
// Room for the faintest sign on the left and the brightest one's spikes on the right.
const KEY_LEFT = starExtent(0, KEY_K);
const KEY_PAD = starExtent(STAR_RADII.length - 1, KEY_K);
const KEY_W = KEY_LEFT + KEY_X[KEY_X.length - 1] + KEY_PAD;
const KEY_H = 2 * KEY_PAD;

/** The map's star signs, faintest to brightest, drawn by the same function as the map. */
function MagnitudeKey({ faintest, brightest, lang }: { faintest: number; brightest: number; lang: string }) {
  const nf = new Intl.NumberFormat(lang, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = KEY_W * dpr;
    c.height = KEY_H * dpr;
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    KEY_X.forEach((x, cls) => drawStar(ctx, KEY_LEFT + x, KEY_H / 2, cls, KEY_K, INK));
  }, []);
  return (
    <span className="mag-key">
      G {nf.format(faintest)}
      <canvas ref={ref} style={{ width: KEY_W, height: KEY_H }} />
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
