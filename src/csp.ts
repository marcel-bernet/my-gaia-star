/**
 * The Content-Security-Policy, built from the services in config.ts so it can
 * never drift from what the code actually calls. vite.config.ts writes it into
 * index.html at build time (GitHub Pages can't send headers; a host that can
 * should send the same string as a header and add frame-ancestors 'none').
 *
 * What it buys: even if some data shown on the page were turned into markup
 * by mistake, no injected script could run, and nothing could be sent
 * anywhere but the services listed here.
 */

/** "https://host:port" for each URL, ignoring anything that isn't one. */
export function origins(urls: (string | undefined)[]): string[] {
  const out = new Set<string>();
  for (const u of urls) {
    if (!u) continue;
    try {
      out.add(new URL(u.replace(/\{[a-z]\}/g, 'x')).origin);
    } catch {
      /* not a URL */
    }
  }
  return [...out].sort();
}

export function contentSecurityPolicy({ connect, img }: { connect: string[]; img: string[] }): string {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Leaflet positions its panes with inline styles.
    "style-src 'self' 'unsafe-inline'",
    // data: and blob: for the canvas figures and the certificate download.
    `img-src 'self' data: blob: ${img.join(' ')}`.trim(),
    "font-src 'self' data:",
    `connect-src 'self' ${connect.join(' ')}`.trim(),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-src 'none'",
    "worker-src 'self' blob:",
    'upgrade-insecure-requests',
  ].join('; ');
}

const SECRET_NAME = /KEY|SECRET|TOKEN|PASSWORD|PASSWD|CREDENTIAL|PRIVATE/i;

/**
 * Build-time checks on the VITE_* settings: they end up in public JavaScript,
 * so a secret there is a published secret, and a plain-http server would
 * expose every visitor's position on the wire. Returns the problems found.
 */
export function checkPublicEnv(env: Record<string, string | undefined>): string[] {
  const problems: string[] = [];
  for (const [name, value] of Object.entries(env)) {
    if (!name.startsWith('VITE_') || !value) continue;
    if (SECRET_NAME.test(name)) problems.push(`${name}: VITE_* variables are public; never put a secret in one`);
  }
  for (const name of ['VITE_API_BASE', 'VITE_DR4_PROXY']) {
    const value = env[name];
    if (!value) continue;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      problems.push(`${name}: not a URL`);
      continue;
    }
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) problems.push(`${name}: must be https://`);
    if (url.username || url.password) problems.push(`${name}: must not contain credentials`);
    if (url.search || url.hash) problems.push(`${name}: must not carry a query string or fragment`);
  }
  return problems;
}
