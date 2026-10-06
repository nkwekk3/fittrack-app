import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Register service worker for production builds
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then((reg) => console.log('PWA Service Worker registered:', reg))
      .catch((err) => console.error('PWA Service Worker failed:', err));
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
