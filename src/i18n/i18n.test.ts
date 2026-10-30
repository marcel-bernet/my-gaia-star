import { describe, expect, it } from 'vitest';
import { SLOTS } from '../names/name';
import { DEPTHS } from '../sky/gaia';
import { ca } from './ca';
import { en, type Key } from './en';
import { es } from './es';

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort();

describe('translations', () => {
  for (const [lang, dict] of Object.entries({ es, ca })) {
    it(`${lang} uses the same {placeholders} as English`, () => {
      for (const key of Object.keys(en) as Key[]) {
        expect([key, placeholders(dict[key])]).toEqual([key, placeholders(en[key])]);
      }
    });
  }

  it('has the keys the app builds at runtime', () => {
    const built = [...DEPTHS.flatMap(d => [`depth.${d}`, `depth.${d}.hint`]), ...SLOTS.map(s => `name.slot.${s}`)];
    for (const key of built) expect(en).toHaveProperty([key]);
  });
});
