'use client';

import { redInfo, nombreEnlace, type EnlaceSocial } from '@/lib/social';

/**
 * Fila de iconos de redes sociales de un docente, para su ficha pública y su
 * tarjeta resumen. Si no tiene ninguno, no pinta nada (ni un hueco).
 */
export function SocialLinks({ enlaces, size = 20 }: { enlaces?: EnlaceSocial[] | null; size?: number }) {
  const lista = (enlaces ?? []).filter((e) => e && e.url);
  if (lista.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {lista.map((e, i) => (
        <a
          key={i}
          href={e.url}
          target="_blank"
          rel="noopener noreferrer"
          title={nombreEnlace(e)}
          aria-label={nombreEnlace(e)}
          onClick={(ev) => ev.stopPropagation()}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: size + 12, height: size + 12, borderRadius: 8,
            color: 'var(--primary-dark)', background: 'var(--gray-100)',
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
          // El SVG viene de nuestro catálogo, no de datos del usuario: seguro.
          dangerouslySetInnerHTML={{ __html: redInfo(e.red).icono }}
        />
      ))}
    </div>
  );
}
