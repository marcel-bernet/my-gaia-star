import { useEffect, useRef, type ReactNode } from 'react';
import { useI18n } from '../i18n';

/** Native <dialog>: focus trapping, Esc and backdrop come for free. */
export default function Dialog({
  title,
  onClose,
  children,
  wide,
  actions,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  /** Extra controls in the header, beside the close button. */
  actions?: ReactNode;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    // No close() on cleanup: it would fire onClose; unmounting removes it anyway.
    const d = ref.current!;
    if (!d.open) d.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dialog${wide ? ' wide' : ''}`}
      onClose={onClose}
      onClick={e => e.target === ref.current && onClose()}
    >
      <div className="dialog-inner">
        <header>
          <h2>{title}</h2>
          {actions}
          <button className="icon-btn" onClick={onClose} aria-label={t('close')}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
