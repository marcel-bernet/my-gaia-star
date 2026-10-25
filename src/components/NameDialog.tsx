import { LANGS, useI18n, type Key, type Lang } from '../i18n';
import { idToDigits, sentence, SLOTS, slotOptions, slotSize } from '../names/name';
import Dialog from './Dialog';

/** How a star's name is made from its Gaia number, worked through for this star. */
export default function NameDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { t, lang } = useI18n();
  const digits = idToDigits(id);
  const nf = new Intl.NumberFormat(lang);
  return (
    <Dialog title={t('name.how.title')} onClose={onClose} wide>
      <div className="prose name-how">
        <p>{t('name.how.p1', { id })}</p>
        <p>{t('name.how.p2')}</p>
        <p>{t('name.how.p3')}</p>
        <table className="name-table">
          <thead>
            <tr>
              <th>{t('name.how.col.part')}</th>
              <th className="num">{t('name.how.col.choice')}</th>
              <th>{t('name.how.col.word')}</th>
            </tr>
          </thead>
          <tbody>
            {SLOTS.map(s => (
              <tr key={s}>
                <td>{t(`name.slot.${s}` as Key)}</td>
                <td className="num mono">
                  {nf.format(digits[s] + 1)} / {slotSize(s)}
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
        <p>{t('name.how.p5')}</p>
        <p className="hint">{t('name.how.p6')}</p>
      </div>
    </Dialog>
  );
}
