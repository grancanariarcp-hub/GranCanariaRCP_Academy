'use client';

import Link from 'next/link';
import type { Bloque } from '@/lib/ayuda';

/**
 * Pintado de los bloques del manual.
 *
 * El texto admite un mínimo de formato —**negrita**, `código` y
 * [enlaces](/ruta)— porque escribir el manual en HTML lo volvería ilegible en
 * el fuente, y meter un motor de markdown entero sería traer 40 KB para
 * resolver tres marcas.
 */

const MARCAS = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g;

export function Texto({ children }: { children: string }) {
  const trozos = children.split(MARCAS);
  return (
    <>
      {trozos.map((t, i) => {
        if (t.startsWith('**') && t.endsWith('**')) return <strong key={i}>{t.slice(2, -2)}</strong>;
        if (t.startsWith('`') && t.endsWith('`')) {
          return (
            <code key={i} style={{ background: '#eef2f7', padding: '1px 5px', borderRadius: 4, fontSize: '0.92em' }}>
              {t.slice(1, -1)}
            </code>
          );
        }
        const enlace = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t);
        if (enlace) {
          return (
            <Link key={i} href={enlace[2]} style={{ color: 'var(--secondary-dark)', fontWeight: 600 }}>
              {enlace[1]}
            </Link>
          );
        }
        return <span key={i}>{t}</span>;
      })}
    </>
  );
}

export function Cuerpo({ bloques }: { bloques: Bloque[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case 'titulo':
            return (
              <h4 key={i} className="ayuda-h">
                <Texto>{b.texto}</Texto>
              </h4>
            );
          case 'texto':
            return (
              <p key={i} className="ayuda-p">
                <Texto>{b.texto}</Texto>
              </p>
            );
          case 'pasos':
            return (
              <ol key={i} className="ayuda-pasos">
                {b.pasos.map((p, j) => (
                  <li key={j}>
                    <Texto>{p}</Texto>
                  </li>
                ))}
              </ol>
            );
          case 'lista':
            return (
              <ul key={i} className="ayuda-lista">
                {b.items.map((p, j) => (
                  <li key={j}>
                    <Texto>{p}</Texto>
                  </li>
                ))}
              </ul>
            );
          case 'aviso':
            return (
              <div key={i} className="ayuda-nota ayuda-nota-aviso">
                <span aria-hidden="true">⚠️</span>
                <div>
                  <Texto>{b.texto}</Texto>
                </div>
              </div>
            );
          case 'truco':
            return (
              <div key={i} className="ayuda-nota ayuda-nota-truco">
                <span aria-hidden="true">💡</span>
                <div>
                  <Texto>{b.texto}</Texto>
                </div>
              </div>
            );
          case 'duda':
            return (
              <div key={i} className="ayuda-duda">
                <p className="ayuda-duda-p">
                  <Texto>{b.pregunta}</Texto>
                </p>
                <p className="ayuda-p" style={{ margin: 0 }}>
                  <Texto>{b.respuesta}</Texto>
                </p>
              </div>
            );
        }
      })}
    </>
  );
}
