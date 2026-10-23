import { useI18n } from '../i18n';
import Dialog from './Dialog';

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t('about.title')} onClose={onClose}>
      <div className="prose">
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>
        <p>{t('about.p3')}</p>
        <p className="hint">{t('independent')}</p>
        <p className="hint">
          <a href="https://github.com/marcelbernet/my-gaia-star" target="_blank" rel="noreferrer">
            github.com/marcelbernet/my-gaia-star
          </a>
        </p>
      </div>
    </Dialog>
  );
}
