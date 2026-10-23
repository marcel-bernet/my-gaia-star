/**
 * Where is "straight up" on the celestial sphere, and where does each star
 * land relative to it?
 *
 * Replaces the old astropy backend. Gaia positions are ICRS; astronomy-engine
 * gives us the rotation between the observer's horizon frame and J2000 (EQJ,
 * which matches ICRS to ~0.02″). We add annual aberration ourselves so the
 * zenith matches astropy's AltAz→ICRS to within an arcsecond or so.
 */
import {
  Body,
  BaryState,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
  Rotation_HOR_EQJ,
  Vector,
  type RotationMatrix,
} from 'astronomy-engine';

const DEG = Math.PI / 180;
/** Speed of light in AU/day. */
const C_AU_PER_DAY = 173.1446326846693;

export type Vec3 = [number, number, number];

export function radecToVec(raDeg: number, decDeg: number): Vec3 {
  const ra = raDeg * DEG;
  const dec = decDeg * DEG;
  return [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
}

export function vecToRadec([x, y, z]: Vec3): { ra: number; dec: number } {
  const ra = Math.atan2(y, x) / DEG;
  return { ra: (ra + 360) % 360, dec: Math.asin(Math.max(-1, Math.min(1, z))) / DEG };
}

function normalize([x, y, z]: Vec3): Vec3 {
  const n = Math.hypot(x, y, z);
  return [x / n, y / n, z / n];
}

function rotate(rot: RotationMatrix, v: Vec3, time: ReturnType<typeof MakeTime>): Vec3 {
  const r = RotateVector(rot, new Vector(v[0], v[1], v[2], time));
  return [r.x, r.y, r.z];
}

/** Earth's barycentric velocity divided by c (EQJ frame). */
function earthBeta(time: ReturnType<typeof MakeTime>): Vec3 {
  const s = BaryState(Body.Earth, time);
  return [s.vx / C_AU_PER_DAY, s.vy / C_AU_PER_DAY, s.vz / C_AU_PER_DAY];
}

/** Apparent (aberrated) direction → catalogue (ICRS) direction, first order. */
function removeAberration(u: Vec3, b: Vec3): Vec3 {
  const ub = u[0] * b[0] + u[1] * b[1] + u[2] * b[2];
  return normalize([u[0] - b[0] + ub * u[0], u[1] - b[1] + ub * u[1], u[2] - b[2] + ub * u[2]]);
}

/** Catalogue (ICRS) direction → apparent direction, first order. */
function addAberration(u: Vec3, b: Vec3): Vec3 {
  const ub = u[0] * b[0] + u[1] * b[1] + u[2] * b[2];
  return normalize([u[0] + b[0] - ub * u[0], u[1] + b[1] - ub * u[1], u[2] + b[2] - ub * u[2]]);
}

export interface SkyFrame {
  lat: number;
  lon: number;
  date: Date;
  /** ICRS coordinates of the zenith, degrees. */
  zenith: { ra: number; dec: number };
  /**
   * Angular offset of a catalogue position from the zenith, in degrees:
   * `east`/`north` along the ground (not divided by cos(lat)).
   */
  offset(raDeg: number, decDeg: number): { east: number; north: number; sep: number };
}

export function skyFrame(lat: number, lon: number, date: Date): SkyFrame {
  const time = MakeTime(date);
  const observer = new Observer(lat, lon, 0);
  const horToEqj = Rotation_HOR_EQJ(time, observer);
  const eqjToHor = Rotation_EQJ_HOR(time, observer);
  const beta = earthBeta(time);

  const zenithVec = removeAberration(rotate(horToEqj, [0, 0, 1], time), beta);

  return {
    lat,
    lon,
    date,
    zenith: vecToRadec(zenithVec),
    offset(raDeg, decDeg) {
      // Horizon frame: x = north, y = west, z = up.
      const [n, w, up] = rotate(eqjToHor, addAberration(radecToVec(raDeg, decDeg), beta), time);
      const sep = Math.acos(Math.max(-1, Math.min(1, up))) / DEG;
      const h = Math.hypot(n, w);
      if (h < 1e-12) return { east: 0, north: 0, sep };
      return { east: (sep * -w) / h, north: (sep * n) / h, sep };
    },
  };
}

/**
 * Where a star sits on the map: one degree of sky away from the zenith is
 * drawn one degree of arc away on the ground, in the same compass direction,
 * as if the sky were projected straight down onto the map.
 */
export function starToLatLng(frame: SkyFrame, raDeg: number, decDeg: number): [number, number] {
  const { east, north } = frame.offset(raDeg, decDeg);
  const cosLat = Math.max(Math.cos(frame.lat * DEG), 1e-6);
  return [frame.lat + north, frame.lon + east / cosLat];
}
