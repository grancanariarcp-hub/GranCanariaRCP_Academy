'use client';

import { urlIncrustable } from '@/lib/videoEmbed';

/**
 * Reproductor de vídeo incrustado (YouTube/Vimeo) dentro del campus.
 *
 * Si el enlace es de un proveedor reconocido, se reproduce aquí mismo, en un
 * marco 16:9 responsive, sin sacar al alumno de la plataforma. Si no se
 * reconoce, se muestra un enlace normal como respaldo (p. ej. un vídeo alojado
 * en otro sitio).
 */
export function VideoEmbed({ url, title }: { url: string | null; title?: string }) {
  const emb = urlIncrustable(url);
  if (!emb) {
    return url ? (
      <a className="btn btn-primary btn-small" href={url} target="_blank" rel="noreferrer">Abrir vídeo</a>
    ) : null;
  }
  return (
    <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%', borderRadius: 10, overflow: 'hidden', background: '#000' }}>
      <iframe
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
