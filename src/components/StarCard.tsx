import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Result } from '../App';
import { drawGalaxyEdgeOn, drawGalaxyFaceOn, type GalaxyLabels } from '../certificate/galaxy';
import { drawStarPortrait } from '../certificate/panels';
import { formatRatio } from '../certificate/render';
import { CREAM, GOLD, MUTED } from '../certificate/theme';
import { starFacts } from '../facts';
import { starName } from '../names/name';
import { useI18n, type Key } from '../i18n';
import { classify } from '../sky/classify';
import { constellationOf, drawConstellation, loadSkyChart, type ChartGround, type SkyChartData } from '../sky/constellation';
import { countryAt, loadCountries, type Country } from '../sky/country';
import { groundToSky } from '../sky/zenith';
import type { Star } from '../sky/gaia';
import type { Literature } from '../sky/simbad';
import { galacticHeightKpc, starColor, visibility } from '../sky/physics';
import { formatMoment } from '../sky/time';
import CanvasArt from './CanvasArt';
import Dr4Section from './Dr4Section';
import NameDialog from './NameDialog';
import ShareDialog from './ShareDialog';

interface Props {
  star: Star;
  result: Result;
  placeName: string | null;
  literature: Literature | 'loading' | 'error' | null;
  onBackToZenith: () => void;
  onMap: boolean;
  onToggleMap: () => void;
  onCertificate: () => void;
}

export function Figure({
  n,
  title,
  children,
  caption,
  kicker,
  className,
}: {
  n: number;
  title: string;
  children: ReactNode;
  caption?: ReactNode;
  kicker?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <figure className={className ? `fig ${className}` : 'fig'}>
      {kicker && <p className="badge mono">{kicker}</p>}
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

export default function StarCard({ star, result, placeName, literature, onBackToZenith, onMap, onToggleMap, onCertificate }: Props) {
  const { t, lang } = useI18n();
  const [sharing, setSharing] = useState(false);
  const isZenith = star.id === result.zenithId;
  const facts = starFacts(star, result.frame.date, t, lang);
  const where = placeName || t('place.unnamed');
  const ref = useRef<HTMLElement>(null);
  const kind = useMemo(() => classify(star), [star]);
  const abbr = useMemo(() => constellationOf(star.ra, star.dec), [star]);
  const [sky, setSky] = useState<SkyChartData | null>(null);

  const [countries, setCountries] = useState<Country[] | null>(null);

  useEffect(() => {
    loadSkyChart().then(setSky, e => console.error(e));
    loadCountries().then(setCountries, e => console.error(e));
  }, []);

  // The country under the stars, turned into the sky positions above each point of it.
  const { frame } = result;
  const country = useMemo(() => (countries ? countryAt(countries, frame.lat, frame.lon) : null), [countries, frame]);
  const ground = useMemo<ChartGround | null>(
    () =>
      country
        ? { rings: country.rings.map(r => r.map(([lon, lat]) => { const p = groundToSky(frame, lat, lon); return [p.ra, p.dec] as [number, number]; })), zenith: frame.zenith }
        : null,
    [country, frame],
  );
  // The place's own name for its country ("Barcelona, España" → "España"), else Natural Earth's.
  const countryName = placeName?.includes(', ') ? placeName.split(', ').pop()! : (country?.name ?? '');

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
      ly: ly => t('galaxy.ly', { ly: new Intl.NumberFormat(lang).format(ly) }),
      plane: t('galaxy.plane'),
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
        }, ground, { north: t('chart.north'), east: t('chart.east') });
      }
    },
    [sky, abbr, star, t, ground],
  );

  // Bring a fresh result into view (the panel scrolls on desktop, the page on phones).
  useEffect(() => {
    const id = setTimeout(() => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(id);
  }, [result, star.id]);

  const name = starName(star.id, lang);
  const [copiedWhat, setCopiedWhat] = useState<'name' | 'id' | null>(null);
  const [nameHelp, setNameHelp] = useState(false);
  const copy = async (what: 'name' | 'id', text: string) => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedWhat(what);
    setTimeout(() => setCopiedWhat(c => (c === what ? null : c)), 1800);
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
        <p className="moment">{formatMoment(result.frame.date, result.zone, lang)}</p>
      </header>

      <section className="name-block" aria-label={t('card.name')}>
        <p className="badge mono">{t('card.name')}</p>
        <p className="star-name" lang={lang}>
          “{name}”
        </p>
        <p className="star-id mono">
          {t('fact.id')} {star.id}
        </p>
        <div className="name-actions">
          <button className="secondary small" onClick={() => copy('name', name)}>
            {copiedWhat === 'name' ? t('action.copied.name') : t('action.copy.name')}
          </button>
          <button className="secondary small" onClick={() => copy('id', star.id)}>
            {copiedWhat === 'id' ? t('action.copied.id') : t('action.copy.id')}
          </button>
          <button className="link" onClick={() => setNameHelp(true)}>
            {t('name.how')} →
          </button>
        </div>
      </section>
      {nameHelp && <NameDialog id={star.id} onClose={() => setNameHelp(false)} />}

      <FirstLook literature={literature} id={star.id} />

      <div className="actions">
        <button className="primary" onClick={onCertificate}>
          {t('action.certificate')}
        </button>
        <button className="secondary" onClick={() => setSharing(true)}>
          {t('action.share')}
        </button>
      </div>
      {sharing && <ShareDialog star={star} result={result} placeName={where} literature={literature} onClose={() => setSharing(false)} />}

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

      <Figure
        n={++fig}
        title={`${t('card.where')} — ${sky ? sky.constellations[abbr].names[lang] : '…'}`}
        caption={
          <>
            {t('fact.see')}: {t(`see.${visibility(star)}`)}.{' '}
            {ground && countryName && t('card.where.ground', { country: countryName, place: where })}
          </>
        }
      >
        <div className="plate">
          <CanvasArt width={352} height={270} draw={drawChart} label={t('card.where')} />
        </div>
        <div className="fig-tools">
          <p className="hint">{t('map.hint')}</p>
          <button className="secondary small" aria-pressed={onMap} onClick={onToggleMap}>
            {onMap ? t('map.hide') : t('map.show')}
          </button>
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
        <div className="plate galaxy">
          <p className="panel-label mono">a · {t('galaxy.above')}</p>
          <CanvasArt width={352} height={300} draw={drawFaceOn} label={t('card.galaxy')} />
          <p className="panel-label mono">b · {t('cert.edge')}</p>
          <CanvasArt width={352} height={150} draw={drawEdgeOn} label={t('cert.edge')} />
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
