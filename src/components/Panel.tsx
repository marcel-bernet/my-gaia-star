import { useState, type FormEvent } from 'react';
import type { Place, Result, Status } from '../App';
import { searchPlace } from '../geo';
import { LANGS, useI18n, type Lang } from '../i18n';
import { DEPTHS, type Depth, type Star } from '../sky/gaia';
import StarCard from './StarCard';

export type Mode = 'now' | 'moment';

interface Props {
  place: Place | null;
  onPlace: (lat: number, lon: number, name: string | null) => void;
  mode: Mode;
  onMode: (m: Mode) => void;
  wall: { date: string; time: string };
  onWall: (w: { date: string; time: string }) => void;
  zone: string | null;
  depth: Depth;
  onDepth: (d: Depth) => void;
  status: Status;
  onRun: () => void;
  result: Result | null;
  resultPlaceName: string | null;
  selected: Star | null;
  onBackToZenith: () => void;
  onCertificate: () => void;
  onAbout: () => void;
}

export default function Panel(p: Props) {
  const { t, lang, setLang } = useI18n();
  const [query, setQuery] = useState('');
  const [placeMsg, setPlaceMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
  const hasResult = !!p.result && !!p.selected;

  return (
    <aside className={`panel${collapsed ? ' is-collapsed' : ''}${hasResult ? ' has-result' : ''}`} aria-label={t('brand')}>
      <button className="panel-grip" onClick={() => setCollapsed(c => !c)} aria-label="Toggle panel" aria-expanded={!collapsed}>
        <span />
      </button>
      <header className="panel-head">
        <div>
          <p className="eyebrow">{t('brand')}</p>
          <h1>{t('tagline')}</h1>
        </div>
      </header>

      <div className="panel-body">
        {!hasResult && <p className="intro">{t('intro')}</p>}

        <div className="segmented" role="tablist">
          {(['now', 'moment'] as Mode[]).map(m => (
            <button key={m} role="tab" aria-selected={p.mode === m} onClick={() => p.onMode(m)}>
              {t(m === 'now' ? 'mode.now' : 'mode.moment')}
            </button>
          ))}
        </div>

        <section className="field">
          <label className="label" htmlFor="place-search">
            {t('place')}
          </label>
          {p.place && (
            <p className="place-current">
              <span className="dot" aria-hidden />
              {p.place.name || (p.place.name === '' ? t('place.unnamed') : '…')}
              <small>
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
            <button type="button" className="icon-btn" onClick={locate} title={t('place.locate')} aria-label={t('place.locate')} disabled={locating}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
                <path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
          </form>
          <p className="hint">{locating ? t('place.locating') : placeMsg ?? (!p.place ? t('place.hint') : '')}</p>
        </section>

        {p.mode === 'moment' && (
          <section className="field">
            <span className="label">{t('when')}</span>
            <div className="when">
              <input type="date" value={p.wall.date} onChange={e => p.onWall({ ...p.wall, date: e.target.value })} aria-label={t('when.date')} />
              <input type="time" value={p.wall.time} onChange={e => p.onWall({ ...p.wall, time: e.target.value })} aria-label={t('when.time')} />
            </div>
            {p.zone && <p className="hint">{t('when.zone', { zone: p.zone.replaceAll('_', ' ') })}</p>}
          </section>
        )}

        <section className="field">
          <span className="label">{t('depth')}</span>
          <div className="segmented small" role="radiogroup" aria-label={t('depth')}>
            {DEPTHS.map(d => (
              <button key={d} role="radio" aria-checked={p.depth === d} onClick={() => p.onDepth(d)}>
                {t(`depth.${d}`)}
              </button>
            ))}
          </div>
          <p className="hint">{t(`depth.${p.depth}.hint`)}</p>
        </section>

        <button className="primary" onClick={p.onRun} disabled={!p.place || loading}>
          {loading ? (
            <>
              <span className="spinner" aria-hidden /> {t('loading')}
            </>
          ) : hasResult ? (
            t('go.again')
          ) : (
            t('go')
          )}
        </button>
        {p.status.kind === 'error' && (
          <p className="error" role="alert">
            {p.status.message}
          </p>
        )}

        {hasResult && p.result && p.selected && (
          <StarCard
            star={p.selected}
            result={p.result}
            placeName={p.resultPlaceName}
            onBackToZenith={p.onBackToZenith}
            onCertificate={p.onCertificate}
          />
        )}
      </div>

      <footer className="panel-foot">
        <button className="link" onClick={p.onAbout}>
          {t('about')}
        </button>
        <select value={lang} onChange={e => setLang(e.target.value as Lang)} aria-label={t('language')}>
          {Object.entries(LANGS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </footer>
    </aside>
  );
}
