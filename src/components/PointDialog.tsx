import { useMemo, useState } from 'react';
import { useI18n, type Key } from '../i18n';
import Dialog from './Dialog';

/** "Okay, but what's the point?" — the site explained to someone who just wandered in. */

// Each section: a question, then its paragraphs.
const SECTIONS: { q: Key; a: Key[]; figure?: 'zenith' | 'hundred' | 'dipper' }[] = [
  { q: 'point.q.tldr', a: ['point.a.tldr.1', 'point.a.tldr.2'] },
  { q: 'point.q.zenith', a: ['point.a.zenith.1', 'point.a.zenith.2'], figure: 'zenith' },
  { q: 'point.q.gaia', a: ['point.a.gaia.1', 'point.a.gaia.2'] },
  { q: 'point.q.crowded', a: ['point.a.crowded.1', 'point.a.crowded.2'], figure: 'dipper' },
  { q: 'point.q.crowded.more', a: ['point.a.crowded.3', 'point.a.crowded.4'] },
  { q: 'point.q.lonely', a: ['point.a.lonely.1', 'point.a.lonely.2', 'point.a.lonely.3'], figure: 'hundred' },
  { q: 'point.q.dr4', a: ['point.a.dr4.1'] },
  { q: 'point.q.get', a: ['point.a.get.1', 'point.a.get.2'] },
];

function ZenithFigure({ label, zenith, horizon }: { label: string; zenith: string; horizon: string }) {
  return (
    <svg className="point-fig" viewBox="0 0 320 150" role="img" aria-label={label}>
      <path d="M20 132 Q160 -92 300 132" fill="none" stroke="var(--rule-2)" strokeDasharray="3 4" />
      <line x1="10" y1="132" x2="310" y2="132" stroke="var(--text-3)" />
      <line x1="160" y1="116" x2="160" y2="30" stroke="var(--text-3)" strokeDasharray="2 3" />
      <circle cx="160" cy="20" r="4.5" fill="var(--star)" />
      <circle cx="160" cy="20" r="10" fill="none" stroke="var(--star)" strokeOpacity="0.4" />
      {/* a small human, looking up */}
      <circle cx="160" cy="112" r="4" fill="var(--text-2)" />
      <line x1="160" y1="116" x2="160" y2="126" stroke="var(--text-2)" strokeWidth="2" />
      <line x1="160" y1="126" x2="155" y2="132" stroke="var(--text-2)" strokeWidth="2" />
      <line x1="160" y1="126" x2="165" y2="132" stroke="var(--text-2)" strokeWidth="2" />
      <circle cx="70" cy="80" r="2" fill="var(--text-3)" />
      <circle cx="245" cy="70" r="2" fill="var(--text-3)" />
      <circle cx="110" cy="45" r="1.5" fill="var(--text-3)" />
      <circle cx="220" cy="38" r="1.5" fill="var(--text-3)" />
      <text x="172" y="24" fill="var(--star)" fontSize="11" fontFamily="var(--mono)">
        {zenith}
      </text>
      <text x="14" y="146" fill="var(--text-3)" fontSize="10" fontFamily="var(--mono)">
        {horizon}
      </text>
    </svg>
  );
}

// Counts from Gaia DR3 (GAVO TAP, gaia.dr3lite), queried October 2026.
const BOWL_STARS = 136_457; // inside the quadrilateral Dubhe–Merak–Phecda–Megrez, ~44 deg²
const PER_DOT = 100;

// The Big Dipper: RA, Dec (J2000, degrees), V magnitude. The first four make the bowl.
const DIPPER: [number, number, number][] = [
  [165.932, 61.751, 1.8], // Dubhe
  [165.46, 56.382, 2.4], // Merak
  [178.458, 53.695, 2.4], // Phecda
  [183.857, 57.033, 3.3], // Megrez
  [193.507, 55.96, 1.8], // Alioth
  [200.981, 54.925, 2.2], // Mizar
  [206.885, 49.313, 1.9], // Alkaid
];
// Flat projection around the asterism, east to the left as on the sky.
const project = ([ra, dec]: [number, number, number]) => [
  20 + (207.5 - ra) * Math.cos((56 * Math.PI) / 180) * 17,
  20 + (62.3 - dec) * 17,
];

