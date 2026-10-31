import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { SERVICES } from './src/config.ts';
import { checkPublicEnv, contentSecurityPolicy, origins } from './src/csp.ts';

/**
 * Refuses unsafe VITE_* settings, and writes the Content-Security-Policy and
 * Referrer-Policy into index.html. Build only: the dev server injects inline
 * scripts for hot reload, which the policy would block.
 */
function security(env: Record<string, string>): Plugin {
  return {
    name: 'my-gaia-star-security',
    apply: 'build',
    configResolved() {
      const problems = checkPublicEnv(env);
      if (problems.length) throw new Error(`Unsafe build settings:\n  ${problems.join('\n  ')}`);
    },
    transformIndexHtml() {
      const csp = contentSecurityPolicy({
        connect: origins([
          SERVICES.vizier,
          SERVICES.gavoTap,
          ...SERVICES.simbadTap,
          SERVICES.nominatim,
          env.VITE_API_BASE,
          env.VITE_DR4_PROXY,
        ]),
        img: origins([SERVICES.tiles]),
      });
      return [
        { tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' },
        // The address bar holds the visitor's place and time: other sites get the origin only.
        { tag: 'meta', attrs: { name: 'referrer', content: 'strict-origin-when-cross-origin' }, injectTo: 'head-prepend' },
      ];
    },
  };
}

// GitHub Pages serves the site from /my-gaia-star/. Set BASE_PATH=/ for a custom domain.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  return {
    base: process.env.BASE_PATH ?? '/my-gaia-star/',
    plugins: [react(), security(env)],
    // React + Leaflet + astronomy-engine is ~180 kB gzipped; jsPDF loads only on download.
    build: { chunkSizeWarningLimit: 700 },
    server: { port: Number(process.env.PORT) || 5173 },
  };
});
