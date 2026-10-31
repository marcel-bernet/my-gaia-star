import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

/** Drawing width of a figure's canvas; CanvasArt scales it to the column. */
export const FIGURE_W = 352;

/** A numbered figure in the star card: "Fig. 3  In the Milky Way", the drawing, a caption. */
export default function Figure({
  n,
  title,
  children,
  caption,
  kicker,
  className,
}: {
  n: number;
  title: string;
  children: ReactNode;
  caption?: ReactNode;
  kicker?: string;
  className?: string;
}) {
  const { t } = useI18n();
  return (
    <figure className={className ? `fig ${className}` : 'fig'}>
      {kicker && <p className="badge mono">{kicker}</p>}
      <figcaption className="fig-title">
        <span className="fig-num mono">{t('fig', { n })}</span> {title}
      </figcaption>
      {children}
      {caption && <p className="fig-caption">{caption}</p>}
    </figure>
  );
}
