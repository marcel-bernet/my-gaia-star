/**
 * "Born at 14:30 in Lima" means 14:30 on Lima's clocks, whoever is looking.
 * These helpers convert between wall-clock time at a place and real instants.
 */
import tzlookup from '@photostructure/tz-lookup';

export function timeZoneAt(lat: number, lon: number): string {
  try {
    return tzlookup(lat, lon);
  } catch {
    return 'UTC';
  }
}

interface WallTime {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
}

function partsIn(zone: string, instant: Date): Record<string, number> {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const out: Record<string, number> = {};
  for (const p of fmt.formatToParts(instant)) if (p.type !== 'literal') out[p.type] = Number(p.value);
  return out;
}

/** Offset of `zone` from UTC at `instant`, in minutes. */
function offsetMinutes(zone: string, instant: Date): number {
  const p = partsIn(zone, instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - instant.getTime()) / 60000);
}

/** The instant at which clocks in `zone` showed `wall`. */
export function wallTimeToInstant(wall: WallTime, zone: string): Date {
  const [y, mo, d] = wall.date.split('-').map(Number);
  const [h, mi] = wall.time.split(':').map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  // Two passes settle the offset, including across DST changes.
  let t = guess - offsetMinutes(zone, new Date(guess)) * 60000;
  t = guess - offsetMinutes(zone, new Date(t)) * 60000;
  return new Date(t);
}

/** What clocks in `zone` showed at `instant`. */
export function instantToWallTime(instant: Date, zone: string): WallTime {
  const p = partsIn(zone, instant);
  const pad = (n: number) => String(n).padStart(2, '0');
  return { date: `${p.year}-${pad(p.month)}-${pad(p.day)}`, time: `${pad(p.hour)}:${pad(p.minute)}` };
}

export function formatMoment(instant: Date, zone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(instant);
}
