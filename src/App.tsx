import { useEffect, useMemo, useState } from 'react';
import AboutDialog from './components/AboutDialog';
import CertificateDialog from './components/CertificateDialog';
import FindDialog from './components/FindDialog';
import MethodDialog from './components/MethodDialog';
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
  // With a star on screen, the map can be put away so the panel reads as one column.
  const [mapHidden, setMapHidden] = useState(false);
  const overlay = useConstellationOverlay(onMap, result, selected);
  useUrlSync(result, selectedId);
  // The place-and-moment form stays folded until asked for: the main path is one button.
  const [formOpen, setFormOpen] = useState(false);

  // Dialogs.
  const [certOpen, setCertOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pointOpen, setPointOpen] = useState(false);
  const [methodOpen, setMethodOpen] = useState(false);
  const [findOpen, setFindOpen] = useState(false);

  // A shared link runs its search straight away. Only on load: `search`
  // changes with the language, and switching language must not search again.
  useEffect(() => {
    if (initial) search({ lat: initial.lat, lon: initial.lon, name: null }, initial.t ?? new Date(), initial.depth, initial.star);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = () => {
    if (!place) return;
    const when = mode === 'now' || !zone ? new Date() : wallTimeToInstant(wall, zone);
    setMapHidden(false);
    setFormOpen(false);
    search(place, when, depth);
  };

  // "Find my star": here, now, every star Gaia saw.
  const findHere = (lat: number, lon: number) => {
    const here = { lat, lon, name: null };
    setPlace(here);
    setMode('now');
    setDepth('all');
    setMapHidden(false);
    setFormOpen(false);
    search(here, new Date(), 'all');
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
    setMapHidden(false);
    setFormOpen(false);
    search(there, at, 'all', star.id);
  };

  const pick = (lat: number, lon: number, name: string | null = null) => {
    setPlace({ lat, lon, name });
    setFormOpen(true);
    clearStatus();
  };

  const reading = mapHidden && !!selected;
  // Nothing to show on the map yet: phones hide it and lead with the words.
  const idle = !result && !formOpen;

  // The result's place, with its name once geocoding has found one.
  const resultPlace = result && place && result.place.lat === place.lat && result.place.lon === place.lon ? place : result?.place;

  return (
    <div className={`app${reading ? ' reading' : ''}${idle ? ' idle' : ''}`}>
      <div className="stage">
        <SkyMap
          visible={!reading && !idle}
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
        onFindHere={findHere}
        formOpen={formOpen}
        onFormOpen={setFormOpen}
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
        onMethod={() => setMethodOpen(true)}
        onPoint={() => setPointOpen(true)}
        onFind={() => setFindOpen(true)}
        mapHidden={reading}
        onToggleMapHidden={selected ? () => setMapHidden(h => !h) : undefined}
      >
        {result && selected && (
          <StarCard
            star={selected}
            result={result}
            placeName={resultPlace?.name ?? null}
            literature={literature}
            onBackToZenith={() => setSelectedId(result.zenithId)}
            onMap={onMap}
            onToggleMap={() => {
              // Laying the constellation on the map needs the map.
              if (!onMap) setMapHidden(false);
              setOnMap(v => !v);
            }}
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
      {methodOpen && <MethodDialog onClose={() => setMethodOpen(false)} />}
      {findOpen && <FindDialog current={selected?.id ?? null} onFound={goToStar} onClose={() => setFindOpen(false)} />}
    </div>
  );
}
