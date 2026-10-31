import { LANGS, useI18n, type Lang } from '../i18n';

/** EN · ES · CA, in the masthead and wherever else the language matters (the certificate). */
export default function LangSwitch() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="langs" role="group" aria-label={t('language')}>
      {(Object.keys(LANGS) as Lang[]).map(l => (
        <button key={l} lang={l} aria-pressed={lang === l} title={LANGS[l]} onClick={() => setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
