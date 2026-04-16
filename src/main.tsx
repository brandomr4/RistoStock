import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Register Service Worker with proper periodic updates (non-hook version)
const updateSW = registerSW({
  onRegistered(r) {
    if (r) {
      setInterval(() => {
        r.update();
      }, 60 * 60 * 1000); // Check every hour
    }
  },
  immediate: true
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
