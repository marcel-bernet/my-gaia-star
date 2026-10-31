import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { Place, Status } from '../types';
import type { WallTime } from '../sky/time';
import { AUTHOR_URL } from '../config';
import { formatDec, formatRa } from '../format';
import { searchPlace } from '../geo';
import { useI18n, type Key } from '../i18n';
import { DEPTHS, type Depth } from '../sky/gaia';
import LangSwitch from './LangSwitch';
import ZenithMark from './ZenithMark';

export type Mode = 'now' | 'moment';

/** Headline numbers on the landing page (ESA's published counts). */
const GAIA_STATS: [number, Key][] = [
  [1_811_709_771, 'stat.dr3'],
  [2_793_009_568, 'stat.dr4'],
  [129_625_750_708, 'stat.passes'],
];

const DEPTH_MAG: Record<Depth, string> = {
  'naked-eye': 'G < 6',
  bright: 'G < 13',
  faint: 'G < 19',
  all: 'G < 21',
};

/** After this long, the progress list says the catalogue is slow rather than leaving people guessing. */
const SLOW_MS = 7000;

interface Props {
  place: Place | null;
  onPlace: (lat: number, lon: number, name: string | null) => void;
  /** "Find my star": the visitor's own location, right now, at full depth. */
  onFindHere: (lat: number, lon: number) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  wall: WallTime;
  onWall: (w: WallTime) => void;
  zone: string | null;
  depth: Depth;
  onDepth: (d: Depth) => void;
  status: Status;
  onRun: () => void;
  /** The place-and-moment form: folded away until asked for. */
  formOpen: boolean;
  onFormOpen: (open: boolean) => void;
  /** The star on screen, if any. */
  currentStarId: string | null;
  /** The star card, shown below the form. */
  children?: ReactNode;
  onAbout: () => void;
  onMethod: () => void;
  onPoint: () => void;
  onFind: () => void;
  mapHidden: boolean;
  /** Present once a star is on screen. */
  onToggleMapHidden?: () => void;
}

/** What is happening while the star is found: each step is a real stage of the search. */
function Progress({ status, locating }: { status: Status; locating: boolean }) {
  const { t } = useI18n();
  const loading = status.kind === 'loading';
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const id = setTimeout(() => setSlow(true), SLOW_MS);
    return () => clearTimeout(id);
  }, [loading]);
  if (!loading && !locating) return null;
  const zenith = status.kind === 'loading' ? status.zenith : undefined;
  const steps: { text: string; state: 'done' | 'active' | 'next' }[] = [
    {
      text: zenith ? t('stage.zenith', { pos: `${formatRa(zenith.ra)} ${formatDec(zenith.dec)}` }) : t('stage.zenith.pending'),
      state: zenith ? 'done' : 'active',
    },
    { text: t('stage.catalogue'), state: zenith ? 'active' : 'next' },
    { text: t('stage.literature'), state: 'next' },
  ];
  if (locating) steps.unshift({ text: t('place.locating'), state: 'active' });
  return (
    <div className="progress" aria-live="polite">
      <ol>
        {steps.map(s => (
          <li key={s.text} className={s.state}>
            {s.state === 'active' ? <span className="spinner" aria-hidden /> : <span className="tick" aria-hidden />}
            {s.text}
          </li>
        ))}
      </ol>
      {slow && zenith && <p className="hint">{t('stage.slow')}</p>}
    </div>
  );
}

