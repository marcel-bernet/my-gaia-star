import { useI18n } from '../i18n';
import Dialog from './Dialog';

export default function AboutDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Dialog title={t('about.title')} onClose={onClose}>
      <div className="prose">
        <p className="byline">{t('about.by')}</p>
        <p>{t('about.p1')}</p>
        <p>{t('about.p2')}</p>
        <p>{t('about.p4')}</p>
        <p>{t('about.p3')}</p>
        <p className="hint">{t('independent')}</p>
      </div>
    </Dialog>
  );
}
