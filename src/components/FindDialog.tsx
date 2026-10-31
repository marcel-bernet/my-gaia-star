import { useI18n } from '../i18n';
import type { Star } from '../sky/gaia';
import Dialog from './Dialog';
import StarFinder from './StarFinder';

/** "Find a star by ID or name", kept off the main path. */
export default function FindDialog({
  current,
  onFound,
  onClose,
}: {
  current: string | null;
  onFound: (star: Star, when: Date | null) => void;
  onClose: () => void;
}) {
  const { t } = useI18n();
  return (
    <Dialog title={t('find.title')} onClose={onClose}>
      <StarFinder
        current={current}
        onFound={(star, when) => {
          onClose();
          onFound(star, when);
        }}
      />
    </Dialog>
  );
}
