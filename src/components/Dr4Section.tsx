import { useCallback, useEffect, useMemo, useState } from 'react';
import { fitFiveParameters, transitPoints, type EpochAstrometry } from '../dr4/epoch';
import { drawResiduals, drawTimeline, drawWindow, drawWobble, timelineYearAt, WINDOWS } from '../dr4/plots';
import { closestPreview, daysToDr4, DR4_RELEASE, epochAstrometryFor, loadPreview, type Dr4Result, type PreviewEntry } from '../dr4/source';
import { useI18n } from '../i18n';
import type { Star } from '../sky/gaia';
import { LY_PER_PC } from '../sky/physics';
import CanvasArt from './CanvasArt';
import { Figure } from './StarCard';

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

  const pts = useMemo(() => (data ? transitPoints(data) : []), [data]);
  const fit = useMemo(() => (data ? fitFiveParameters(data) : null), [data]);
  useEffect(() => setSel(null), [data]);

  const drawT = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => drawTimeline(ctx, w, h, pts, sel), [pts, sel]);
  const drawW = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (data && fit) drawWobble(ctx, w, h, data, fit, pts, sel);
    },
    [data, fit, pts, sel],
  );
  const drawR = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (fit) drawResiduals(ctx, w, h, fit, pts, sel);
    },
    [fit, pts, sel],
  );
  const gClass = sel !== null ? pts[sel].gClass : (pts[0]?.gClass ?? 3);
  const drawP = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number) => drawWindow(ctx, w, h, gClass), [gClass]);

  const TL_W = 352;
  const pickTransit = (x: number) => {
    const year = timelineYearAt(x, TL_W);
    let best = 0;
    pts.forEach((p, i) => {
      if (Math.abs(p.year - year) < Math.abs(pts[best].year - year)) best = i;
    });
    setSel(best);
  };
  const step = (d: number) => setSel(s => (pts.length ? ((s ?? (d > 0 ? -1 : 0)) + d + pts.length) % pts.length : null));

  const nf = (n: number, digits = 2) => new Intl.NumberFormat(lang, { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  const releaseDate = new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'long', year: 'numeric' }).format(DR4_RELEASE);
  const days = daysToDr4();
  const yearToDate = (y: number) => new Date(Date.UTC(Math.floor(y), 0, 1) + (y - Math.floor(y)) * 365.25 * 86400e3);
  const selPt = sel !== null ? pts[sel] : null;
  const isQso = !live && picked?.meta.group === 'qso';
  const wobbly = fit !== null && fit.uwe > 1.4;
  const sampleLabel = (e: PreviewEntry) => `${e.meta.name ?? `G ${nf(e.meta.g, 1)} ${t(`dr4.group.${e.meta.group}`)}`}`;
  const distLy = fit && fit.parallax > 3 * fit.errors[2] ? (1000 / fit.parallax) * LY_PER_PC : null;

  let fig = firstFig - 1;
  return (
    <section className="dr4" aria-labelledby="dr4-title">
      <header className="dr4-head">
        <p className="kicker">
          {t('dr4.kicker')} <span className="countdown mono">{days > 0 ? t('dr4.countdown', { n: days }) : t('dr4.today')}</span>
        </p>
        <h2 id="dr4-title">{t('dr4.title')}</h2>
        <p className="lede">{t('dr4.lead', { date: releaseDate })}</p>
        <p className="note">
          {live
            ? t('dr4.live')
            : status?.kind === 'preview' && status.reason === 'not-found'
              ? t('dr4.notFound')
              : status?.kind === 'preview' && status.reason === 'error'
                ? t('dr4.error')
                : t('dr4.standin')}
        </p>
      </header>

      {!live && entries && (
        <label className="sample">
          <span className="step-label">{t('dr4.sample')}</span>
          <select value={picked?.meta.id ?? ''} onChange={e => setPickedId(e.target.value)}>
            {entries.map(e => (
              <option key={e.meta.id} value={e.meta.id}>
                {sampleLabel(e)}
                {e === standIn ? ' ←' : ''}
              </option>
            ))}
          </select>
          {picked && <span className="mono sample-id">Gaia DR4 {picked.meta.id}</span>}
        </label>
      )}

      {!data && <span className="spinner" aria-hidden />}

      {data && (
        <>
          <Figure n={++fig} title={t('dr4.timeline')} caption={t('dr4.timeline.caption', { n: pts.length })}>
            <CanvasArt width={TL_W} height={92} draw={drawT} label={t('dr4.timeline')} onPick={pickTransit} />
            <div className="transit-readout">
              <button className="icon-btn small" onClick={() => step(-1)} aria-label="←">
                ←
              </button>
              <span className="mono">
                {selPt
                  ? t('dr4.transit', {
                      date: new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(yearToDate(selPt.year)) + ' UTC',
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
            <Figure n={++fig} title={t('dr4.wobble')} caption={isQso ? t('dr4.wobble.qso') : t('dr4.wobble.caption')}>
              <div className="plate square">
                <CanvasArt width={320} height={320} draw={drawW} label={t('dr4.wobble')} />
              </div>
            </Figure>
          )}

          {fit && (
            <Figure
              n={++fig}
              title={t('dr4.residuals')}
              caption={wobbly ? t('dr4.residuals.wobble', { uwe: nf(fit.uwe, 1) }) : t('dr4.residuals.single', { rms: nf(fit.rms) })}
            >
              <CanvasArt width={352} height={150} draw={drawR} label={t('dr4.residuals')} />
            </Figure>
          )}

          {fit && (
            <section className="table-block">
              <h3 className="fig-title">
                <span className="fig-num mono">{t('table', { n: 2 })}</span> {t('dr4.fit.title')}
              </h3>
              <dl className="facts">
                <div>
                  <dt>{t('dr4.fit.parallax')}</dt>
                  <dd className="mono">
                    {nf(fit.parallax, 3)} ± {nf(fit.errors[2], 3)} mas
                  </dd>
                </div>
                <div>
                  <dt>{t('dr4.fit.distance')}</dt>
                  <dd>
                    {distLy !== null
                      ? t('fact.distance.value', { ly: new Intl.NumberFormat(lang, { maximumSignificantDigits: 3 }).format(distLy) })
                      : t('dr4.fit.noDistance')}
                  </dd>
                </div>
                <div>
                  <dt>{t('dr4.fit.pm')}</dt>
                  <dd className="mono">
                    {nf(fit.pmRa, 1)}, {nf(fit.pmDec, 1)} mas/yr
                  </dd>
                </div>
                <div>
                  <dt>{t('dr4.fit.n')}</dt>
                  <dd className="mono">{new Intl.NumberFormat(lang).format(fit.nUsed)}</dd>
                </div>
              </dl>
              <p className="fig-caption">{wobbly ? t('dr4.fit.note.wobbly') : t('dr4.fit.note')}</p>
            </section>
          )}

          <Figure
            n={++fig}
            title={t('dr4.pixels')}
            caption={t('dr4.pixels.caption', { window: WINDOWS[gClass]?.label ?? WINDOWS[3].label, date: releaseDate })}
          >
            <div className="plate pixels">
              <CanvasArt width={352} height={gClass <= 1 ? 240 : 80} draw={drawP} label={t('dr4.pixels')} />
            </div>
          </Figure>
        </>
      )}
    </section>
  );
}
