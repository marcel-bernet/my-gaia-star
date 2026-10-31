import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LiteratureState, Result } from '../types';
import { simbadUrl } from '../config';
import { drawConstellation, type ChartGround } from '../draw/constellation';
import { drawGalaxyEdgeOn, drawGalaxyFaceOn, galaxyLabels } from '../draw/galaxy';
import { drawStarPortrait } from '../draw/portrait';
import { CREAM, SIGNAL, MUTED, SANS } from '../draw/theme';
import { distanceText, firstLookTier, lightDeparture, starFacts } from '../facts';
import { starName } from '../names/name';
import { formatNumber, twoSigFigs } from '../format';
import { useI18n, type Key } from '../i18n';
import { classify } from '../sky/classify';
import { constellationOf, loadSkyChart, type SkyChartData } from '../sky/constellation';
import { countryAt, loadCountries, type Country } from '../sky/country';
import { groundToSky } from '../sky/zenith';
import type { Star } from '../sky/gaia';
import { galacticHeightKpc, LY_PER_KPC, starColor, visibility } from '../sky/physics';
import { formatMoment } from '../sky/time';
import CanvasArt, { type Draw } from './CanvasArt';
import Dr4Section from './Dr4Section';
import Figure, { FIGURE_W } from './Figure';
import NameDialog from './NameDialog';
import ShareDialog from './ShareDialog';

interface Props {
  star: Star;
  result: Result;
  placeName: string | null;
  literature: LiteratureState;
  onBackToZenith: () => void;
  onMap: boolean;
  onToggleMap: () => void;
  onCertificate: () => void;
}

/**
 * The headline of the result: has anyone written about this star? Until
 * SIMBAD answers, the star's kind stands in.
 */
function Verdict({ literature, star }: { literature: Props['literature']; star: Star }) {
  const { t, lang } = useI18n();
  const id = star.id;
  if (literature === null || literature === 'loading') {
    return (
      <div className="verdict pending" aria-live="polite">
        <h2>
          <span className="spinner" aria-hidden /> {t('first.checking')}
        </h2>
      </div>
    );
  }
  if (literature === 'error') {
    return (
      <div className="verdict pending" aria-live="polite">
        <h2>{t('first.error')}</h2>
      </div>
    );
  }
  if (!literature.known) {
    return (
      <div className="verdict unknown" aria-live="polite">
        <h2>{t('first.unknown.title')}</h2>
        <p className="verdict-body">{t(`first.unknown.body.${firstLookTier(star)}`, { g: formatNumber(star.g, lang, 1) })}</p>
      </div>
    );
  }
  const papers = literature.papers === 1 ? t('papers.one') : t('papers.many', { n: literature.papers });
  return (
    <div className="verdict known" aria-live="polite">
      <h2>{t('first.known.title', { name: literature.name })}</h2>
      <p className="verdict-body">
        {t('first.known.body', { papers })}{' '}
        <a href={simbadUrl(id)} target="_blank" rel="noreferrer">
          SIMBAD ↗
        </a>
      </p>
    </div>
  );
}

