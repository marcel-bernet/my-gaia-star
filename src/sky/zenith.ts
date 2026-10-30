/**
 * Where is "straight up" on the celestial sphere, and where does each star
 * land relative to it?
 *
 * Gaia positions are ICRS; astronomy-engine gives us the rotation between
 * the observer's horizon frame and J2000 (EQJ, which matches ICRS to
 * ~0.02″). We add annual aberration ourselves so the zenith matches
 * astropy's AltAz→ICRS to within an arcsecond or so (zenith.test.ts).
 */
import {
  Body,
  BaryState,
  MakeTime,
  Observer,
  RotateVector,
  Rotation_EQJ_HOR,
  Rotation_HOR_EQJ,
  SiderealTime,
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
  /** The catalogue (ICRS) position `sepDeg` from the zenith at azimuth `azDeg` (north through east). */
  at(sepDeg: number, azDeg: number): { ra: number; dec: number };
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
    at(sepDeg, azDeg) {
      const s = Math.sin(sepDeg * DEG);
      const hor: Vec3 = [s * Math.cos(azDeg * DEG), -s * Math.sin(azDeg * DEG), Math.cos(sepDeg * DEG)];
      return vecToRadec(removeAberration(rotate(horToEqj, hor, time), beta));
    },
  };
}

/**
 * Where a star sits on the map: one degree of sky away from the zenith is
 * drawn one degree of arc away on the ground, in the same compass direction,
 * as if the sky were projected straight down onto the map. Longitudes are
 * not wrapped, so a shape drawn this way stays in one piece.
 */
export function starToLatLng(frame: SkyFrame, raDeg: number, decDeg: number): [number, number] {
  const { east, north, sep } = frame.offset(raDeg, decDeg);
  const az = Math.atan2(east, north);
  const d = sep * DEG;
  const p1 = frame.lat * DEG;
  const p2 = Math.asin(Math.sin(p1) * Math.cos(d) + Math.cos(p1) * Math.sin(d) * Math.cos(az));
  const dl = Math.atan2(Math.sin(az) * Math.sin(d) * Math.cos(p1), Math.cos(d) - Math.sin(p1) * Math.sin(p2));
  return [p2 / DEG, frame.lon + dl / DEG];
}

/** The inverse: the sky that lies over a point on the ground (ICRS, degrees). */
export function groundToSky(frame: SkyFrame, lat: number, lon: number): { ra: number; dec: number } {
  const p1 = frame.lat * DEG;
  const p2 = lat * DEG;
  const dl = (lon - frame.lon) * DEG;
  const cosD = Math.sin(p1) * Math.sin(p2) + Math.cos(p1) * Math.cos(p2) * Math.cos(dl);
  const sep = Math.acos(Math.max(-1, Math.min(1, cosD))) / DEG;
  const az =
    Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)) / DEG;
  return frame.at(sep, az);
}

/**
 * The place on Earth where a star (ICRS) is straight overhead at `date`.
 * Starts from right ascension minus sidereal time and refines with the full
 * zenith model, so the star lands within a fraction of an arcsecond.
 */
export function subStellarPoint(raDeg: number, decDeg: number, date: Date): { lat: number; lon: number } {
  const wrap = (l: number) => ((((l + 180) % 360) + 360) % 360) - 180;
  let lat = decDeg;
  let lon = wrap(raDeg - SiderealTime(date) * 15);
  for (let i = 0; i < 4; i++) {
    const z = skyFrame(lat, lon, date).zenith;
    let dRa = raDeg - z.ra;
    if (dRa > 180) dRa -= 360;
    if (dRa < -180) dRa += 360;
    lat = Math.max(-89.999, Math.min(89.999, lat + (decDeg - z.dec)));
    lon = wrap(lon + dRa);
  }
  return { lat, lon };
}
