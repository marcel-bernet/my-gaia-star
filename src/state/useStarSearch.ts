import { useCallback, useRef, useState } from 'react';
import { useI18n } from '../i18n';
import { CatalogueUnavailable, starsAround, type Depth } from '../sky/gaia';
import { hasDistance } from '../sky/physics';
import { timeZoneAt } from '../sky/time';
import { skyFrame } from '../sky/zenith';
import type { Place, Result, Status } from '../types';

/**
 * Searching for the stars overhead, and which of them is selected. A new
 * search cancels the one before it.
 */
export function useStarSearch(initialSelection: string | null) {
  const { t } = useI18n();
  const [result, setResult] = useState<Result | null>(null);
  const [selectedId, setSelectedId] = useState(initialSelection);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const abort = useRef<AbortController | null>(null);

  /** Search at `at` and `when`; select `keepSelection` if it is among the results, else "your star". */
  const search = useCallback(
    async (at: Place, when: Date, depth: Depth, keepSelection: string | null = null) => {
      abort.current?.abort();
      const ctl = new AbortController();
      abort.current = ctl;
      setStatus({ kind: 'loading' });
      try {
        const frame = skyFrame(at.lat, at.lon, when);
        const stars = await starsAround(frame.zenith.ra, frame.zenith.dec, depth, ctl.signal);
        if (ctl.signal.aborted) return;
        if (stars.length === 0) {
          setResult(null);
          setStatus({ kind: 'error', message: t('error.none') });
          return;
        }
        // Stars come back nearest-first. "Your star" is the nearest one Gaia
        // measured a distance and colour for, so its certificate can place it
        // on the HR diagram and in the Galaxy.
        const zenithId = (stars.find(s => hasDistance(s) && s.bpRp !== null) ?? stars[0]).id;
        setResult({ frame, stars, zenithId, place: at, depth, zone: timeZoneAt(at.lat, at.lon) });
        setSelectedId(keepSelection && stars.some(s => s.id === keepSelection) ? keepSelection : zenithId);
        setStatus({ kind: 'idle' });
      } catch (e) {
        if (ctl.signal.aborted) return;
        console.error(e);
        setStatus({ kind: 'error', message: e instanceof CatalogueUnavailable ? t('error.catalogue') : String(e) });
      }
    },
    [t],
  );

  const selected = result?.stars.find(s => s.id === selectedId) ?? null;
  const clearStatus = useCallback(() => setStatus({ kind: 'idle' }), []);

  return { result, selected, selectedId, setSelectedId, status, clearStatus, search };
}
