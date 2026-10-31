import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { localWallTime } from '../sky/time';
import type { Status } from '../types';
import { digitsToId, idToDigits, isSourceId, parseName, segments, slotOptions, type Digits } from '../names/name';
import { CatalogueUnavailable, starById, type Star } from '../sky/gaia';

type By = 'id' | 'name';

/** Now on the visitor's clock, as <input type="datetime-local"> wants it. */
function localNow() {
  const { date, time } = localWallTime();
  return `${date}T${time}`;
}

/**
 * Find a star again by its Gaia ID or its name, and go to wherever on Earth
 * it is straight overhead — now, or at a chosen moment. Shown in a dialog.
 */
export default function StarFinder({
  current,
  onFound,
}: {
  current: string | null;
  onFound: (star: Star, when: Date | null) => void;
}) {
  const { t, lang } = useI18n();
  const [by, setBy] = useState<By>('name');
  const [id, setId] = useState('');
  const [digits, setDigits] = useState<Digits>(() => idToDigits(current ?? '0'));
  const [paste, setPaste] = useState('');
  const [pasteMsg, setPasteMsg] = useState<string | null>(null);
  const [now, setNow] = useState(true);
  const [moment, setMoment] = useState(localNow);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  // Start from the star on screen, so its own name is what you see first.
  useEffect(() => {
    if (current) {
      setDigits(idToDigits(current));
      setId(current);
    }
  }, [current]);

  const segs = useMemo(() => segments(digits, lang), [digits, lang]);
  const nameId = useMemo(() => digitsToId(digits), [digits]);
  const targetId = by === 'id' ? id.trim() : nameId;

  const readPaste = (text: string) => {
    setPaste(text);
    if (!text.trim()) return setPasteMsg(null);
    const found = parseName(text);
    if (found) {
      setDigits(found.digits);
      setPasteMsg(null);
    } else setPasteMsg(t('find.paste.bad'));
  };

  const go = async (e: FormEvent) => {
    e.preventDefault();
    if (!isSourceId(targetId)) return setStatus({ kind: 'error', message: t('find.id.bad') });
    setStatus({ kind: 'loading' });
    try {
      const star = await starById(targetId);
      if (!star) return setStatus({ kind: 'error', message: t(by === 'id' ? 'find.none.id' : 'find.none.name') });
      setStatus({ kind: 'idle' });
      onFound(star, now ? null : new Date(moment));
    } catch (err) {
      console.error(err);
      setStatus({ kind: 'error', message: err instanceof CatalogueUnavailable ? t('error.catalogue') : String(err) });
    }
  };

  return (
    <form className="finder-body" onSubmit={go}>
      <p className="hint">{t('find.lede')}</p>
      <div className="segmented" role="radiogroup" aria-label={t('find.title')}>
        {(['name', 'id'] as By[]).map(b => (
          <button type="button" key={b} role="radio" aria-checked={by === b} onClick={() => setBy(b)}>
            {t(b === 'id' ? 'find.byId' : 'find.byName')}
          </button>
        ))}
      </div>

      {by === 'id' ? (
        <input
          className="finder-id mono"
          inputMode="numeric"
          value={id}
          onChange={e => setId(e.target.value.replace(/[^\d]/g, ''))}
          placeholder={t('find.id.placeholder')}
          aria-label={t('find.byId')}
        />
      ) : (
        <>
          <p className="madlib" lang={lang}>
            {segs.map((s, i) => {
              const space = i > 0 && !segs[i - 1].glue && s.text !== ',' && s.text !== '.' ? ' ' : '';
              if (!s.slot) return <span key={i}>{space + s.text}</span>;
              const slot = s.slot;
              const opts = slotOptions(digits, slot, lang);
              const shown =
                i === 0 ? opts[digits[slot]].charAt(0).toUpperCase() + opts[digits[slot]].slice(1) : opts[digits[slot]];
              return (
                <span key={i}>
                  {space}
                  <span className="choice">
                    {shown}
                    <select
                      value={digits[slot]}
                      onChange={e => setDigits(d => ({ ...d, [slot]: Number(e.target.value) }))}
                      aria-label={slot}
                    >
                      {opts.map((o, v) => (
                        <option key={v} value={v}>
                          {i === 0 ? o.charAt(0).toUpperCase() + o.slice(1) : o}
                        </option>
                      ))}
                    </select>
                  </span>
                </span>
              );
            })}
          </p>
          <input
            className="finder-paste"
            value={paste}
            onChange={e => readPaste(e.target.value)}
            placeholder={t('find.paste')}
            aria-label={t('find.paste')}
          />
          {pasteMsg && <p className="hint">{pasteMsg}</p>}
          <p className="mono finder-for">Gaia DR3 {nameId}</p>
        </>
      )}

      <div className="segmented" role="radiogroup" aria-label={t('when')}>
        {[true, false].map(n => (
          <button type="button" key={String(n)} role="radio" aria-checked={now === n} onClick={() => setNow(n)}>
            {t(n ? 'mode.now' : 'mode.moment')}
          </button>
        ))}
      </div>
      {!now && (
        <>
          <input type="datetime-local" value={moment} onChange={e => setMoment(e.target.value)} aria-label={t('when')} />
          <p className="hint">{t('find.when.zone')}</p>
        </>
      )}

      <button className="primary" type="submit" disabled={status.kind === 'loading' || (by === 'id' && !id)}>
        {status.kind === 'loading' ? (
          <>
            <span className="spinner" aria-hidden /> {t('find.looking')}
          </>
        ) : (
          t('find.go')
        )}
      </button>
      {status.kind === 'error' && (
        <p className="error" role="alert">
          {status.message}
        </p>
      )}
    </form>
  );
}
