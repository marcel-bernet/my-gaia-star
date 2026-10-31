/** The site's one symbol — the zenith crosshair of the favicon and the map pin. */
export default function ZenithMark({ size = 16 }: { size?: number }) {
  return (
    <svg className="zenith-mark" viewBox="0 0 24 24" width={size} height={size} aria-hidden>
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M12 1.5v5M12 17.5v5M1.5 12h5M17.5 12h5" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="1.75" fill="currentColor" />
    </svg>
  );
}
