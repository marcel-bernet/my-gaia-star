import { useEffect, useState } from 'react';
import { placeName } from '../geo';
import { useI18n } from '../i18n';
import type { Place } from '../types';

/**
 * The chosen place. A place picked without a name (a map tap, a shared link)
 * is named by reverse geocoding once the clicking settles.
 */
export function usePlace(initial: Place | null) {
  const { lang } = useI18n();
  const [place, setPlace] = useState(initial);

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

  return [place, setPlace] as const;
}
