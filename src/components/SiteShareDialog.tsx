import { useState } from 'react';
import { save } from '../certificate/download';
import { useI18n } from '../i18n';
import Dialog from './Dialog';
import ShareTargets from './ShareTargets';

/**
 * Sharing the site itself, from the masthead. Always the bare home page: the
 * address bar may hold the visitor's place and time, which stay theirs.
 */
export default function SiteShareDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const base = import.meta.env.BASE_URL;
  const url = new URL(base, window.location.origin).href;
  const text = t('site.share.text');
  // The preview shows what chat apps will really show: the page's own link-preview tags (index.html).
  const ogDescription = document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.content ?? '';
  const [note, setNote] = useState<'hint' | 'shared' | null>(null);

  // Instagram takes no link: hand over the story card (scripts/og_image.html) and copy the link for a sticker.
  const instagram = async () => {
    await navigator.clipboard.writeText(url).catch(() => {});
    const blob = await fetch(`${base}story-${lang}.png`).then(r => r.blob());
    const done = await save(blob, 'my-gaia-star-story.png', 'image/png');
    if (done !== 'cancelled') setNote(done === 'shared' ? 'shared' : 'hint');
  };

  return (
    <Dialog title={t('site.share.title')} onClose={onClose}>
      <div className="share">
        <figure className="share-card">
          <img src={`${base}og-image.png`} width={1200} height={630} alt="" />
          <figcaption>
            <span className="mono">{new URL(url).host}</span>
            <strong>{t('brand')}</strong>
            {ogDescription}
          </figcaption>
        </figure>
        <p className="share-url">{t('site.share.preview')}</p>

        <ShareTargets
          text={text}
          url={url}
          subject={t('site.share.subject')}
          copy={{ value: url, label: t('share.copyLink') }}
          onInstagram={instagram}
        />

        {note && (
          <div className="share-story" aria-live="polite">
            <img src={`${base}story-${lang}.png`} width={1080} height={1920} alt="" />
            <p>{t(note === 'shared' ? 'share.instagram.shared' : 'share.instagram.hint')}</p>
          </div>
        )}
      </div>
    </Dialog>
  );
}
