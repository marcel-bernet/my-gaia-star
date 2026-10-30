import { useEffect, useMemo, useState } from 'react';
import AboutDialog from './components/AboutDialog';
import CertificateDialog from './components/CertificateDialog';
import Panel, { type Mode } from './components/Panel';
import PointDialog from './components/PointDialog';
import Readout from './components/Readout';
import SkyMap from './components/SkyMap';
import StarCard from './components/StarCard';
import { useI18n } from './i18n';
import type { Depth, Star } from './sky/gaia';
import { instantToWallTime, localWallTime, timeZoneAt, wallTimeToInstant } from './sky/time';
import { subStellarPoint } from './sky/zenith';
import { useConstellationOverlay } from './state/useConstellationOverlay';
import { useLiterature } from './state/useLiterature';
import { usePlace } from './state/usePlace';
import { useStarSearch } from './state/useStarSearch';
import { useUrlSync } from './state/useUrlSync';
import { readUrl } from './urlState';

/** The time inputs start at midnight today. */
const todayWall = () => ({ ...localWallTime(), time: '00:00' });

/**
 * The whole page: the map on one side, the panel (form + star card) on the
 * other, and the dialogs. The state lives in hooks under src/state/.
 */
export default function App() {
  const { t } = useI18n();
  // A shared link (?lat=…&lon=…&t=…) sets the starting state.
  const initial = useMemo(() => readUrl(), []);

  // The form.
  const [place, setPlace] = usePlace(initial ? { lat: initial.lat, lon: initial.lon, name: null } : null);
  const [mode, setMode] = useState<Mode>(initial?.t ? 'moment' : 'now');
  const [wall, setWall] = useState(() =>
    initial?.t ? instantToWallTime(initial.t, timeZoneAt(initial.lat, initial.lon)) : todayWall(),
  );
  const [depth, setDepth] = useState<Depth>(initial?.depth ?? 'all');
  const zone = place ? timeZoneAt(place.lat, place.lon) : null;

  // The search and the selected star.
  const { result, selected, selectedId, setSelectedId, status, clearStatus, search } = useStarSearch(initial?.star ?? null);
  const literature = useLiterature(selected?.id);
  const [onMap, setOnMap] = useState(false);
  const overlay = useConstellationOverlay(onMap, result, selected);
  useUrlSync(result, selectedId, mode === 'moment');

  // Dialogs.
  const [certOpen, setCertOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);

  // A shared link runs its search straight away. Only on load: `search`
  // changes with the language, and switching language must not search again.
  useEffect(() => {
    if (initial) search({ lat: initial.lat, lon: initial.lon, name: null }, initial.t ?? new Date(), initial.depth, initial.star);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    clearStatus();
  };

  // The result's place, with its name once geocoding has found one.
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
        currentStarId={selected?.id ?? null}
        onAbout={() => setAboutOpen(true)}
        onPoint={() => setPointOpen(true)}
        onFound={goToStar}
      >
        {result && selected && (
          <StarCard
            star={selected}
            result={result}
            placeName={resultPlace?.name ?? null}
            literature={literature}
            onBackToZenith={() => setSelectedId(result.zenithId)}
            onMap={onMap}
            onToggleMap={() => setOnMap(v => !v)}
            onCertificate={() => setCertOpen(true)}
          />
        )}
      </Panel>
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
