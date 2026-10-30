import type { Result } from '../types';
import { formatDec, formatRa } from '../facts';
import { useI18n } from '../i18n';

/** Instrument-style readout over the map: where the zenith points and what was found there. */
export default function Readout({ result }: { result: Result }) {
  const { t, lang } = useI18n();
  const { zenith } = result.frame;
  return (
    <div className="readout mono" aria-hidden>
      <span>
        <b>{t('readout.zenith')}</b> {formatRa(zenith.ra)} {formatDec(zenith.dec)}
      </span>
      <span>{t('readout.sources', { n: new Intl.NumberFormat(lang).format(result.stars.length) })} · Gaia DR3</span>
    </div>
  );
}
