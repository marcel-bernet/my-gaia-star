import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Result } from '../App';
import { drawGalaxyEdgeOn, drawGalaxyFaceOn, type GalaxyLabels } from '../certificate/galaxy';
import { drawStarPortrait } from '../certificate/panels';
import { formatRatio } from '../certificate/render';
import { CREAM, GOLD, MUTED } from '../certificate/theme';
import { starFacts } from '../facts';
import { useI18n, type Key } from '../i18n';
import { classify } from '../sky/classify';
import { constellationOf, drawConstellation, loadSkyChart, type SkyChartData } from '../sky/constellation';
import type { Star } from '../sky/gaia';
import { galacticHeightKpc, starColor, visibility } from '../sky/physics';
import { formatMoment } from '../sky/time';
import CanvasArt from './CanvasArt';

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
  const kind = useMemo(() => classify(star), [star]);
  const abbr = useMemo(() => constellationOf(star.ra, star.dec), [star]);
  const [sky, setSky] = useState<SkyChartData | null>(null);

  useEffect(() => {
    loadSkyChart().then(setSky, e => console.error(e));
  }, []);

  const drawPortrait = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) =>
      drawStarPortrait(ctx, { x: 0, y: 0, w, h }, star, kind, { sun: t('kind.sun'), star: t('chart.yourStar') }),
    [star, kind, t],
  );
  const galaxyLabels = useMemo<GalaxyLabels>(
    () => ({
      sun: t('cert.mw.sun'),
      yourStar: t('chart.yourStar'),
      centre: t('galaxy.centre'),
      scale: ly => t('fact.distance.value', { ly: new Intl.NumberFormat(lang).format(ly) }),
      stretched: x => t('galaxy.stretched', { x }),
      arm: name => t(`arm.${name}`),
    }),
    [t, lang],
  );
  const drawFaceOn = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => drawGalaxyFaceOn(ctx, { x: 0, y: 0, w, h }, star, galaxyLabels),
    [star, galaxyLabels],
  );
  const drawEdgeOn = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => drawGalaxyEdgeOn(ctx, { x: 0, y: 0, w, h }, star, galaxyLabels),
    [star, galaxyLabels],
  );
  const height = galacticHeightKpc(star);
  const drawChart = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (sky) {
        drawConstellation(ctx, { x: 0, y: 0, w, h }, sky, abbr, { ra: star.ra, dec: star.dec, label: t('chart.yourStar') }, {
          gold: GOLD,
          cream: CREAM,
          muted: MUTED,
          font: '"Inter Variable", system-ui, sans-serif',
          scale: 0.9,
        });
      }
    },
    [sky, abbr, star, t],
  );

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
          <h2>{kind ? t(`kind.${kind.kind}`) : t('fact.id')}</h2>
          <p className="star-id">
            {t('fact.id')} {star.id}
          </p>
        </div>
      </div>
      <div className="actions">
        <button className="secondary" onClick={onCertificate}>
          {t('action.certificate')}
        </button>
        <button className="secondary" onClick={share}>
          {copied ? t('action.copied') : t('action.share')}
        </button>
      </div>
      {kind && (
        <section className="card-section">
          <h3 className="label">{t('card.kind')}</h3>
          <CanvasArt width={340} height={130} draw={drawPortrait} label={t(`kind.${kind.kind}`)} />
          <p className="about">{kind.sure ? t(`kind.${kind.kind}.about` as Key) : t('kind.colourOnly')}</p>
          {kind.radiusSun !== null && <p className="hint">{t('kind.size', { x: formatRatio(kind.radiusSun, lang) })}</p>}
        </section>
      )}
      <section className="card-section">
        <h3 className="label">{t('card.where')}</h3>
        <p className="con-name">{sky ? sky.constellations[abbr].names[lang] : '…'}</p>
        <div className="chart-frame">
          <CanvasArt width={352} height={250} draw={drawChart} label={t('card.where')} />
        </div>
        <p className="hint">{`${t('fact.see')}: ${t(`see.${visibility(star)}`)}`}</p>
      </section>
      <section className="card-section">
        <h3 className="label">{t('card.galaxy')}</h3>
        <div className="galaxy-face">
          <CanvasArt width={300} height={300} draw={drawFaceOn} label={t('card.galaxy')} />
        </div>
        <CanvasArt width={352} height={84} draw={drawEdgeOn} label={t('cert.edge')} />
        <p className="hint">
          {height === null
            ? t('fact.height.unknown')
            : t(height >= 0 ? 'fact.height.above' : 'fact.height.below', { ly: formatRatio(Math.abs(height) * 3261.56, lang) })}
        </p>
      </section>
      <dl className="facts">
        {facts.map(f => (
          <div key={f.label}>
            <dt>{f.label}</dt>
            <dd>{f.value}</dd>
          </div>
        ))}
      </dl>
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
