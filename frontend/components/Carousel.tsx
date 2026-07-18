'use client';

import { useEffect, useState } from 'react';

/** Carrusel de imágenes sencillo: auto-rota, flechas y puntos. Sin dependencias. */
export function Carousel({ images, height = 260 }: { images: string[]; height?: number }) {
  const [i, setI] = useState(0);
  const n = images.length;

  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 4500);
    return () => clearInterval(t);
  }, [n]);

  if (n === 0) return null;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', background: '#000' }}>
      {images.map((src, idx) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={idx}
          src={src}
          alt=""
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover',
            opacity: idx === i ? 1 : 0, transition: 'opacity 0.6s ease',
          }}
        />
      ))}

      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Anterior" style={arrow('left')}>‹</button>
          <button onClick={() => go(1)} aria-label="Siguiente" style={arrow('right')}>›</button>
          <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', gap: 6, justifyContent: 'center' }}>
            {images.map((_, idx) => (
              <span key={idx} onClick={() => setI(idx)} style={{ width: 8, height: 8, borderRadius: 999, background: idx === i ? '#fff' : 'rgba(255,255,255,0.5)', cursor: 'pointer' }} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function arrow(side: 'left' | 'right'): React.CSSProperties {
  return {
    position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)',
    background: 'rgba(0,0,0,0.4)', color: '#fff', border: 'none', borderRadius: 999,
    width: 34, height: 34, fontSize: 22, lineHeight: 1, cursor: 'pointer',
  };
}
