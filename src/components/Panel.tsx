import { useState, type FormEvent, type ReactNode } from 'react';
import type { Place, Status } from '../types';
import { REPO_URL } from '../config';
import type { WallTime } from '../sky/time';
import { searchPlace } from '../geo';
import { LANGS, useI18n, type Key, type Lang } from '../i18n';
import { DEPTHS, type Depth, type Star } from '../sky/gaia';
import StarFinder from './StarFinder';
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

interface Props {
  place: Place | null;
  onPlace: (lat: number, lon: number, name: string | null) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  wall: WallTime;
  onWall: (w: WallTime) => void;
  zone: string | null;
  depth: Depth;
  onDepth: (d: Depth) => void;
  status: Status;
  onRun: () => void;
  /** The star on screen, if any. */
  currentStarId: string | null;
  /** The star card, shown below the form. */
  children?: ReactNode;
  onAbout: () => void;
  onPoint: () => void;
  onFound: (star: Star, when: Date | null) => void;
}

export default function Panel(p: Props) {
  const { t, lang, setLang } = useI18n();
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

  const locate = () => {
    setPlaceMsg(null);
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocating(false);
        p.onPlace(pos.coords.latitude, pos.coords.longitude, null);
      },
      () => {
        setLocating(false);
        setPlaceMsg(t('place.denied'));
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const loading = p.status.kind === 'loading';
  const hasResult = p.currentStarId !== null;
  const nf = new Intl.NumberFormat(lang, { notation: 'compact', compactDisplay: 'long', maximumSignificantDigits: 3 });

  return (
    <aside className={`panel${hasResult ? ' has-result' : ''}`} aria-label={t('brand')}>
      <header className="masthead">
        <a className="wordmark" href={import.meta.env.BASE_URL}>
          <ZenithMark size={15} />
          {t('brand')}
        </a>
        <div className="langs" role="group" aria-label={t('language')}>
          {(Object.keys(LANGS) as Lang[]).map(l => (
            <button key={l} lang={l} aria-pressed={lang === l} title={LANGS[l]} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <section className={`hero${hasResult ? ' compact' : ''}`}>
        <p className="kicker">{t('kicker')}</p>
        <h1>{t('tagline')}</h1>
        {!hasResult && (
          <>
            <p className="lede">{t('intro')}</p>
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
          </>
        )}
      </section>

      <section className="query" aria-label={t('go')}>
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
              onClick={locate}
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
          <p className="hint">{locating ? t('place.locating') : (placeMsg ?? (!p.place ? t('place.hint') : ''))}</p>
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

        <div className="step">
          <span className="step-label">
            <span className="num">03</span> {t('depth')}
          </span>
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

        <button className="primary" onClick={p.onRun} disabled={!p.place || loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden /> {t('loading')}
            </>
          ) : hasResult ? (
            t('go.again')
          ) : (
            <>
              {t('go')} <ZenithMark />
            </>
          )}
        </button>
        {p.status.kind === 'error' && (
          <p className="error" role="alert">
            {p.status.message}
          </p>
        )}
      </section>

      <StarFinder current={p.currentStarId} onFound={p.onFound} />

      {p.children}

      <footer className="colophon">
        <button className="link" onClick={p.onAbout}>
          {t('about')}
        </button>
        <button className="link" onClick={p.onPoint}>
          {t('point')}
        </button>
        <a className="link" href={REPO_URL} target="_blank" rel="noreferrer">
          GitHub
        </a>
        <span className="credit">ESA/Gaia/DPAC · CDS · OSM</span>
      </footer>
    </aside>
  );
}