export default function Panel(p: Props) {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [placeMsg, setPlaceMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  const submitSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setPlaceMsg(null);
    const found = await searchPlace(query.trim(), lang).catch(() => null);
    if (found) {
      p.onPlace(found.lat, found.lon, found.name);
      setQuery('');
    } else setPlaceMsg(t('place.notFound'));
  };

  /** Ask for the visitor's location; `then` gets it. A refusal opens the form instead. */
  const locate = (then: (lat: number, lon: number) => void) => {
    setPlaceMsg(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        then(pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLocating(false);
        setPlaceMsg(t('place.denied'));
        p.onFormOpen(true);
      },
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 600000 },
    );
  };

  const loading = p.status.kind === 'loading';
  const hasResult = p.currentStarId !== null;
  const nf = new Intl.NumberFormat(lang, { notation: 'compact', compactDisplay: 'long', maximumSignificantDigits: 3 });
  const error =
    p.status.kind === 'error' ? (
      <p className="error" role="alert">
        {p.status.message}
      </p>
    ) : null;

  const form = (
    <section className="query" aria-label={t('go.choose')}>
      <div className="query-head">
        <span className="step-label">{t('go.choose')}</span>
        <button className="link" onClick={() => p.onFormOpen(false)}>
          {t('close')}
        </button>
      </div>
      <div className="step">
        <label className="step-label" htmlFor="place-search">
          <span className="num">01</span> {t('place')}
        </label>
        {p.place && (
          <p className="place-current">
            {p.place.name || (p.place.name === '' ? t('place.unnamed') : '…')}
            <small className="mono">
              {p.place.lat.toFixed(3)}°, {p.place.lon.toFixed(3)}°
            </small>
          </p>
        )}
        <form className="search" onSubmit={submitSearch}>
          <input
            id="place-search"
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={t('place.search')}
            autoComplete="off"
          />
          <button
            type="button"
            className="icon-btn"
            onClick={() => locate((lat, lon) => p.onPlace(lat, lon, null))}
            title={t('place.locate')}
            aria-label={t('place.locate')}
            disabled={locating}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </form>
        <p className="hint">{placeMsg ?? (!p.place ? t('place.hint') : '')}</p>
      </div>

      <div className="step">
        <span className="step-label">
          <span className="num">02</span> {t('when')}
        </span>
        <div className="segmented" role="radiogroup" aria-label={t('when')}>
          {(['now', 'moment'] as Mode[]).map(m => (
            <button key={m} role="radio" aria-checked={p.mode === m} onClick={() => p.onMode(m)}>
              {t(m === 'now' ? 'mode.now' : 'mode.moment')}
            </button>
          ))}
        </div>
        {p.mode === 'moment' && (
          <>
            <div className="when">
              <input
                type="date"
                value={p.wall.date}
                onChange={e => p.onWall({ ...p.wall, date: e.target.value })}
                aria-label={t('when.date')}
              />
              <input
                type="time"
                value={p.wall.time}
                onChange={e => p.onWall({ ...p.wall, time: e.target.value })}
                aria-label={t('when.time')}
              />
            </div>
            {p.zone && <p className="hint">{t('when.zone', { zone: p.zone.replaceAll('_', ' ') })}</p>}
          </>
        )}
      </div>

      <details className="advanced" open={p.depth !== 'all'}>
        <summary className="step-label">{t('depth.advanced')}</summary>
        <div className="step">
          <span className="hint">{t('depth')}</span>
          <div className="depths" role="radiogroup" aria-label={t('depth')}>
            {DEPTHS.map(d => (
              <button key={d} role="radio" aria-checked={p.depth === d} onClick={() => p.onDepth(d)}>
                <span className="depth-name">{t(`depth.${d}`)}</span>
                <span className="depth-mag mono">{DEPTH_MAG[d]}</span>
              </button>
            ))}
          </div>
          <p className="hint">{t(`depth.${p.depth}.hint`)}</p>
        </div>
      </details>

      <button className="primary" onClick={p.onRun} disabled={!p.place || loading}>
        {loading ? (
          <>
            <span className="spinner" aria-hidden /> {t('loading')}
          </>
        ) : (
          <>
            {t('go')} <ZenithMark />
          </>
        )}
      </button>
      <Progress status={p.status} locating={false} />
      {error}
    </section>
  );

  return (
    <aside className={`panel${hasResult ? ' has-result' : ''}`} aria-label={t('brand')}>
      <header className="masthead">
        <a className="wordmark" href={import.meta.env.BASE_URL}>
          <ZenithMark size={15} />
          {t('brand')}
        </a>
        {p.onToggleMapHidden && (
          <button className="map-toggle" onClick={p.onToggleMapHidden}>
            {t(p.mapHidden ? 'reading.show' : 'reading.hide')}
          </button>
        )}
        <LangSwitch />
      </header>

      {!hasResult && (
        <section className="hero">
          <p className="kicker">{t('kicker')}</p>
          <h1>{t('tagline')}</h1>
          <p className="lede">{t('intro')}</p>
          {!p.formOpen && (
            <div className="cta">
              <button className="primary big" onClick={() => locate(p.onFindHere)} disabled={loading || locating}>
                {loading || locating ? (
                  <>
                    <span className="spinner" aria-hidden /> {t('loading')}
                  </>
                ) : (
                  <>
                    {t('go.here')} <ZenithMark />
                  </>
                )}
              </button>
              {!loading && (
                <>
                  <p className="hint">{t('go.here.hint')}</p>
                  <button className="link more" onClick={() => p.onFormOpen(true)}>
                    {t('go.choose')} →
                  </button>
                </>
              )}
              <Progress status={p.status} locating={locating} />
              {error}
            </div>
          )}
        </section>
      )}

      {p.formOpen && form}

      {hasResult && !p.formOpen && (
        <section className="again">
          <button className="link" onClick={() => p.onFormOpen(true)}>
            ← {t('go.again')}
          </button>
          <Progress status={p.status} locating={false} />
          {error}
        </section>
      )}

      {p.children}

      {!hasResult && (
        <section className="context">
          <dl className="stats">
            {GAIA_STATS.map(([n, label]) => (
              <div key={label}>
                <dt>{t(label)}</dt>
                <dd className="mono">{nf.format(n)}</dd>
              </div>
            ))}
          </dl>
          <button className="point-btn" onClick={p.onPoint}>
            <span aria-hidden="true">?</span> {t('point')}
          </button>
        </section>
      )}

      <footer className="colophon">
        <nav className="colophon-links">
          <button className="link" onClick={p.onMethod}>
            {t('method')}
          </button>
          <button className="link" onClick={p.onFind}>
            {t('find.title')}
          </button>
          {/* On the landing page the question already sits under the counts. */}
          {hasResult && (
            <button className="link" onClick={p.onPoint}>
              {t('point')}
            </button>
          )}
          <button className="link" onClick={p.onAbout}>
            {t('about')}
          </button>
        </nav>
        <p className="byline">
          <a href={AUTHOR_URL} target="_blank" rel="noreferrer">
            {t('footer.by')} ↗
          </a>
        </p>
        <p className="credit">{t('footer.credit')}</p>
      </footer>
    </aside>
  );
}
