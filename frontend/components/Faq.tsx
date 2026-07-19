'use client';

import { useState } from 'react';

/**
 * Preguntas frecuentes en acordeón.
 *
 * Resuelve las dudas que más frenan una matrícula (validez del certificado,
 * plazos, devoluciones) y, al ser texto real en la página, mejora el
 * posicionamiento en buscadores. Se usan <details>/<summary> nativos para que
 * funcione y sea accesible aunque falle el JavaScript.
 */

export interface ItemFaq {
  pregunta: string;
  respuesta: React.ReactNode;
}

export function Faq({ items, titulo = 'Preguntas frecuentes' }: { items: ItemFaq[]; titulo?: string }) {
  const [abierta, setAbierta] = useState<number | null>(0);

  return (
    <section style={{ maxWidth: 760, margin: '0 auto 48px' }}>
      <h2 style={{ textAlign: 'center', marginBottom: 18 }}>
        <span className="heading-underline">{titulo}</span>
      </h2>

      <div className="faq">
        {items.map((it, i) => (
          <details key={it.pregunta} open={abierta === i} onToggle={(e) => {
            if ((e.target as HTMLDetailsElement).open) setAbierta(i);
            else if (abierta === i) setAbierta(null);
          }}>
            <summary>{it.pregunta}</summary>
            <div className="faq-cuerpo">{it.respuesta}</div>
          </details>
        ))}
      </div>
    </section>
  );
}
