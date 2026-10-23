import { useRef, useState, type FormEvent, type PointerEvent } from 'react';
import type { Place, Result, Status } from '../App';
import { searchPlace } from '../geo';
import { LANGS, useI18n, type Lang } from '../i18n';
import { DEPTHS, type Depth, type Star } from '../sky/gaia';
import StarCard from './StarCard';

export type Mode = 'now' | 'moment';
type Sheet = 'peek' | 'half' | 'full';

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
  // Phone bottom-sheet height: drag the grip/header, or tap the grip to step through.
  const [sheet, setSheet] = useState<Sheet>('half');
  const aside = useRef<HTMLElement>(null);

  // Window listeners for the drag, so it keeps tracking wherever the finger goes
  // and a plain tap still reaches the grip's onClick.
  const onDragStart = (e: PointerEvent) => {
    const el = aside.current;
    if (!el || window.matchMedia('(min-width: 761px)').matches) return;
    if ((e.target as HTMLElement).closest('.langs')) return;
    const y0 = e.clientY;
    const h0 = el.getBoundingClientRect().height;
    let moved = false;
    const move = (ev: globalThis.PointerEvent) => {
      const dy = ev.clientY - y0;
      if (!moved && Math.abs(dy) < 8) return;
      moved = true;
      el.style.transition = 'none';
      el.style.maxHeight = `${Math.max(110, Math.min(window.innerHeight - 40, h0 - dy))}px`;
    };
    const up = (ev: globalThis.PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      el.style.maxHeight = '';
      el.style.transition = '';
      if (!moved) return;
      const dy = ev.clientY - y0;
      const order: Sheet[] = ['peek', 'half', 'full'];
      const steps = Math.round(-dy / 160) || (dy < 0 ? 1 : -1);
      setSheet(cur => order[Math.max(0, Math.min(2, order.indexOf(cur) + steps))]);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

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
    <aside ref={aside} className={`panel sheet-${sheet}${hasResult ? ' has-result' : ''}`} aria-label={t('brand')}>
      <div className="sheet-handle" onPointerDown={onDragStart}>
      <button
        className="panel-grip"
        onClick={() => setSheet(s => (s === 'half' ? 'full' : s === 'full' ? 'peek' : 'half'))}
        aria-label="Resize panel"
      >
        <span />
      </button>
      <header className="panel-head">
        <div className="brand-row">
          <p className="eyebrow">{t('brand')}</p>
          <div className="langs" role="group" aria-label={t('language')}>
            {(Object.keys(LANGS) as Lang[]).map(l => (
              <button key={l} lang={l} aria-pressed={lang === l} title={LANGS[l]} onClick={() => setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <h1>{t('tagline')}</h1>
      </header>
      </div>

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
        <span className="credit">ESA · Gaia DR3</span>
      </footer>
    </aside>
  );
}
