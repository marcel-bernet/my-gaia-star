import { useEffect, useRef, useState } from 'react';
import type { Result } from '../App';
import { starFacts } from '../facts';
import { useI18n } from '../i18n';
import type { Star } from '../sky/gaia';
import { starColor } from '../sky/physics';
import { formatMoment } from '../sky/time';

interface Props {
  star: Star;
  result: Result;
  placeName: string | null;
  onBackToZenith: () => void;
  onCertificate: () => void;
}

export default function StarCard({ star, result, placeName, onBackToZenith, onCertificate }: Props) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const isZenith = star.id === result.zenithId;
  const facts = starFacts(star, result.frame.date, t, lang);
  const where = placeName || t('place.unnamed');
  const ref = useRef<HTMLElement>(null);

  // Bring a fresh result into view inside the scrolling panel.
  // Waits out the bottom sheet's height transition on phones.
  useEffect(() => {
    const id = setTimeout(() => {
      const card = ref.current;
      const body = card?.closest('.panel-body') as HTMLElement | null;
      if (card && body) body.scrollTo({ top: card.offsetTop - body.offsetTop - 8, behavior: 'smooth' });
    }, 320);
    return () => clearTimeout(id);
  }, [result, star.id]);

  const share = async () => {
    const url = window.location.href;
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: t('tagline'), url }).catch(() => {});
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <article className="star-card" ref={ref}>
      <p className="meta">
        {t('result.count', { n: result.stars.length, place: where })}
        <br />
        {formatMoment(result.frame.date, result.zone, lang)}
      </p>
      <div className="star-head">
        <span className="swatch" style={{ background: starColor(star), boxShadow: `0 0 18px ${starColor(star)}` }} />
        <div>
          <p className="eyebrow">{isZenith ? t('result.zenith') : t('result.selected')}</p>
          <h2>{t('fact.id')}</h2>
          <p className="star-id">{star.id}</p>
        </div>
      </div>
      <dl className="facts">
        {facts.map(f => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
      <div className="actions">
        <button className="secondary" onClick={onCertificate}>
          {t('action.certificate')}
        </button>
        <button className="secondary" onClick={share}>
          {copied ? t('action.copied') : t('action.share')}
        </button>
      </div>
      <div className="actions small">
        {!isZenith && (
          <button className="link" onClick={onBackToZenith}>
            ← {t('result.backToZenith')}
          </button>
        )}
        <a className="link" href={`https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(`Gaia DR3 ${star.id}`)}`} target="_blank" rel="noreferrer">
          {t('action.simbad')} ↗
        </a>
      </div>
      <p className="hint">{t('result.tapHint')}</p>
    </article>
  );
}
