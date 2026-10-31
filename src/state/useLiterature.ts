import { useEffect, useState } from 'react';
import { literatureFor } from '../sky/simbad';
import type { LiteratureState } from '../types';

/**
 * Has anyone written about this star? Debounced: tapping across the map
 * should not fire a SIMBAD query per star.
 */
export function useLiterature(starId: string | undefined): LiteratureState {
  const [literature, setLiterature] = useState<LiteratureState>(null);
  useEffect(() => {
    if (!starId) return;
    const ctl = new AbortController();
    setLiterature('loading');
    const id = setTimeout(() => {
      literatureFor(starId, ctl.signal).then(setLiterature, () => !ctl.signal.aborted && setLiterature('error'));
    }, 350);
    return () => {
      clearTimeout(id);
      ctl.abort();
    };
  }, [starId]);
  return literature;
}
