import { useEffect, useRef } from 'react';

/** A crisp canvas (device-pixel-ratio aware) redrawn whenever `draw` changes. */
export default function CanvasArt({
  width,
  height,
  draw,
  label,
  onPick,
}: {
  width: number;
  height: number;
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void | Promise<void>;
  label: string;
  /** Called with the x of a click/tap, in drawing units (0…width). */
  onPick?: (x: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(width * dpr);
    c.height = Math.round(height * dpr);
    const ctx = c.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    void draw(ctx, width, height);
  }, [width, height, draw]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={label}
      style={{ width: '100%', aspectRatio: `${width} / ${height}`, display: 'block', cursor: onPick ? 'pointer' : undefined }}
      onPointerDown={
        onPick &&
        (e => {
          const r = e.currentTarget.getBoundingClientRect();
          onPick(((e.clientX - r.left) / r.width) * width);
        })
      }
    />
  );
}
