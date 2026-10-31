import { useMemo, useState } from 'react';
import type { LiteratureState, Result } from '../types';
import { twoSigFigs } from '../format';
import { firstLookTier } from '../facts';
import { useI18n } from '../i18n';
import { starName } from '../names/name';
import { classify } from '../sky/classify';
import type { Star } from '../sky/gaia';
import { distanceLy } from '../sky/physics';
import { formatMoment } from '../sky/time';
import { urlFor } from '../urlState';
import Dialog from './Dialog';
import ShareTargets from './ShareTargets';

interface Props {
  star: Star;
  result: Result;
  placeName: string;
  literature: LiteratureState;
  onClose: () => void;
}

export default function ShareDialog({ star, result, placeName, literature, onClose }: Props) {
  const { t, lang } = useI18n();

  // Always pin the moment, so a friend opening the link later lands on this same star, not tonight's.
  const url = useMemo(
    () =>
      new URL(
        urlFor({ lat: result.place.lat, lon: result.place.lon, t: result.frame.date, depth: result.depth, star: star.id }),
        window.location.origin,
      ).href,
    [result, star.id],
  );

  const draft = useMemo(() => {
    const kind = classify(star);
    const ly = distanceLy(star);
    const what = kind ? t(`kind.${kind.kind}`) : t('share.aStar');
    const lines = [
      t('share.text.name', { name: starName(star.id, lang), id: star.id }),
      t(ly === null ? 'share.text.what' : 'share.text.whatFar', {
        what,
        ly: ly === null ? '' : twoSigFigs(ly, lang),
        place: placeName,
        moment: formatMoment(result.frame.date, result.zone, lang),
      }),
    ];
    if (literature && typeof literature === 'object') {
      lines.push(
        literature.known ? t('share.text.known', { name: literature.name }) : t(`share.text.unknown.${firstLookTier(star)}`),
      );
    }
    lines.push(t('share.text.cta'));
    return lines.join('\n');
  }, [star, result, placeName, literature, t, lang]);

  // Edits are kept until the draft itself changes (new language, SIMBAD answer…).
  const [edited, setEdited] = useState<{ from: string; text: string } | null>(null);
  const text = edited && edited.from === draft ? edited.text : draft;

  return (
    <Dialog title={t('share.title')} onClose={onClose}>
      <div className="share">
        <label className="field">
          <span className="label">{t('share.message')}</span>
          <textarea value={text} rows={8} onChange={e => setEdited({ from: draft, text: e.target.value })} />
        </label>
        <p className="share-url mono">{url}</p>

        <ShareTargets
          text={text}
          url={url}
          subject={t('share.subject')}
          copy={{ value: `${text}\n${url}`, label: t('share.copy') }}
        />
      </div>
    </Dialog>
  );
}
