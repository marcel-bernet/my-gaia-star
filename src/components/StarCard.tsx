import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import type { Literature } from '../sky/simbad';
import { galacticHeightKpc, starColor, visibility } from '../sky/physics';
import { formatMoment } from '../sky/time';
import CanvasArt from './CanvasArt';
import Dr4Section from './Dr4Section';

interface Props {
  star: Star;
  result: Result;
  placeName: string | null;
  literature: Literature | 'loading' | 'error' | null;
  onBackToZenith: () => void;
  onCertificate: () => void;
}

export function Figure({ n, title, children, caption }: { n: number; title: string; children: ReactNode; caption?: ReactNode }) {
  const { t } = useI18n();
  return (
    <figure className="fig">
      <figcaption className="fig-title">
        <span className="fig-num mono">{t('fig', { n })}</span> {title}
      </figcaption>
      {children}
      {caption && <p className="fig-caption">{caption}</p>}
    </figure>
  );
}

function FirstLook({ literature, id }: { literature: Props['literature']; id: string }) {
  const { t } = useI18n();
  if (literature === null || literature === 'loading') {
    return (
      <div className="first-look pending" aria-live="polite">
        <span className="spinner" aria-hidden /> {t('first.checking')}
      </div>
    );
  }
  if (literature === 'error') {
    return <div className="first-look pending">{t('first.error')}</div>;
  }
  if (!literature.known) {
    return (
      <div className="first-look unknown" aria-live="polite">
        <p className="badge mono">{t('first.badge')}</p>
        <p className="first-title">{t('first.unknown.title')}</p>
        <p className="first-body">{t('first.unknown.body')}</p>
      </div>
    );
  }
  const papers = literature.papers === 1 ? t('papers.one') : t('papers.many', { n: literature.papers });
  return (
    <div className="first-look known" aria-live="polite">
      <p className="first-title">{t('first.known.title', { name: literature.name })}</p>
      <p className="first-body">
        {t('first.known.body', { papers })}{' '}
        <a href={`https://simbad.cds.unistra.fr/simbad/sim-id?Ident=${encodeURIComponent(`Gaia DR3 ${id}`)}`} target="_blank" rel="noreferrer">
          SIMBAD ↗
        </a>
      </p>
    </div>
  );
}

export default function StarCard({ star, result, placeName, literature, onBackToZenith, onCertificate }: Props) {
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

  // Bring a fresh result into view (the panel scrolls on desktop, the page on phones).
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
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

  let fig = 0;
  return (
    <article className="dossier" ref={ref}>
      <header className="dossier-head">
        <p className="kicker">
          {isZenith ? t('result.zenith') : t('result.selected')} · {t('result.count', { n: result.stars.length, place: where })}
        </p>
        <div className="star-head">
          <span className="swatch" style={{ background: starColor(star) }} aria-hidden />
          <h2>{kind ? t(`kind.${kind.kind}`) : t('fact.id')}</h2>
        </div>
        <p className="star-id mono">
          {t('fact.id')} {star.id}
        </p>
        <p className="moment">{formatMoment(result.frame.date, result.zone, lang)}</p>
      </header>

      <FirstLook literature={literature} id={star.id} />

      <div className="actions">
        <button className="primary" onClick={onCertificate}>
          {t('action.certificate')}
        </button>
        <button className="secondary" onClick={share}>
          {copied ? t('action.copied') : t('action.share')}
        </button>
      </div>

      {kind && (
        <Figure
          n={++fig}
          title={t('card.kind')}
          caption={
            <>
              {kind.sure ? t(`kind.${kind.kind}.about` as Key) : t('kind.colourOnly')}
              {kind.radiusSun !== null && <> {t('kind.size', { x: formatRatio(kind.radiusSun, lang) })}.</>}
            </>
          }
        >
          <CanvasArt width={340} height={130} draw={drawPortrait} label={t(`kind.${kind.kind}`)} />
        </Figure>
      )}

      <Figure n={++fig} title={`${t('card.where')} — ${sky ? sky.constellations[abbr].names[lang] : '…'}`} caption={`${t('fact.see')}: ${t(`see.${visibility(star)}`)}.`}>
        <div className="plate">
          <CanvasArt width={352} height={250} draw={drawChart} label={t('card.where')} />
        </div>
      </Figure>

      <Figure
        n={++fig}
        title={t('card.galaxy')}
        caption={
          height === null
            ? t('fact.height.unknown')
            : t(height >= 0 ? 'fact.height.above' : 'fact.height.below', { ly: formatRatio(Math.abs(height) * 3261.56, lang) })
        }
      >
        <div className="plate">
          <div className="galaxy-face">
            <CanvasArt width={300} height={300} draw={drawFaceOn} label={t('card.galaxy')} />
          </div>
          <CanvasArt width={352} height={84} draw={drawEdgeOn} label={t('cert.edge')} />
        </div>
      </Figure>

      <section className="table-block">
        <h3 className="fig-title">
          <span className="fig-num mono">{t('table', { n: 1 })}</span> {t('table.measurements')}
        </h3>
        <dl className="facts">
          {facts.map(f => (
            <div key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Dr4Section star={star} firstFig={fig + 1} />

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
