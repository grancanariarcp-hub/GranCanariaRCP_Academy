'use client';

import { useEffect } from 'react';
import { api } from '@/lib/api';

/**
 * Registra una llegada con ?ref=... (p.ej. desde PÚLSAR con ?ref=pulsar),
 * simétrico a lo que PÚLSAR hace con nuestro ?ref=academia.
 *
 * Solo una vez por pestaña y por fuente: sessionStorage evita contar cada
 * recarga. No envía nada personal, solo la fuente y la ruta de aterrizaje.
 */
export function useReferido() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get('ref');
      if (!ref) return;
      const marca = `ref_hit_${ref}`;
      if (sessionStorage.getItem(marca)) return;
      sessionStorage.setItem(marca, '1');
      api('/api/public/referido', {
        method: 'POST',
        body: JSON.stringify({ ref: ref.slice(0, 40), path: window.location.pathname.slice(0, 200) }),
      }).catch(() => {});
    } catch {
      /* sin acceso a window/URL: no pasa nada */
    }
  }, []);
}
