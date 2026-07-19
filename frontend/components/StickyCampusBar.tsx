'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * Barra fija inferior con la llamada al campus. Aparece al empezar a bajar y
 * se oculta cuando el bloque real del campus entra en pantalla, para no repetir
 * el mismo mensaje dos veces. Se puede cerrar.
 */
export function StickyCampusBar({ anchorId }: { anchorId?: string }) {
  const [visible, setVisible] = useState(false);
  const [atAnchor, setAtAnchor] = useState(false);
  const [closed, setClosed] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 380);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    let obs: IntersectionObserver | undefined;
    // Sin ancla la barra permanece visible: la página no repite el mensaje.
    const target = anchorId ? document.getElementById(anchorId) : null;
    if (target && typeof IntersectionObserver !== 'undefined') {
      obs = new IntersectionObserver(([e]) => setAtAnchor(e.isIntersecting), { threshold: 0.25 });
      obs.observe(target);
    }
    return () => { window.removeEventListener('scroll', onScroll); obs?.disconnect(); };
  }, [anchorId]);

  const shown = visible && !atAnchor && !closed;

  return (
    <>
    {/* Reserva el alto de la barra para que no tape el final de la página */}
    <div aria-hidden="true" style={{ height: 72 }} />
    <div
      aria-hidden={!shown}
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 90,
        transform: shown ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform .35s cubic-bezier(.22,.9,.3,1)',
        background: 'linear-gradient(135deg,var(--primary-dark) 0%,var(--secondary-dark) 60%,#0d9488 100%)',
        color: '#fff', boxShadow: '0 -4px 18px rgba(0,0,0,.22)',
        padding: '10px 14px',
      }}
    >
      <div style={{ maxWidth: 960, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>
          ¿Quieres formarte oficialmente? <span style={{ opacity: 0.9, fontWeight: 400 }}>Cursos acreditados con certificado verificable.</span>
        </span>
        <Link href="/" className="btn press" style={{ background: '#fff', color: 'var(--primary-dark)', fontWeight: 700, padding: '8px 18px' }}>
          Ver el campus
        </Link>
        <button
          onClick={() => setClosed(true)}
          aria-label="Cerrar"
          style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.75)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}
        >
          ×
        </button>
      </div>
    </div>
    </>
  );
}
