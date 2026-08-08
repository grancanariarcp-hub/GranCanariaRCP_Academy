'use client';

import { useEffect } from 'react';

/**
 * Registra el service worker y mantiene la app SIEMPRE actualizada sola.
 *
 * Antes, al publicar una versión nueva, una pestaña ya abierta se quedaba con la
 * vieja hasta que la persona refrescaba. Ahora:
 *  - el SW nuevo toma el control en cuanto está listo (skipWaiting en sw.js),
 *  - cuando eso pasa, recargamos la página una vez para servir la versión nueva,
 *  - y comprobamos si hay versión nueva al abrir y cada vez que se vuelve a la
 *    pestaña (al «reconectarse»), no solo al arrancar.
 * En la primera instalación NO se recarga (no había versión previa que sustituir).
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    // Si ya había un SW controlando, un cambio de control = actualización.
    const yaControlado = !!navigator.serviceWorker.controller;
    let recargando = false;

    const alCambiarControl = () => {
      if (recargando || !yaControlado) return;
      recargando = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', alCambiarControl);

    navigator.serviceWorker.register('/sw.js')
      .then((reg) => { reg.update().catch(() => {}); })
      .catch(() => {/* ignore */});

    // Al volver a la pestaña, pedir al navegador que busque versión nueva.
    const alVolver = () => {
      if (document.visibilityState !== 'visible') return;
      navigator.serviceWorker.getRegistration().then((r) => r?.update()).catch(() => {});
    };
    document.addEventListener('visibilitychange', alVolver);

    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', alCambiarControl);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, []);

  return null;
}
