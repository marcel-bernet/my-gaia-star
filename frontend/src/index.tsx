// App bootstrap and React suspense boundary.
import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import './tailwind.output.css';
import App from './App';
import './i18n'; // Import i18n configuration

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <Suspense fallback={<div>Loading...</div>}>
      <App />
    </Suspense>
  </React.StrictMode>
);
