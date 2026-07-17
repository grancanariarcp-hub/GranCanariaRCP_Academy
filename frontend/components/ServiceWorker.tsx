'use client';

import { useEffect } from 'react';

/** Registra el service worker en el cliente (necesario para instalar la PWA). */
export function ServiceWorker() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ignore */});
    }
  }, []);
  return null;
}
