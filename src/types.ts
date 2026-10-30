/** Types shared across the app's components. */
import type { Depth, Star } from './sky/gaia';
import type { Literature } from './sky/simbad';
import type { SkyFrame } from './sky/zenith';

export interface Place {
  lat: number;
  lon: number;
  /** null: not looked up yet; '': looked up, but the place has no name. */
  name: string | null;
}

/** One search: the stars around the zenith at a place and moment. */
export interface Result {
  frame: SkyFrame;
  /** Nearest to the zenith first. */
  stars: Star[];
  /** "Your star": the nearest one with a distance and a colour. */
  zenithId: string;
  place: Place;
  depth: Depth;
  /** IANA time zone at the place, e.g. "Europe/Madrid". */
  zone: string;
}

/** Progress of a network request shown in the UI. */
export type Status = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string };

/** The SIMBAD check for the selected star: null before it starts. */
export type LiteratureState = Literature | 'loading' | 'error' | null;
