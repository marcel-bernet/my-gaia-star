import { useCallback, useEffect, useMemo, useState } from 'react';
import { fitFiveParameters, transitPoints, type EpochAstrometry } from '../dr4/epoch';
import {
  drawPixels,
  drawResiduals,
  drawSkyPath,
  drawTimeline,
  FULL_PATH,
  needsZoom,
  pathExtent,
  pathHeight,
  pixelsHeight,
  timelineYearAt,
  WINDOWS,
  LOOP_PATH,
} from '../draw/dr4';
import {
  closestPreview,
  daysToDr4,
  dr4IsOut,
  epochAstrometryFor,
  isReleaseDay,
  loadPreview,
  type Dr4Result,
  type PreviewEntry,
} from '../dr4/source';
import { DR4_RELEASE } from '../config';
import { EXAMPLE, SIGNAL } from '../draw/theme';
import { formatLongDate } from '../format';
import { useI18n } from '../i18n';
import type { Star } from '../sky/gaia';
import CanvasArt, { type Draw } from './CanvasArt';
import Figure, { FIGURE_W } from './Figure';

export default function Dr4Section({ star, firstFig }: { star: Star; firstFig: number }) {
  const { t, lang } = useI18n();
  const [entries, setEntries] = useState<PreviewEntry[] | null>(null);
  const [status, setStatus] = useState<Dr4Result | null>(null);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    loadPreview().then(setEntries, e => console.error(e));
  }, []);

  useEffect(() => {
    const ctl = new AbortController();
    setStatus(null);
    setPickedId(null);
    epochAstrometryFor(star, ctl.signal).then(setStatus, () => {});
    return () => ctl.abort();
  }, [star]);

  const live = status?.kind === 'live' ? status.data : null;
  const standIn = useMemo(() => (entries ? closestPreview(entries, star) : null), [entries, star]);
  const picked = entries?.find(e => e.meta.id === pickedId) ?? standIn;
  const data: EpochAstrometry | null = live ?? picked?.data ?? null;

  // Orange means your star: a stand-in's figures are drawn in white.
  const accent = live ? SIGNAL : EXAMPLE;
  const pts = useMemo(() => (data ? transitPoints(data) : []), [data]);
  const fit = useMemo(() => (data ? fitFiveParameters(data) : null), [data]);
  useEffect(() => setSel(null), [data]);

  const drawPassTimeline = useCallback<Draw>((ctx, w, h) => drawTimeline(ctx, w, h, pts, sel, accent), [pts, sel, accent]);
  const selPt = sel !== null ? pts[sel] : null;
  const zoomed = fit !== null && needsZoom(fit);
  const fullH = useMemo(
    () => (data && fit ? pathHeight(pathExtent(data, fit, pts, FULL_PATH), FIGURE_W) : 260),
    [data, fit, pts],
  );
  const nearH = useMemo(
    () => (data && fit && zoomed ? pathHeight(pathExtent(data, fit, pts, LOOP_PATH), FIGURE_W) : 0),
    [data, fit, pts, zoomed],
  );
  const drawFullPath = useCallback<Draw>(
    (ctx, w, h) => {
      if (data && fit) drawSkyPath(ctx, w, h, data, fit, pts, sel, FULL_PATH, accent);
    },
    [data, fit, pts, sel, accent],
  );
  const drawLoopPath = useCallback<Draw>(
    (ctx, w, h) => {
      if (data && fit) drawSkyPath(ctx, w, h, data, fit, pts, sel, LOOP_PATH, accent);
    },
    [data, fit, pts, sel, accent],
  );
  const drawResidualPlot = useCallback<Draw>(
    (ctx, w, h) => {
      if (fit) drawResiduals(ctx, w, h, fit, pts, sel, accent);
    },
    [fit, pts, sel, accent],
  );
  const shown = selPt ?? pts[0];
  const gClass = shown?.gClass ?? 3;
  const nCcd = shown?.nCcd ?? 9;
  const drawPixelWindows = useCallback<Draw>((ctx, w, h) => drawPixels(ctx, w, h, gClass, nCcd, accent), [gClass, nCcd, accent]);

  const pickTransit = (x: number) => {
    const year = timelineYearAt(x, FIGURE_W);
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p.year - year) < Math.abs(pts[best].year - year)) best = i;
    });
    setSel(best);
  };
  const step = (d: number) => setSel(s => (pts.length ? ((s ?? (d > 0 ? -1 : 0)) + d + pts.length) % pts.length : null));

  const nf = (n: number, digits = 2) =>
    new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  const releaseDate = formatLongDate(DR4_RELEASE, lang);
  const out = dr4IsOut();
  const days = daysToDr4();
  // Before the release: a countdown. On release day: "Today". After that: nothing.
  const badge = !out ? t('dr4.countdown', { n: days }) : isReleaseDay() ? t('dr4.today') : null;
  const yearToDate = (y: number) => new Date(Date.UTC(Math.floor(y), 0, 1) + (y - Math.floor(y)) * 365.25 * 86400e3);
  const isQso = !live && picked?.meta.group === 'qso';
  const wobbly = fit !== null && fit.uwe > 1.4;
  const sampleLabel = (e: PreviewEntry) => `${e.meta.name ?? `G ${nf(e.meta.g, 1)} ${t(`dr4.group.${e.meta.group}`)}`}`;

  let fig = firstFig - 1;
  const nextFig = () => ++fig;
  return (
    <section className="dr4" aria-labelledby="dr4-title">
      <header className="dr4-head">
        <p className="kicker">
          {t(out ? 'dr4.kicker.out' : 'dr4.kicker')} {badge && <span className="countdown mono">{badge}</span>}
        </p>
        <h2 id="dr4-title">{t('dr4.title')}</h2>
        <p className="lede">{t(out ? 'dr4.lead.out' : 'dr4.lead', { date: releaseDate })}</p>
        <p className="note">
          {live
            ? t('dr4.live')
            : status?.kind === 'preview' && status.reason === 'not-found'
              ? t('dr4.notFound')
              : status?.kind === 'preview' && status.reason === 'error'
                ? t('dr4.error')
                : t(out ? 'dr4.standin.out' : 'dr4.standin')}
        </p>
        {!live && picked && (
          <p className="mono sample-id">
            {t('dr4.example')}: {sampleLabel(picked)} · Gaia DR4 {picked.meta.id}
          </p>
        )}
      </header>

      {!data && <span className="spinner" aria-hidden />}

      {data && (
        <>
          <Figure
            n={nextFig()}
            className="hero"
            kicker={t('dr4.pixels.kicker')}
            title={t('dr4.pixels')}
            caption={t(live ? 'dr4.pixels.caption.live' : 'dr4.pixels.caption', {
              n: nCcd,
              window: WINDOWS[gClass]?.label ?? WINDOWS[3].label,
              date: releaseDate,
            })}
          >
            <div className="plate pixels">
              <CanvasArt width={FIGURE_W} height={pixelsHeight(gClass)} draw={drawPixelWindows} label={t('dr4.pixels')} />
            </div>
          </Figure>

          <Figure n={nextFig()} title={t('dr4.timeline')} caption={t('dr4.timeline.caption', { n: pts.length })}>
            <CanvasArt width={FIGURE_W} height={92} draw={drawPassTimeline} label={t('dr4.timeline')} onPick={pickTransit} />
            <div className="transit-readout">
              <button className="icon-btn small" onClick={() => step(-1)} aria-label="←">
                ←
              </button>
              <span className="mono">
                {selPt
                  ? t('dr4.transit', {
                      date:
                        new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(
                          yearToDate(selPt.year),
                        ) + ' UTC',
                      psi: nf(selPt.psi, 1),
                      used: selPt.nUsed,
                      ccd: selPt.nCcd,
                    })
                  : '—'}
              </span>
              <button className="icon-btn small" onClick={() => step(1)} aria-label="→">
                →
              </button>
            </div>
          </Figure>

          {fit && (
            <Figure
              n={nextFig()}
              title={t('dr4.wobble')}
              caption={
                isQso ? (
                  t('dr4.wobble.qso')
                ) : (
                  <>
                    {t('dr4.wobble.caption')}
                    {zoomed && <> {t('dr4.wobble.zoomed')}</>}
                  </>
                )
              }
            >
              <div className="plate">
                {zoomed && <p className="panel-label mono">a · {t('dr4.wobble.full')}</p>}
                <CanvasArt width={FIGURE_W} height={fullH} draw={drawFullPath} label={t('dr4.wobble')} />
              </div>
              {zoomed && (
                <div className="plate">
                  <p className="panel-label mono">b · {t('dr4.wobble.year')}</p>
                  <CanvasArt width={FIGURE_W} height={nearH} draw={drawLoopPath} label={t('dr4.wobble.year')} />
                </div>
              )}
            </Figure>
          )}

          {fit && (
            <Figure
              n={nextFig()}
              title={t('dr4.residuals')}
              caption={
                wobbly ? t('dr4.residuals.wobble', { uwe: nf(fit.uwe, 1) }) : t('dr4.residuals.single', { rms: nf(fit.rms) })
              }
            >
              <CanvasArt width={FIGURE_W} height={150} draw={drawResidualPlot} label={t('dr4.residuals')} />
            </Figure>
          )}
        </>
      )}

      {!live && entries && (
        <details className="sample">
          <summary className="step-label">{t('dr4.sample.more')}</summary>
          <label>
            <span className="hint">{t('dr4.sample')}</span>
            <select value={picked?.meta.id ?? ''} onChange={e => setPickedId(e.target.value)}>
              {entries.map(e => (
                <option key={e.meta.id} value={e.meta.id}>
                  {sampleLabel(e)}
                  {e === standIn ? ' ←' : ''}
                </option>
              ))}
            </select>
          </label>
        </details>
      )}
    </section>
  );
}
