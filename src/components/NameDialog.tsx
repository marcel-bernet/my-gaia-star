import { LANGS, useI18n, type Key, type Lang } from '../i18n';
import {
  englishWordLists,
  idToDigits,
  scramble,
  SCRAMBLE,
  sentence,
  SLOTS,
  slotBits,
  slotOptions,
  slotSize,
} from '../names/name';
import Dialog from './Dialog';

const BITS = 63;

/** The scramble, step by step: the operation, and what it does in words. The constants are in the recipe. */
const MIX_STEPS = (s1: bigint, s2: bigint): [string, Key][] => [
  ['× C₁', 'name.how.mix.mul'],
  [`x ⊕ (x ≫ ${s1})`, 'name.how.mix.fold'],
  ['× C₂', 'name.how.mix.mul2'],
  [`x ⊕ (x ≫ ${s2})`, 'name.how.mix.fold2'],
];
const hex = (n: bigint) => `0x${n.toString(16).toUpperCase().padStart(16, '0')}`;

/** A 63-bit number as a strip of squares, lowest bit first; optionally cut into the eleven choices. */
function BitStrip({ x, cut }: { x: bigint; cut?: boolean }) {
  const bit = (i: number) => <span key={i} className={(x >> BigInt(i)) & 1n ? 'bit on' : 'bit'} />;
  if (!cut) return <div className="bits">{Array.from({ length: BITS }, (_, i) => bit(i))}</div>;
  let at = 0;
  return (
    <div className="bits cut">
      {SLOTS.map((s, k) => {
        const n = slotBits(s);
        const cells = Array.from({ length: n }, (_, j) => bit(at + j));
        at += n;
        return (
          <span key={s} className="field" style={{ flexGrow: n }}>
            <span className="field-num mono">{k + 1}</span>
            <span className="field-bits">{cells}</span>
          </span>
        );
      })}
    </div>
  );
}

/** The recipe as runnable Python, filled in for this star. */
function recipe(id: string, mixed: bigint, choices: number[], english: string) {
  const sizes = SLOTS.map(s => `("${s}", ${slotSize(s)})`);
  return `import json
words = json.load(open("my-gaia-star-words.json"))

M = 2**63                               # all arithmetic modulo 2^63
x = ${id}${' '.repeat(Math.max(2, 36 - id.length))}# Gaia DR3 source_id
x = x * ${hex(SCRAMBLE.C1)} % M
x ^= x >> ${SCRAMBLE.S1}
x = x * ${hex(SCRAMBLE.C2)} % M
x ^= x >> ${SCRAMBLE.S2}                            # ${mixed}

c = {}
for slot, size in [${sizes.slice(0, 5).join(', ')},
                   ${sizes.slice(5).join(', ')}]:
    c[slot] = x % size                  # the lowest bits are the next choice
    x //= size
# ${choices.join(', ')}

pl = c["count"] > 0                     # "two" and up take plural forms
a = words["adjective"]
s = (f'{words["count"][c["count"]]} {a[c["trait"]]} '
     f'{words["creature"][c["creature"]][pl]} {words["verb"][c["verb"]][pl]} '
     f'{words["manner"][c["manner"]]} {words["preposition"][c["preposition"]]} the '
     f'{a[c["look"]]} {words["place"][c["place"]]} of the {a[c["realmLook"]]} '
     f'{words["realm"][c["realm"]]}, {words["time"][c["time"]]}.')
print(s[0].upper() + s[1:])
# ${english}
`;
}

function downloadWordLists() {
  const blob = new Blob([JSON.stringify(englishWordLists(), null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'my-gaia-star-words.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** How a star's words are made from its Gaia number, worked through for this star. */
export default function NameDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const digits = idToDigits(id);
  const mixed = scramble(id);
  const nf = new Intl.NumberFormat(lang);
  return (
    <Dialog title={t('name.how.title')} onClose={onClose} wide>
      <div className="prose name-how">
        <p>{t('name.how.p1', { id })}</p>

        <figure className="bit-steps">
          <div className="bit-step">
            <p className="step-label">
              <span className="num">1</span> {t('name.how.step.id')}
            </p>
            <p className="mono bit-value">{id}</p>
            <BitStrip x={BigInt(id)} />
          </div>
          <div className="bit-step">
            <p className="step-label">
              <span className="num">2</span> {t('name.how.step.mix')}
            </p>
            <dl className="mix-steps">
              {MIX_STEPS(SCRAMBLE.S1, SCRAMBLE.S2).map(([op, key]) => (
                <div key={key}>
                  <dt className="mono">{op}</dt>
                  <dd>{t(key)}</dd>
                </div>
              ))}
            </dl>
            <p className="hint mix-note">{t('name.how.mix.note')}</p>
            <p className="mono bit-value">{mixed.toString()}</p>
            <BitStrip x={mixed} />
          </div>
          <div className="bit-step">
            <p className="step-label">
              <span className="num">3</span> {t('name.how.step.cut')}
            </p>
            <BitStrip x={mixed} cut />
          </div>
          <figcaption className="hint">{t('name.how.fig.caption')}</figcaption>
        </figure>

        <p>{t('name.how.p2')}</p>
        <p>{t('name.how.p3')}</p>
        <table className="name-table">
          <thead>
            <tr>
              <th className="num">#</th>
              <th>{t('name.how.col.part')}</th>
              <th className="num">{t('name.how.col.choice')}</th>
              <th>{t('name.how.col.word')}</th>
            </tr>
          </thead>
          <tbody>
            {SLOTS.map((s, k) => (
              <tr key={s}>
                <td className="num mono">{k + 1}</td>
                <td>{t(`name.slot.${s}` as Key)}</td>
                <td className="num mono">
                  {nf.format(digits[s])} <small>/ {slotSize(s)}</small>
                </td>
                <td className="word">{slotOptions(digits, s, lang)[digits[s]]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p>{t('name.how.p4')}</p>
        <ul className="name-langs">
          {(Object.keys(LANGS) as Lang[]).map(l => (
            <li key={l} lang={l}>
              <span className="mono">{l.toUpperCase()}</span> “{sentence(digits, l)}”
            </li>
          ))}
        </ul>

        <h3 className="step-label code-title">{t('name.how.code.title')}</h3>
        <p>{t('name.how.code.lede')}</p>
        <pre className="recipe" lang="en">
          <code>
            {recipe(
              id,
              mixed,
              SLOTS.map(s => digits[s]),
              sentence(digits, 'en'),
            )}
          </code>
        </pre>
        <button className="secondary small" onClick={downloadWordLists}>
          {t('name.how.code.download')}
        </button>
        <p>{t('name.how.code.back', { c1inv: hex(SCRAMBLE.C1_INV), c2inv: hex(SCRAMBLE.C2_INV) })}</p>

        <p>{t('name.how.p5')}</p>
        <p className="hint">{t('name.how.p6')}</p>
      </div>
    </Dialog>
  );
}