export default function StarCard({
  star,
  result,
  placeName,
  literature,
  onBackToZenith,
  onMap,
  onToggleMap,
  onCertificate,
}: Props) {
  const { t, lang } = useI18n();
  const [sharing, setSharing] = useState(false);
  const isZenith = star.id === result.zenithId;
  const facts = starFacts(star, result.frame.date, t, lang);
  const light = lightDeparture(star, result.frame.date, t, lang);
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
        ? {
            rings: country.rings.map(r =>
              r.map(([lon, lat]) => {
                const p = groundToSky(frame, lat, lon);
                return [p.ra, p.dec] as [number, number];
              }),
            ),
            zenith: frame.zenith,
          }
        : null,
    [country, frame],
  );
  // The place's own name for its country ("Barcelona, España" → "España"), else Natural Earth's.
  const countryName = placeName?.includes(', ') ? placeName.split(', ').pop()! : (country?.name ?? '');

  const drawPortrait = useCallback<Draw>(
    (ctx, w, h) => drawStarPortrait(ctx, { x: 0, y: 0, w, h }, star, kind, { sun: t('kind.sun'), star: t('chart.yourStar') }),
    [star, kind, t],
  );
  const galaxyText = useMemo(() => galaxyLabels(t, lang), [t, lang]);
  const drawFaceOn = useCallback<Draw>(
    (ctx, w, h) => drawGalaxyFaceOn(ctx, { x: 0, y: 0, w, h }, star, galaxyText),
    [star, galaxyText],
  );
  const drawEdgeOn = useCallback<Draw>(
    (ctx, w, h) => drawGalaxyEdgeOn(ctx, { x: 0, y: 0, w, h }, star, galaxyText),
    [star, galaxyText],
  );
  const height = galacticHeightKpc(star);
  const drawChart = useCallback<Draw>(
    (ctx, w, h) => {
      if (sky) {
        drawConstellation(
          ctx,
          { x: 0, y: 0, w, h },
          {
            sky,
            abbr,
            target: { ra: star.ra, dec: star.dec, label: t('chart.yourStar') },
            style: { gold: SIGNAL, cream: CREAM, muted: MUTED, font: SANS, scale: 0.9 },
            ground,
            furniture: { north: t('chart.north'), east: t('chart.east') },
          },
        );
      }
    },
    [sky, abbr, star, t, ground],
  );

  // Bring a fresh result into view (the panel scrolls on desktop, the page on phones).
  useEffect(() => {
    const behavior = matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    const id = setTimeout(() => ref.current?.scrollIntoView({ behavior, block: 'start' }), 120);
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
  const nextFig = () => ++fig;
  return (
    <article className="dossier" ref={ref}>
      <header className="dossier-head">
        <p className="kicker">
          {isZenith ? t('result.zenith') : t('result.selected')} · {t('result.count', { n: result.stars.length, place: where })}
        </p>
        <Verdict literature={literature} star={star} />
        <p className="moment">{formatMoment(result.frame.date, result.zone, lang)}</p>
      </header>

      <dl className="key-facts">
        <div>
          <dt>{t('key.what')}</dt>
          <dd>
            <span className="swatch" style={{ background: starColor(star) }} aria-hidden />
            {kind ? t(`kind.${kind.kind}`) : t('kind.unknown')}
          </dd>
          {kind?.radiusSun != null && <dd className="sub">{t('kind.size', { x: twoSigFigs(kind.radiusSun, lang) })}</dd>}
        </div>
        <div>
          <dt>{t('fact.light')}</dt>
          <dd>{light?.when ?? '—'}</dd>
          <dd className="sub">{distanceText(star, t, lang)}</dd>
        </div>
        <div>
          <dt>{t('key.where')}</dt>
          <dd>{sky ? sky.constellations[abbr].names[lang] : '…'}</dd>
          <dd className="sub">{t(`see.${visibility(star)}`)}</dd>
        </div>
      </dl>

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

      <div className="actions">
        <button className="primary" onClick={onCertificate}>
          {t('action.certificate')}
        </button>
        <button className="secondary" onClick={() => setSharing(true)}>
          {t('action.share')}
        </button>
      </div>
      {sharing && (
        <ShareDialog star={star} result={result} placeName={where} literature={literature} onClose={() => setSharing(false)} />
      )}

      <header className="act">
        <p className="kicker">{t('detail.kicker')}</p>
        <h2>{t('detail.title')}</h2>
      </header>

      {kind && (
        <Figure
          n={nextFig()}
          title={t('card.kind')}
          caption={
            <>
              {kind.sure ? t(`kind.${kind.kind}.about` as Key) : t('kind.colourOnly')}
              {kind.radiusSun !== null && <> {t('kind.size', { x: twoSigFigs(kind.radiusSun, lang) })}.</>}
            </>
          }
        >
          <CanvasArt width={340} height={130} draw={drawPortrait} label={t(`kind.${kind.kind}`)} />
        </Figure>
      )}

      <Figure
        n={nextFig()}
        title={`${t('card.where')} — ${sky ? sky.constellations[abbr].names[lang] : '…'}`}
        caption={
          <>
            {t('fact.see')}: {t(`see.${visibility(star)}`)}.{' '}
            {ground && countryName && t('card.where.ground', { country: countryName, place: where })}
          </>
        }
      >
        <div className="plate">
          <CanvasArt width={FIGURE_W} height={270} draw={drawChart} label={t('card.where')} />
        </div>
        <div className="fig-tools">
          <p className="hint">{t('map.hint')}</p>
          <button className="secondary small" aria-pressed={onMap} onClick={onToggleMap}>
            {onMap ? t('map.hide') : t('map.show')}
          </button>
        </div>
      </Figure>

      <Figure
        n={nextFig()}
        title={t('card.galaxy')}
        caption={
          height === null
            ? t('fact.height.unknown')
            : t(height >= 0 ? 'fact.height.above' : 'fact.height.below', { ly: twoSigFigs(Math.abs(height) * LY_PER_KPC, lang) })
        }
      >
        <div className="plate galaxy">
          <p className="panel-label mono">a · {t('galaxy.above')}</p>
          <CanvasArt width={FIGURE_W} height={300} draw={drawFaceOn} label={t('card.galaxy')} />
          <p className="panel-label mono">b · {t('cert.edge')}</p>
          <CanvasArt width={FIGURE_W} height={150} draw={drawEdgeOn} label={t('cert.edge')} />
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
        {literature && typeof literature === 'object' && literature.known && (
          <a className="link" href={simbadUrl(star.id)} target="_blank" rel="noreferrer">
            {t('action.simbad')} ↗
          </a>
        )}
      </div>
      <p className="hint">{t('result.tapHint')}</p>
    </article>
  );
}
