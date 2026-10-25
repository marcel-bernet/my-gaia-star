import { describe, expect, it } from 'vitest';
import { ADJECTIVES, CREATURES, MANNERS, PLACES, PREPOSITIONS, REALMS, TIMES, VERBS } from './lexicon';
import { digitsToId, idToDigits, normalize, parseName, sentence, slotOptions, SLOTS, slotSize, starName } from './name';
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
