/**
 * A human name for every Gaia source ID, and back.
 *
 * A Gaia DR3 source_id is a 63-bit number. It is scrambled (a reversible
 * mix, so neighbouring stars get unrelated names) and split into eleven
 * word choices — 32 × 16 × 64⁹ = 2⁶³ sentences, exactly one per possible ID:
 *
 *   Seven silver foxes sing softly beneath the hidden lighthouse of the frozen sea, every winter.
 *   Siete zorros plateados cantan suavemente bajo el faro escondido del mar helado, cada invierno.
 *   Set guineus platejades canten suaument sota el far amagat del mar glaçat, cada hivern.
 *
 * The words read as six phrases: who (how many, what), what they are like
 * and do, how and where, which place, of what, and when. The same choices
 * give the same star in all three languages; only the grammar changes.
 */
import type { Lang } from '../i18n';
import {
  ADJECTIVES,
  COUNT_EN,
  CREATURES,
  countCa,
  countEs,
  MANNERS,
  PLACES,
  PREPOSITIONS,
  REALMS,
  TIMES,
  VERBS,
  type Gender,
  type Thing,
} from './lexicon';

export const SLOTS = [
  'count',
  'creature',
  'trait',
  'verb',
  'manner',
  'preposition',
  'look',
  'place',
  'realm',
  'realmLook',
  'time',
] as const;
export type Slot = (typeof SLOTS)[number];
const SIZE: Record<Slot, number> = {
  count: 32,
  creature: 64,
  trait: 64,
  verb: 64,
  manner: 64,
  preposition: 16,
  look: 64,
  place: 64,
  realm: 64,
  realmLook: 64,
  time: 64,
};
export const slotSize = (s: Slot) => SIZE[s];
/** Every list is a power of two long, so a choice is exactly this many bits of the scrambled number. */
export const slotBits = (s: Slot) => Math.log2(SIZE[s]);
export type Digits = Record<Slot, number>;

// ---- ID ↔ digits -----------------------------------------------------------

const BITS = 63n;
const MASK = (1n << BITS) - 1n;
const C1 = 0x2545f4914f6cdd1dn & MASK;
const C2 = 0x1b873593a2d1c9b5n & MASK;
const S1 = 29n;
const S2 = 32n;

function inverse(c: bigint) {
  // Newton's iteration: each step doubles the correct low bits.
  let x = c;
  for (let i = 0; i < 7; i++) x = (x * (2n - c * x)) & MASK;
  return x;
}
const C1_INV = inverse(C1);
const C2_INV = inverse(C2);

function unxorshift(y: bigint, s: bigint) {
  let x = y;
  for (let i = 0n; i * s < BITS; i++) x = y ^ (x >> s);
  return x;
}

function mix(x: bigint) {
  x = (x * C1) & MASK;
  x ^= x >> S1;
  x = (x * C2) & MASK;
  x ^= x >> S2;
  return x;
}

function unmix(x: bigint) {
  x = unxorshift(x, S2);
  x = (x * C2_INV) & MASK;
  x = unxorshift(x, S1);
  return (x * C1_INV) & MASK;
}

/**
 * The scramble's constants, shown in "How are the words made?" so anyone can
 * reproduce it. All arithmetic is modulo 2⁶³.
 */
export const SCRAMBLE = { C1, C2, S1, S2, C1_INV, C2_INV } as const;

/** The scrambled number a star's choices are read from. */
export function scramble(id: string | bigint): bigint {
  return mix(BigInt(id) & MASK);
}

/** Can this be a Gaia source ID? (A whole number below 2⁶³.) */
export function isSourceId(s: string): boolean {
  return /^\d{1,19}$/.test(s.trim()) && BigInt(s.trim()) <= MASK;
}

export function idToDigits(id: string | bigint): Digits {
  let x = scramble(id);
  const d = {} as Digits;
  for (const s of SLOTS) {
    const n = BigInt(SIZE[s]);
    d[s] = Number(x % n);
    x /= n;
  }
  return d;
}

export function digitsToId(d: Digits): string {
  let x = 0n;
  for (const s of [...SLOTS].reverse()) x = x * BigInt(SIZE[s]) + BigInt(d[s]);
  return unmix(x).toString();
}

// ---- Words, with agreement ----------------------------------------------------

/** Spanish adjective forms: a regular -o base expands to -o/-a/-os/-as. */
function esForms(s: string): string[] {
  if (s.includes('|')) return s.split('|');
  const stem = s.slice(0, -1);
  return [s, `${stem}a`, `${s}s`, `${stem}as`];
}

