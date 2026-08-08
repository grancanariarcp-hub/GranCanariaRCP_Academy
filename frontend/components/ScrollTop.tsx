'use client';

import { useEffect, useState } from 'react';

/**
 * Botón flotante «volver arriba». Aparece al bajar y devuelve al principio de la
 * página. Va en el layout raíz, de modo que acompaña el scroll en TODAS las
 * pantallas (públicas, gestión y campus) sin tener que añadirlo una por una.
 */
export function ScrollTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 320);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="scroll-top-btn no-print"
      aria-label="Volver arriba"
      title="Volver arriba"
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  );
}
