import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AboutDialog from './components/AboutDialog';
import CertificateDialog from './components/CertificateDialog';
import Panel, { type Mode } from './components/Panel';
import SkyMap, { type MapResult } from './components/SkyMap';
import { placeName } from './geo';
import { useI18n } from './i18n';
import { CatalogueUnavailable, starsAround, type Depth, type Star } from './sky/gaia';
import { hasDistance } from './sky/physics';
import { instantToWallTime, timeZoneAt, wallTimeToInstant } from './sky/time';
import { skyFrame } from './sky/zenith';
import { readUrl, writeUrl } from './urlState';

export interface Place {
  lat: number;
  lon: number;
  name: string | null;
}

export interface Result extends MapResult {
  place: Place;
  depth: Depth;
  zone: string;
}

export type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

function todayWall() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: '00:00' };
}

export default function App() {
  const { t, lang } = useI18n();
  const initial = useMemo(() => readUrl(), []);

  const [place, setPlace] = useState<Place | null>(initial ? { lat: initial.lat, lon: initial.lon, name: null } : null);
  const [mode, setMode] = useState<Mode>(initial?.t ? 'moment' : 'now');
  const [wall, setWall] = useState(() =>
    initial?.t ? instantToWallTime(initial.t, timeZoneAt(initial.lat, initial.lon)) : todayWall(),
  );
  const [depth, setDepth] = useState<Depth>(initial?.depth ?? 'all');
  const [result, setResult] = useState<Result | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(initial?.star ?? null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [certOpen, setCertOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const zone = place ? timeZoneAt(place.lat, place.lon) : null;

  // Put a name to the chosen point.
  useEffect(() => {
    if (!place || place.name !== null) return;
    let live = true;
    placeName(place.lat, place.lon, lang).then(name => {
      if (live) setPlace(p => (p && p.lat === place.lat && p.lon === place.lon ? { ...p, name: name ?? '' } : p));
    });
    return () => {
      live = false;
    };
  }, [place, lang]);

  const search = useCallback(
    async (at: Place, when: Date, d: Depth, keepSelection: string | null = null) => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setStatus({ kind: 'loading' });
      try {
        const frame = skyFrame(at.lat, at.lon, when);
        const stars = await starsAround(frame.zenith.ra, frame.zenith.dec, d, ctl.signal);
        if (ctl.signal.aborted) return;
        if (stars.length === 0) {
          setResult(null);
          setStatus({ kind: 'error', message: t('error.none') });
          return;
        }
        // Stars come back nearest-first. "Your star" is the nearest one Gaia
        // measured a distance and colour for (as the old backend's default
        // did), so its certificate can place it in the Galaxy.
        const zenithId = (stars.find(s => hasDistance(s) && s.bpRp !== null) ?? stars[0]).id;
        setResult({ frame, stars, zenithId, place: at, depth: d, zone: timeZoneAt(at.lat, at.lon) });
        const sel = keepSelection && stars.some(s => s.id === keepSelection) ? keepSelection : zenithId;
        setSelectedId(sel);
        setStatus({ kind: 'idle' });
      } catch (e) {
        if (ctl.signal.aborted) return;
        console.error(e);
        setStatus({ kind: 'error', message: e instanceof CatalogueUnavailable ? t('error.catalogue') : String(e) });
      }
    },
    [t],
  );

  // A shared link runs its search straight away.
  useEffect(() => {
    if (initial) search({ lat: initial.lat, lon: initial.lon, name: null }, initial.t ?? new Date(), initial.depth, initial.star);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the address bar shareable.
  useEffect(() => {
    if (!result) return;
    writeUrl({
      lat: result.place.lat,
      lon: result.place.lon,
      t: mode === 'moment' ? result.frame.date : null,
      depth: result.depth,
      star: selectedId === result.zenithId ? null : selectedId,
    });
  }, [result, selectedId, mode]);

  const run = () => {
    if (!place) return;
    const when = mode === 'now' || !zone ? new Date() : wallTimeToInstant(wall, zone);
    search(place, when, depth);
  };

  const pick = (lat: number, lon: number, name: string | null = null) => {
    setPlace({ lat, lon, name });
    setStatus({ kind: 'idle' });
  };

  const selected: Star | null = result?.stars.find(s => s.id === selectedId) ?? null;
  const resultPlace = result && place && result.place.lat === place.lat && result.place.lon === place.lon ? place : result?.place;

  return (
    <div className="app">
      <SkyMap
        place={place}
        result={result}
        selectedId={selectedId}
        onPick={(lat, lon) => pick(lat, lon)}
        onSelectStar={setSelectedId}
      />
      <Panel
        place={place}
        onPlace={pick}
        mode={mode}
        onMode={setMode}
        wall={wall}
        onWall={setWall}
        zone={zone}
        depth={depth}
        onDepth={setDepth}
        status={status}
        onRun={run}
        result={result}
        resultPlaceName={resultPlace?.name ?? null}
        selected={selected}
        onBackToZenith={() => result && setSelectedId(result.zenithId)}
        onCertificate={() => setCertOpen(true)}
        onAbout={() => setAboutOpen(true)}
      />
      {certOpen && result && selected && (
        <CertificateDialog
          star={selected}
          result={result}
          placeName={resultPlace?.name || t('place.unnamed')}
          onClose={() => setCertOpen(false)}
        />
      )}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
    </div>
  );
}
