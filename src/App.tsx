import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AboutDialog from './components/AboutDialog';
import PointDialog from './components/PointDialog';
import CertificateDialog from './components/CertificateDialog';
import Panel, { type Mode } from './components/Panel';
import SkyMap, { type MapResult } from './components/SkyMap';
import { placeName } from './geo';
import { useI18n } from './i18n';
import { CatalogueUnavailable, starsAround, type Depth, type Star } from './sky/gaia';
import { hasDistance } from './sky/physics';
import { literatureFor, type Literature } from './sky/simbad';
import { instantToWallTime, timeZoneAt, wallTimeToInstant } from './sky/time';
import { skyFrame, subStellarPoint } from './sky/zenith';
import { readUrl, writeUrl } from './urlState';
import Readout from './components/Readout';
import { constellationOf, constellationOnGround, loadSkyChart, type SkyChartData } from './sky/constellation';

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
  const [pointOpen, setPointOpen] = useState(false);
  const [literature, setLiterature] = useState<Literature | 'loading' | 'error' | null>(null);
  const [onMap, setOnMap] = useState(false);
  const [sky, setSky] = useState<SkyChartData | null>(null);
  const abort = useRef<AbortController | null>(null);

  const zone = place ? timeZoneAt(place.lat, place.lon) : null;

  // Put a name to the chosen point.
  useEffect(() => {
    if (!place || place.name !== null) return;
    let live = true;
    // Wait for the clicking to settle: Nominatim allows one request per second for the whole site.
    const id = setTimeout(() => {
      placeName(place.lat, place.lon, lang).then(name => {
        if (live) setPlace(p => (p && p.lat === place.lat && p.lon === place.lon ? { ...p, name: name ?? '' } : p));
      });
    }, 700);
    return () => {
      live = false;
      clearTimeout(id);
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

  // Back to a star found by ID or name: wherever on Earth it is (or was) straight overhead.
  const goToStar = (star: Star, when: Date | null) => {
    const at = when ?? new Date();
    const p = subStellarPoint(star.ra, star.dec, at);
    const there = { lat: p.lat, lon: p.lon, name: null };
    setPlace(there);
    setDepth('all');
    setMode(when ? 'moment' : 'now');
    if (when) setWall(instantToWallTime(when, timeZoneAt(p.lat, p.lon)));
    search(there, at, 'all', star.id);
  };

  const pick = (lat: number, lon: number, name: string | null = null) => {
    setPlace({ lat, lon, name });
    setStatus({ kind: 'idle' });
  };

  const selected: Star | null = result?.stars.find(s => s.id === selectedId) ?? null;

  // Has anyone written about the selected star? Debounced: tapping across the
  // map should not fire a SIMBAD query per star.
  useEffect(() => {
    if (!selected) return;
    const ctl = new AbortController();
    setLiterature('loading');
    const id = setTimeout(() => {
      literatureFor(selected.id, ctl.signal).then(setLiterature, () => !ctl.signal.aborted && setLiterature('error'));
    }, 350);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (onMap && !sky) loadSkyChart().then(setSky, e => console.error(e));
  }, [onMap, sky]);
  // The selected star's constellation, laid on the ground at the size it spans in the sky.
  const overlay = useMemo(() => {
    if (!onMap || !sky || !result || !selected) return null;
    const abbr = constellationOf(selected.ra, selected.dec);
    return { ...constellationOnGround(result.frame, sky, abbr), name: sky.constellations[abbr].names[lang] };
  }, [onMap, sky, result, selected, lang]);

  const resultPlace = result && place && result.place.lat === place.lat && result.place.lon === place.lon ? place : result?.place;

  return (
    <div className="app">
      <div className="stage">
        <SkyMap
          place={place}
          result={result}
          selectedId={selectedId}
          onPick={(lat, lon) => pick(lat, lon)}
          onSelectStar={setSelectedId}
          overlay={overlay}
        />
        {result && <Readout result={result} />}
      </div>
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
        literature={literature}
        onBackToZenith={() => result && setSelectedId(result.zenithId)}
        onMap={onMap}
        onToggleMap={() => setOnMap(v => !v)}
        onCertificate={() => setCertOpen(true)}
        onAbout={() => setAboutOpen(true)}
        onPoint={() => setPointOpen(true)}
        onFound={goToStar}
      />
      {certOpen && result && selected && (
        <CertificateDialog
          star={selected}
          result={result}
          placeName={resultPlace?.name || t('place.unnamed')}
          literature={literature && typeof literature === 'object' ? literature : null}
          onClose={() => setCertOpen(false)}
        />
      )}
      {aboutOpen && <AboutDialog onClose={() => setAboutOpen(false)} />}
      {pointOpen && <PointDialog onClose={() => setPointOpen(false)} />}
    </div>
  );
}
