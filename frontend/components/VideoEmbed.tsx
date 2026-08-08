'use client';

import { useEffect, useRef } from 'react';
import { urlIncrustable } from '@/lib/videoEmbed';

/**
 * Reproductor de vídeo incrustado (YouTube/Vimeo) dentro del campus.
 *
 * Si el enlace es de un proveedor reconocido, se reproduce aquí mismo, en un
 * marco 16:9 responsive, sin sacar al alumno de la plataforma. Si no se
 * reconoce, se muestra un enlace normal como respaldo.
 *
 * `onPlay` (opcional): se llama la primera vez que el alumno interactúa con el
 * reproductor para darle play. Se detecta de forma pragmática, sin depender de
 * la API frágil de cada proveedor: al pulsar dentro del iframe, la ventana
 * pierde el foco y el elemento activo pasa a ser nuestro iframe.
 */
export function VideoEmbed({ url, title, onPlay }: { url: string | null; title?: string; onPlay?: () => void }) {
  const emb = urlIncrustable(url);
  const ref = useRef<HTMLIFrameElement>(null);
  const fired = useRef(false);

  useEffect(() => {
    if (!onPlay || !emb) return;
    const alPulsar = () => {
      if (fired.current) return;
      // Un pequeño desfase: el foco pasa al iframe justo tras el clic.
      setTimeout(() => {
        if (!fired.current && document.activeElement === ref.current) {
          fired.current = true;
          onPlay();
        }
      }, 0);
    };
    window.addEventListener('blur', alPulsar);
    return () => window.removeEventListener('blur', alPulsar);
  }, [onPlay, emb]);

  if (!emb) {
    return url ? (
      <a className="btn btn-primary btn-small" href={url} target="_blank" rel="noreferrer">Abrir vídeo</a>
    ) : null;
  }
  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
      <iframe
        ref={ref}
        src={emb}
        title={title || 'Vídeo del curso'}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        allowFullScreen
        loading="lazy"
      />
    </div>
  );
}
