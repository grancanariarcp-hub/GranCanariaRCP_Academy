'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Muestra su contenido con una transición cuando entra en pantalla al hacer
 * scroll. Da sensación de página viva sin cargar ninguna librería.
 */
export function Reveal({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Si el navegador no lo soporta o se prefiere menos movimiento, se ve directo.
    if (typeof IntersectionObserver === 'undefined'
      || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect(); } },
      { threshold: 0.12 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(28px)',
        transition: `opacity .6s ease ${delay}ms, transform .6s cubic-bezier(.22,.9,.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
