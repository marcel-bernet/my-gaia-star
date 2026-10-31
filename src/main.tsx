import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource-variable/source-serif-4/opsz-italic.css';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/500-italic.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { I18nProvider } from './i18n';
import './styles.css';
import './proposals/plate.css';
import './proposals/redlight.css';
import './proposals/scanlaw.css';

// Style proposals, for comparing directions: ?style=plate | redlight | scanlaw.
const proposal = new URLSearchParams(window.location.search).get('style');
if (proposal && ['plate', 'redlight', 'scanlaw'].includes(proposal)) document.documentElement.dataset.style = proposal;
// Red Light maps brightness onto one red ramp (CSS filter chains clip bright colours to yellow).
if (proposal === 'redlight') {
  document.body.insertAdjacentHTML(
    'beforeend',
    `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="redlight" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.30 0.59 0.11 0 0  0.126 0.248 0.046 0 0  0.09 0.177 0.033 0 0  0 0 0 1 0"/></filter></svg>`,
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <App />
    </I18nProvider>
  </StrictMode>,
);
