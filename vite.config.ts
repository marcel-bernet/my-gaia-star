import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// GitHub Pages serves the site from /gaia-maps/. Set BASE_PATH=/ for a custom domain.
export default defineConfig({
  base: process.env.BASE_PATH ?? '/gaia-maps/',
  plugins: [react()],
  // React + Leaflet + astronomy-engine is ~180 kB gzipped; jsPDF loads only on download.
  build: { chunkSizeWarningLimit: 700 },
});
