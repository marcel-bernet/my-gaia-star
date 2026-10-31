import { useEffect } from 'react';
import type { Result } from '../types';
import { writeUrl } from '../urlState';

/** Keep the address bar a shareable link to what is on screen. */
export function useUrlSync(result: Result | null, selectedId: string | null, pinnedMoment: boolean) {
  useEffect(() => {
    if (!result) return;
    writeUrl({
      lat: result.place.lat,
      lon: result.place.lon,
      t: pinnedMoment ? result.frame.date : null,
      depth: result.depth,
      star: selectedId === result.zenithId ? null : selectedId,
    });
  }, [result, selectedId, pinnedMoment]);
}
