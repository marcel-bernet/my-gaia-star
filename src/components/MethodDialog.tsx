import { useI18n, type Key } from '../i18n';
import Dialog from './Dialog';

/** How each number on the page is made, and what it can't tell you. Written for astronomers. */
const SECTIONS: [Key, Key][] = [
  ['method.zenith', 'method.zenith.body'],
  ['method.catalogue', 'method.catalogue.body'],
  ['method.star', 'method.star.body'],
  ['method.kind', 'method.kind.body'],
  ['method.literature', 'method.literature.body'],
  ['method.dr4', 'method.dr4.body'],
  ['method.names', 'method.names.body'],
];

export default function MethodDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t('method')} onClose={onClose}>
      <div className="prose method">
        <p className="lede">{t('method.lede')}</p>
        {SECTIONS.map(([title, body]) => (
          <section key={title}>
            <h3 className="step-label">{t(title)}</h3>
            <p>{t(body)}</p>
          </section>
        ))}
        <p>{t('method.code')}</p>
        <p className="hint">{t('independent')}</p>
      </div>
    </Dialog>
  );
}