const pick = (forms: string[], g: Gender, plural: boolean) => forms[(plural ? 2 : 0) + (g === 'f' ? 1 : 0)];

function adjective(i: number, lang: Lang, g: Gender, plural: boolean) {
  const [en, es, ca] = ADJECTIVES[i];
  if (lang === 'en') return en;
  return pick(lang === 'es' ? esForms(es) : ca.split('|'), g, plural);
}

/** Catalan drops the article's vowel before a vowel or h + vowel: l’arbre, l’illa, l’hivern. */
const caElides = (word: string) => /^h?[aeiouàáèéíïòóúü]/i.test(word);

/** Preposition plus the definite article for a singular noun, with contractions (del, al, l’). */
function withArticle(lang: 'es' | 'ca', prep: string, contraction: '' | 'de' | 'a', noun: string, g: Gender) {
  const head = prep ? `${prep}${contraction ? ` ${contraction}` : ''}` : contraction;
  if (lang === 'ca' && caElides(noun)) return `${head} l’`.trim();
  if (g === 'm' && contraction) return `${prep ? `${prep} ` : ''}${contraction === 'de' ? 'del' : 'al'}`;
  return `${head} ${g === 'm' ? 'el' : 'la'}`.trim();
}

function thing(t: Thing, lang: Lang) {
  const [en, es, esG, ca, caG] = t;
  return lang === 'en' ? { word: en, g: 'm' as Gender } : lang === 'es' ? { word: es, g: esG } : { word: ca, g: caG };
}

function creature(i: number, lang: Lang) {
  const [enS, enP, es, esG, ca, caG] = CREATURES[i];
  if (lang === 'en') return { forms: [enS, enP], g: 'm' as Gender };
  return lang === 'es' ? { forms: es.split('|'), g: esG } : { forms: ca.split('|'), g: caG };
}

/** One piece of the sentence: a word choice (slot) or fixed glue. */
export interface Segment {
  slot: Slot | null;
  text: string;
  /** Written straight onto the next piece, without a space (l’arbre). */
  glue?: boolean;
}

/** The sentence for these choices, piece by piece, in the language's word order. */
export function segments(d: Digits, lang: Lang): Segment[] {
  const plural = d.count > 0;
  const who = creature(d.creature, lang);
  const place = thing(PLACES[d.place], lang);
  const realm = thing(REALMS[d.realm], lang);
  const [prepEn, prepEs, cEs, prepCa, cCa] = PREPOSITIONS[d.preposition];
  const verb = VERBS[d.verb];
  const manner = MANNERS[d.manner];
  const time = TIMES[d.time];
  const seg = (slot: Slot | null, text: string): Segment => ({ slot, text, glue: text.endsWith('’') });

  if (lang === 'en') {
    return [
      seg('count', COUNT_EN[d.count]),
      seg('trait', adjective(d.trait, lang, 'm', plural)),
      seg('creature', who.forms[plural ? 1 : 0]),
      seg('verb', plural ? verb[1] : verb[0]),
      seg('manner', manner[0]),
      seg('preposition', `${prepEn} the`),
      seg('look', adjective(d.look, lang, 'm', false)),
      seg('place', place.word),
      seg(null, 'of the'),
      seg('realmLook', adjective(d.realmLook, lang, 'm', false)),
      seg('realm', realm.word),
      seg(null, ','),
      seg('time', time[0]),
      seg(null, '.'),
    ];
  }
  const es = lang === 'es';
  const n = d.count + 1;
  return [
    seg('count', es ? countEs(n, who.g) : countCa(n, who.g)),
    seg('creature', who.forms[plural ? 1 : 0]),
    seg('trait', adjective(d.trait, lang, who.g, plural)),
    seg('verb', (es ? verb[2] : verb[3]).split('|')[plural ? 1 : 0]),
    seg('manner', es ? manner[1] : manner[2]),
    seg(
      'preposition',
      es ? withArticle('es', prepEs, cEs, place.word, place.g) : withArticle('ca', prepCa, cCa, place.word, place.g),
    ),
    seg('place', place.word),
    seg('look', adjective(d.look, lang, place.g, false)),
    seg(
      'realm',
      withArticle(lang, '', 'de', realm.word, realm.g) + (lang === 'ca' && caElides(realm.word) ? '' : ' ') + realm.word,
    ),
    seg('realmLook', adjective(d.realmLook, lang, realm.g, false)),
    seg(null, ','),
    seg('time', es ? time[1] : time[2]),
    seg(null, '.'),
  ];
}

