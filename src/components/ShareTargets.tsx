import { Fragment, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';

interface Target {
  id: string;
  label: string;
  href: (text: string, url: string, subject: string) => string;
  icon: ReactNode;
}

/** Where each platform takes a prefilled post. Facebook and LinkedIn only take the link. */
const TARGETS: Target[] = [
  {
    id: 'whatsapp',
    label: 'WhatsApp',
    href: (text, url) => `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
    icon: (
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.6-1.2A9 9 0 1 0 12 3Zm-3 5c.3 0 .5 0 .7.5l.8 1.8c0 .2 0 .4-.1.5l-.5.6c-.1.2-.2.3 0 .6a7 7 0 0 0 3.3 2.9c.2.1.4 0 .5-.1l.7-.8c.2-.2.3-.2.5-.1l1.8.8c.3.2.4.2.4.4 0 .6-.3 1.4-1 1.7-.6.3-1.4.4-3-.3-2.7-1.1-4.3-3.8-4.5-4-.1-.2-1-1.3-1-2.5S8.2 8.2 8.5 8Z" />
    ),
  },
  {
    id: 'telegram',
    label: 'Telegram',
    href: (text, url) => `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    icon: (
      <path d="M21 4 2.8 11.1c-1 .4-1 1.6 0 1.9l4.6 1.4 1.7 5.4c.2.7 1.1.9 1.6.4l2.5-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6L22 5.3c.2-.9-.4-1.6-1-1.3Zm-3.4 3.6-8 7.3-.3 3-1.3-4.2 9.6-6.1Z" />
    ),
  },
  {
    id: 'x',
    label: 'X',
    href: (text, url) => `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    icon: (
      <path d="M17.7 3h3.1l-6.8 7.7L22 21h-6.2l-4.9-6.4L5.3 21H2.2l7.2-8.3L2 3h6.4l4.4 5.8L17.7 3Zm-1.1 16.2h1.7L7.4 4.7H5.6l11 14.5Z" />
    ),
  },
  {
    id: 'bluesky',
    label: 'Bluesky',
    href: (text, url) => `https://bsky.app/intent/compose?text=${encodeURIComponent(`${text}\n${url}`)}`,
    icon: (
      <path d="M6.3 4.4C8.4 6 10.6 9.1 12 11c1.4-1.9 3.6-5 5.7-6.6C19.2 3.3 22 2.4 22 5.4c0 .6-.4 5-.6 5.7-.7 2.5-3.2 3.1-5.5 2.7 4 .7 5 2.9 2.8 5.2-4.2 4.3-6-1.1-6.5-2.5l-.2-.5-.2.5c-.5 1.4-2.3 6.8-6.5 2.5-2.2-2.3-1.2-4.5 2.8-5.2-2.3.4-4.8-.2-5.5-2.7-.2-.7-.6-5.1-.6-5.7 0-3 2.8-2.1 4.3-1Z" />
    ),
  },
  {
    id: 'facebook',
    label: 'Facebook',
    href: (_text, url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    icon: (
      <path d="M13.5 21v-7.5H16l.4-3h-2.9V8.7c0-.9.3-1.5 1.5-1.5h1.5V4.5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.2H8v3h2.5V21h3Z" />
    ),
  },
  {
    id: 'linkedin',
    label: 'LinkedIn',
    href: (_text, url) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    icon: (
      <path d="M4 3h16a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm1.8 7.2V18h2.6v-7.8H5.8Zm1.3-4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Zm3.1 4V18h2.6v-4.1c0-1.1.2-2.1 1.5-2.1s1.3 1.2 1.3 2.2v4h2.6v-4.5c0-2.2-.5-3.9-3-3.9-1.2 0-2 .7-2.4 1.3v-1.1h-2.6Z" />
    ),
  },
  {
    id: 'email',
    label: 'Email',
    href: (text, url, subject) =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(`${text}\n\n${url}`)}`,
    icon: <path d="M3 6h18v12H3V6Zm1.8 1.5 7.2 5.4 7.2-5.4H4.8Zm-.3 1.8v7.2h15V9.3L12 14.8 4.5 9.3Z" />,
  },
];

const INSTAGRAM_ICON = (
  <path d="M8 3h8a5 5 0 0 1 5 5v8a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5V8a5 5 0 0 1 5-5Zm0 1.8A3.2 3.2 0 0 0 4.8 8v8A3.2 3.2 0 0 0 8 19.2h8a3.2 3.2 0 0 0 3.2-3.2V8A3.2 3.2 0 0 0 16 4.8H8Zm4 3.2a4 4 0 1 1 0 8 4 4 0 0 1 0-8Zm0 1.8a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4Zm4.3-3a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
);

interface Props {
  text: string;
  url: string;
  subject: string;
  /** What "Copy" puts on the clipboard, and its label. */
  copy: { value: string; label: string };
  /** Instagram takes no prefilled post: given a handler, its card hands over a story image instead. */
  onInstagram?: () => void;
}

/** The row of share cards: one per platform, then copy and the phone's own share sheet. */
export default function ShareTargets({ text, url, subject, copy, onInstagram }: Props) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const doCopy = async () => {
    await navigator.clipboard.writeText(copy.value).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const native = () => navigator.share({ title: t('brand'), text, url }).catch(() => {});

  const icon = (path: ReactNode) => (
    <svg viewBox="0 0 24 24" aria-hidden>
      {path}
    </svg>
  );

  return (
    <div className="share-targets">
      {TARGETS.map(s => (
        <Fragment key={s.id}>
          <a className={`share-target ${s.id}`} href={s.href(text, url, subject)} target="_blank" rel="noreferrer">
            {icon(s.icon)}
            {s.id === 'email' ? t('share.email') : s.label}
          </a>
          {s.id === 'whatsapp' && onInstagram && (
            <button className="share-target instagram" onClick={onInstagram}>
              {icon(INSTAGRAM_ICON)}
              Instagram
            </button>
          )}
        </Fragment>
      ))}
      <button className="share-target" onClick={doCopy}>
        {icon(<path d="M8 3h11v13h-2V5H8V3ZM5 7h10v14H5V7Zm2 2v10h6V9H7Z" />)}
        {copied ? t('share.copied') : copy.label}
      </button>
      {typeof navigator.share === 'function' && (
        <button className="share-target" onClick={native}>
          {icon(<path d="M12 3 7.5 7.5l1 1 2.8-2.8V15h1.4V5.7l2.8 2.8 1-1L12 3ZM5 11v9h14v-9h-3v1.4h1.6v6.2H6.4v-6.2H8V11H5Z" />)}
          {t('share.more')}
        </button>
      )}
    </div>
  );
}
