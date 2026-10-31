import { useEffect, useRef, useState } from 'react';
import type { Result } from '../types';
import { downloadPdf, downloadPng } from '../certificate/download';
import { renderCertificate, type Dr4Summary } from '../certificate/render';
import { fitFiveParameters, transitPoints } from '../dr4/epoch';
import { DR4_RELEASE } from '../config';
import { epochAstrometryFor } from '../dr4/source';
import type { Literature } from '../sky/simbad';
import { formatLongDate } from '../format';
import { useI18n } from '../i18n';
import type { Star } from '../sky/gaia';
import { formatMoment } from '../sky/time';
import Dialog from './Dialog';

interface Props {
  star: Star;
  result: Result;
  placeName: string;
  /** SIMBAD result; null if it couldn't be checked, and the page then hedges. */
  literature: Literature | null;
  onClose: () => void;
}

export default function CertificateDialog({ star, result, placeName, literature, onClose }: Props) {
  const { t, lang } = useI18n();
  const [title, setTitle] = useState(t('cert.defaultTitle'));
  const [dedication, setDedication] = useState('');
  const [canvas, setCanvas] = useState<HTMLCanvasElement | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  // The star's own DR4 passes, once DR4 is out and reachable; otherwise the page says when they arrive.
  const [dr4, setDr4] = useState<Dr4Summary | null>(null);
  useEffect(() => {
    let live = true;
    epochAstrometryFor(star).then(r => {
      if (!live || r.kind !== 'live') return;
      const fit = fitFiveParameters(r.data);
      if (fit) setDr4({ years: transitPoints(r.data).map(p => p.year), parallax: fit.parallax, parallaxErr: fit.errors[2] });
    });
    return () => {
      live = false;
    };
  }, [star]);

  // Redraw shortly after typing stops.
  useEffect(() => {
    let live = true;
    const id = setTimeout(async () => {
      const c = await renderCertificate({
        star,
        frame: result.frame,
        title: title.trim() || t('cert.defaultTitle'),
        dedication,
        literature,
        dr4,
        dr4Date: formatLongDate(DR4_RELEASE, lang),
        made: new Date(),
        subtitle: `${formatMoment(result.frame.date, result.zone, lang)} · ${placeName}`,
        t,
        lang,
      });
      if (live) setCanvas(c);
    }, 250);
    return () => {
      live = false;
      clearTimeout(id);
    };
  }, [star, result, title, dedication, placeName, literature, dr4, t, lang]);

  useEffect(() => {
    const host = preview.current;
    if (!host || !canvas) return;
    host.replaceChildren(canvas);
  }, [canvas]);

  const filename = `gaia-dr3-${star.id}`;
  const save = async (kind: 'pdf' | 'png') => {
    if (!canvas) return;
    setBusy(true);
    try {
      if (kind === 'pdf') await downloadPdf(canvas, `${filename}.pdf`);
      else await downloadPng(canvas, `${filename}.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={t('cert.title')} onClose={onClose} wide>
      <div className="cert">
        <div className="cert-form">
          <label className="field">
            <span className="label">{t('cert.field.title')}</span>
            <input value={title} maxLength={60} onChange={e => setTitle(e.target.value)} />
          </label>
          <label className="field">
            <span className="label">{t('cert.field.dedication')}</span>
            <textarea value={dedication} maxLength={140} rows={3} onChange={e => setDedication(e.target.value)} />
          </label>
          <button className="primary" onClick={() => save('pdf')} disabled={!canvas || busy}>
            {canvas ? t('cert.pdf') : t('cert.making')}
          </button>
          <button className="secondary" onClick={() => save('png')} disabled={!canvas || busy}>
            {t('cert.png')}
          </button>
        </div>
        <div className="cert-preview" aria-live="polite">
          {!canvas && <span className="spinner" />}
          {/* Holds the rendered canvas; React never renders children into it. */}
          <div className="cert-canvas" ref={preview} />
        </div>
      </div>
    </Dialog>
  );
}