export function join(segs: Segment[]): string {
  let out = '';
  segs.forEach((s, i) => {
    const prev = segs[i - 1];
    const tight = i === 0 || prev?.glue || s.text === ',' || s.text === '.';
    out += (tight ? '' : ' ') + s.text;
  });
  return out.charAt(0).toUpperCase() + out.slice(1);
}

export function sentence(d: Digits, lang: Lang): string {
  return join(segments(d, lang));
}

export function starName(id: string, lang: Lang): string {
  return sentence(idToDigits(id), lang);
}

// ---- Reading a name back -------------------------------------------------------

/** Lower case, no accents or punctuation, apostrophes split off: "L’arbre," → "l' arbre". */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/'/g, "' ")
    .replace(/[.,;:!?¡¿"“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Which slots each piece depends on besides its own: its text changes with
 * them (agreement), so they are chosen together.
 */
function dependsOn(slot: Slot, lang: Lang): Slot[] {
  if (lang === 'en') return slot === 'creature' || slot === 'verb' ? ['count'] : [];
  switch (slot) {
    case 'count':
      return ['creature'];
    case 'creature':
    case 'verb':
      return ['count'];
    case 'trait':
      return ['creature', 'count'];
    case 'preposition':
    case 'look':
      return ['place'];
    case 'realmLook':
      return ['realm'];
    default:
      return [];
  }
}

/**
 * The choices that spell `text`, in any of the three languages, or null.
 * Works piece by piece through the sentence, trying only the choices that
 * fit what has been read so far.
 */
export function parseName(text: string): { digits: Digits; lang: Lang } | null {
  const target = normalize(text);
  for (const lang of ['en', 'es', 'ca'] as Lang[]) {
    const order = segments(idToDigits('0'), lang); // the shape only
    const found = match(target, lang, order, 0, {});
    if (found) return { digits: found, lang };
  }
  return null;
}

function match(rest: string, lang: Lang, order: Segment[], k: number, known: Partial<Digits>): Digits | null {
  if (k === order.length) return rest === '' ? (known as Digits) : null;
  const { slot, text } = order[k];
  if (slot === null) {
    const fixed = normalize(text);
    if (fixed === '') return match(rest, lang, order, k + 1, known);
    if (!(rest === fixed || rest.startsWith(`${fixed} `))) return null;
    return match(rest.slice(fixed.length).trimStart(), lang, order, k + 1, known);
  }
  // Choose this slot and anything its words agree with that is still open.
  const open = [slot, ...dependsOn(slot, lang)].filter((s, i, a) => known[s] === undefined && a.indexOf(s) === i);
  const total = open.reduce((p, s) => p * SIZE[s], 1);
  for (let c = 0; c < total; c++) {
    const trial: Partial<Digits> = { ...known };
    let r = c;
    for (const s of open) {
      trial[s] = r % SIZE[s];
      r = Math.floor(r / SIZE[s]);
    }
    const full = { ...idToDigits('0'), ...trial } as Digits;
    const piece = normalize(segments(full, lang)[k].text);
    if (!piece || !(rest === piece || rest.startsWith(`${piece} `))) continue;
    const found = match(rest.slice(piece.length).trimStart(), lang, order, k + 1, trial);
    if (found) return found;
  }
  return null;
}

/** The words a slot can take, as they would read in this sentence (with its agreement). */
export function slotOptions(d: Digits, slot: Slot, lang: Lang): string[] {
  return Array.from({ length: SIZE[slot] }, (_, v) => {
    const segs = segments({ ...d, [slot]: v }, lang).filter(s => s.slot === slot);
    return segs
      .map(s => s.text)
      .join(' ')
      .replace(/’ /g, '’');
  });
}

/**
 * The English word lists by slot, for anyone reproducing a name: creatures
 * and verbs as [singular, plural] (plural from "two" on); trait, look and
 * realmLook all read from "adjective".
 */
export function englishWordLists() {
  return {
    count: COUNT_EN,
    adjective: ADJECTIVES.map(a => a[0]),
    creature: CREATURES.map(c => [c[0], c[1]]),
    verb: VERBS.map(v => [v[0], v[1]]),
    manner: MANNERS.map(m => m[0]),
    preposition: PREPOSITIONS.map(p => p[0]),
    place: PLACES.map(p => p[0]),
    realm: REALMS.map(r => r[0]),
    time: TIMES.map(t => t[0]),
  };
}
