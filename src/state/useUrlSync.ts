import { useEffect } from 'react';
import type { Result } from '../types';
import { writeUrl } from '../urlState';

/**
 * Keep the address bar a shareable link to what is on screen. The moment and
 * the star are always written: the zenith crosses the 400″ search circle in
 * about a minute, so a link without them would show a different star.
 */
export function useUrlSync(result: Result | null, selectedId: string | null) {
  useEffect(() => {
    if (!result) return;
    writeUrl({
      lat: result.place.lat,
      lon: result.place.lon,
      t: result.frame.date,
      depth: result.depth,
      star: selectedId,
    });
  }, [result, selectedId]);
}