function mulberry32(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inside([x, y]: number[], poly: number[][]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The Big Dipper as your eyes see it — then the bowl as Gaia sees it, one dot per 100 stars. */
function DipperFigure() {
  const { t, lang } = useI18n();
  const [gaia, setGaia] = useState(false);
  const pts = DIPPER.map(project);
  const bowl = pts.slice(0, 4);
  const dots = useMemo(() => {
    const rand = mulberry32(7);
    const xs = bowl.map(p => p[0]);
    const ys = bowl.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const out: number[][] = [];
    while (out.length < Math.round(BOWL_STARS / PER_DOT)) {
      const p = [x0 + rand() * (x1 - x0), y0 + rand() * (y1 - y0)];
      if (inside(p, bowl)) out.push(p);
    }
    return out;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const nf = new Intl.NumberFormat(lang);
  return (
    <figure className="point-dipper">
      <svg className="point-fig" viewBox="0 0 440 262" role="img" aria-label={t('point.q.crowded')}>
        <polygon points={bowl.map(p => p.join(',')).join(' ')} fill={gaia ? 'var(--surface-2)' : 'none'} stroke="var(--rule-2)" />
        <polyline
          points={pts
            .slice(3)
            .map(p => p.join(','))
            .join(' ')}
          fill="none"
          stroke="var(--rule-2)"
        />
        <g className={`point-dots${gaia ? ' on' : ''}`}>
          {dots.map(([x, y], i) => (
            <circle key={i} cx={x.toFixed(1)} cy={y.toFixed(1)} r="0.75" fill="var(--text-2)" />
          ))}
        </g>
        {pts.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={1.3 * (4.6 - DIPPER[i][2])} fill="var(--text)" />
        ))}
      </svg>
      <figcaption>
        <button className="point-toggle" aria-pressed={gaia} onClick={() => setGaia(g => !g)}>
          {gaia ? t('point.dipper.eye') : t('point.dipper.gaia')}
        </button>
        <span className={`point-count${gaia ? ' on' : ''}`}>
          {gaia ? t('point.dipper.count', { n: nf.format(BOWL_STARS), per: PER_DOT }) : t('point.dipper.empty')}
        </span>
      </figcaption>
    </figure>
  );
}

const NUMBERS = (lang: string) => {
  const nf = new Intl.NumberFormat(lang);
  // Moon-sized patch (0.25° radius) at the bowl's centre, and at Baade's window toward the galactic centre (scaled from a 0.05° cone).
  return { n: nf.format(BOWL_STARS), eye: 12, moon: nf.format(584), mw: nf.format(200_000) };
};

/** A hundred Gaia stars: about one has ever had a paper's attention. Yours is the gold one. */
function HundredFigure({ studied, yours }: { studied: string; yours: string }) {
  const dots = Array.from({ length: 100 }, (_, i) => {
    const x = 10 + (i % 20) * 15;
    const y = 10 + Math.floor(i / 20) * 15;
    const kind = i === 27 ? 'studied' : i === 73 ? 'yours' : 'plain';
    return (
      <circle
        key={i}
        cx={x}
        cy={y}
        r={kind === 'plain' ? 2.5 : 4}
        fill={kind === 'yours' ? 'var(--star)' : kind === 'studied' ? 'var(--text)' : 'var(--text-3)'}
        opacity={kind === 'plain' ? 0.55 : 1}
      />
    );
  });
  return (
    <figure className="point-hundred">
      <svg className="point-fig" viewBox="0 0 300 80" role="img" aria-label={`${studied}; ${yours}`}>
        {dots}
      </svg>
      <figcaption>
        <span>
          <i className="dot studied" /> {studied}
        </span>
        <span>
          <i className="dot yours" /> {yours}
        </span>
      </figcaption>
    </figure>
  );
}

export default function PointDialog({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  return (
    <Dialog title={t('point.title')} onClose={onClose}>
      <div className="prose point">
        <p className="point-lede">{t('point.lede')}</p>
        {SECTIONS.map(s => (
          <section key={s.q}>
            <h3>{t(s.q)}</h3>
            {s.a.map(k => (
              <p key={k}>{t(k, NUMBERS(lang))}</p>
            ))}
            {s.figure === 'zenith' && (
              <ZenithFigure label={t('point.q.zenith')} zenith={t('point.fig.zenith')} horizon={t('point.fig.horizon')} />
            )}
            {s.figure === 'dipper' && <DipperFigure />}
            {s.figure === 'hundred' && <HundredFigure studied={t('point.fig.studied')} yours={t('point.fig.yours')} />}
          </section>
        ))}
        <button className="primary point-go" onClick={onClose}>
          {t('point.go')}
        </button>
      </div>
    </Dialog>
  );
}
