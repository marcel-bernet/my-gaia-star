import { describe, expect, it } from 'vitest';
import { ADJECTIVES, CREATURES, MANNERS, PLACES, PREPOSITIONS, REALMS, TIMES, VERBS } from './lexicon';
import {
  digitsToId,
  englishWordLists,
  idToDigits,
  normalize,
  parseName,
  scramble,
  SCRAMBLE,
  sentence,
  slotBits,
  slotOptions,
  SLOTS,
  slotSize,
  starName,
} from './name';
import type { Lang } from '../i18n';

const LANGS: Lang[] = ['en', 'es', 'ca'];
const IDS = ['0', '1', '4295806720', '4057491453829461504', '6917528443525529599', '9223372036854775807', '2237987199365376'];

describe('lexicon', () => {
  it('has lists of the right size', () => {
    expect(ADJECTIVES).toHaveLength(64);
    expect(CREATURES).toHaveLength(64);
    expect(VERBS).toHaveLength(64);
    expect(MANNERS).toHaveLength(64);
    expect(PREPOSITIONS).toHaveLength(16);
    expect(PLACES).toHaveLength(64);
    expect(REALMS).toHaveLength(64);
    expect(TIMES).toHaveLength(64);
  });

  it('never spells two choices of a slot the same way', () => {
    const d = idToDigits('0');
    for (const lang of LANGS) {
      for (const slot of SLOTS) {
        // Across every agreement the slot can be in.
        for (const count of [0, 1, 20]) {
          for (const g of [0, 1, 31, 51]) {
            const opts = slotOptions({ ...d, count, creature: g, place: g, realm: g }, slot, lang).map(normalize);
            expect(new Set(opts).size, `${lang} ${slot}`).toBe(slotSize(slot));
          }
        }
      }
    }
  });
});

describe('names', () => {
  it('round-trips IDs through digits', () => {
    for (const id of IDS) expect(digitsToId(idToDigits(id))).toBe(id);
  });

  it('round-trips random IDs through every language', () => {
    let x = 0x9e3779b97f4a7c15n;
    for (let i = 0; i < 60; i++) {
      x = (x * 6364136223846793005n + 1442695040888963407n) & ((1n << 63n) - 1n);
      const id = x.toString();
      for (const lang of LANGS) {
        const name = starName(id, lang);
        const back = parseName(name);
        expect(back, name).not.toBeNull();
        expect(digitsToId(back!.digits)).toBe(id);
      }
    }
  });

  it('agrees in gender and number', () => {
    const d = idToDigits('0');
    // One fox / one crane (fem) with "silver", by the lighthouse (m) / the tower (f) / the tree (elided).
    const fox = { ...d, count: 0, creature: 0, trait: 0, preposition: 0, place: 0, look: 4, realm: 8, realmLook: 14 };
    expect(sentence(fox, 'es')).toMatch(/^Un zorro plateado \S+ .* bajo el faro escondido de la isla helada, /);
    expect(sentence(fox, 'ca')).toMatch(/^Una guineu platejada .* sota el far amagat de l’illa glaçada, /);
    const cranes = { ...fox, count: 1, creature: 1, preposition: 9, place: 17 };
    expect(sentence(cranes, 'es')).toMatch(/^Dos grullas plateadas \S+ .* junto al árbol escondido /);
    expect(sentence(cranes, 'ca')).toMatch(/^Dues grues platejades \S+ .* al costat de l’arbre amagat /);
    expect(sentence(cranes, 'en')).toMatch(/^Two silver cranes \S+ .* beside the hidden tree of the frozen island, /);
    const twentyOne = { ...cranes, count: 20 };
    expect(sentence(twentyOne, 'es')).toMatch(/^Veintiuna grullas/);
    expect(sentence(twentyOne, 'ca')).toMatch(/^Vint-i-una grues/);
    expect(sentence({ ...twentyOne, creature: 0 }, 'es')).toMatch(/^Veintiún zorros/);
  });

  it('reads names typed without accents or capitals', () => {
    const name = starName('4057491453829461504', 'es');
    const plain = name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[.,]/g, '');
    expect(digitsToId(parseName(plain)!.digits)).toBe('4057491453829461504');
  });
});

// The recipe printed in "How are the words made?", checked against values
// computed independently in Python from that recipe alone.
describe('the published recipe', () => {
  const id = 790953210070223488n;

  it('scrambles a source_id as the page says', () => {
    const M = 1n << 63n;
    let x = (id * SCRAMBLE.C1) % M;
    x ^= x >> SCRAMBLE.S1;
    x = (x * SCRAMBLE.C2) % M;
    x ^= x >> SCRAMBLE.S2;
    expect(x).toBe(2937386670698878221n);
    expect(scramble(id)).toBe(x);
    expect((SCRAMBLE.C1 * SCRAMBLE.C1_INV) % M).toBe(1n);
    expect((SCRAMBLE.C2 * SCRAMBLE.C2_INV) % M).toBe(1n);
  });

  it('reads the choices off the scrambled number, lowest bits first', () => {
    const d = idToDigits(id);
    expect(SLOTS.map(s => d[s])).toEqual([13, 40, 42, 60, 37, 9, 14, 35, 29, 24, 20]);
    expect(SLOTS.reduce((n, s) => n + slotBits(s), 0)).toBe(63);
  });

  it('builds the English sentence from the downloadable lists', () => {
    const w = englishWordLists();
    const d = idToDigits(id);
    const pl = d.count > 0 ? 1 : 0;
    const a = w.adjective;
    const s =
      `${w.count[d.count]} ${a[d.trait]} ${w.creature[d.creature][pl]} ${w.verb[d.verb][pl]} ${w.manner[d.manner]} ` +
      `${w.preposition[d.preposition]} the ${a[d.look]} ${w.place[d.place]} of the ${a[d.realmLook]} ${w.realm[d.realm]}, ${w.time[d.time]}.`;
    expect(s.charAt(0).toUpperCase() + s.slice(1)).toBe(sentence(d, 'en'));
  });
});
