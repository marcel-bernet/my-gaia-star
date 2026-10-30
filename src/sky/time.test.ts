import { describe, expect, it } from 'vitest';
import { instantToWallTime, timeZoneAt, wallTimeToInstant } from './time';

describe('time zones', () => {
  it('finds the zone of a place', () => {
    expect(timeZoneAt(41.39, 2.17)).toBe('Europe/Madrid');
    expect(timeZoneAt(-12.05, -77.04)).toBe('America/Lima');
  });

  it('reads wall time at the place, not in the browser', () => {
    expect(wallTimeToInstant({ date: '2020-03-15', time: '14:30' }, 'America/Lima').toISOString()).toBe(
      '2020-03-15T19:30:00.000Z',
    );
    // Summer time in Barcelona is UTC+2.
    expect(wallTimeToInstant({ date: '2025-07-28', time: '12:29' }, 'Europe/Madrid').toISOString()).toBe(
      '2025-07-28T10:29:00.000Z',
    );
  });

  it('round-trips', () => {
    const t = new Date('2024-10-27T01:30:00Z'); // the night Europe leaves DST
    const wall = instantToWallTime(t, 'Europe/Madrid');
    expect(wallTimeToInstant(wall, 'Europe/Madrid').toISOString()).toBe(t.toISOString());
  });
});

it('knows historical rules (Peru had summer time in early 1990)', () => {
  expect(wallTimeToInstant({ date: '1990-03-15', time: '14:30' }, 'America/Lima').toISOString()).toBe('1990-03-15T18:30:00.000Z');
});
