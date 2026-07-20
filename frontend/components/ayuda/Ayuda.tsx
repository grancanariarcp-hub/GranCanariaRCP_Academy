'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { articulo, temaDePantalla, type Articulo } from '@/lib/ayuda';
import { getUser, type Role } from '@/lib/auth';
import { Cuerpo } from './Formato';

/**
 * Ayuda contextual.
 *
 * La regla de fondo: la explicación tiene que estar donde surge la duda. Un
 * manual en otra pestaña se abandona a la mitad; un panel lateral deja la
 * pantalla detrás, de modo que se puede leer el paso e ir haciéndolo.
 *
 * Se usa así, junto al título de la sección que explica:
 *
 *   <h3>Acta del curso <Ayuda tema="profesor-acta" /></h3>
 *
 * O sin tema, para explicar la pantalla entera según la ruta actual:
 *
 *   <Ayuda variante="boton" />
 */

export function Ayuda({
  tema,
  variante = 'icono',
  etiqueta,
}: {
  /** Artículo a mostrar. Si se omite, el que corresponda a la ruta actual. */
  tema?: string;
  variante?: 'icono' | 'enlace' | 'boton';
  etiqueta?: string;
}) {
  const pathname = usePathname();
  const [abierto, setAbierto] = useState(false);
  const [rol, setRol] = useState<Role | null>(null);

  useEffect(() => {
    setRol(getUser()?.role ?? null);
  }, []);

  const id = tema ?? temaDePantalla(pathname ?? '', rol);
  // Una pantalla sin ayuda escrita no debe enseñar un botón que no explica nada.
  if (!id || !articulo(id)) return null;

  const texto = etiqueta ?? 'Ayuda';

  return (
    <>
      {variante === 'icono' && (
        <button
          type="button"
          className="ayuda-icono"
          onClick={() => setAbierto(true)}
          aria-label={`Ayuda: ${articulo(id)!.titulo}`}
          title="Cómo funciona esto"
        >
          ?
        </button>
      )}
      {variante === 'enlace' && (
        <button type="button" className="ayuda-enlace" onClick={() => setAbierto(true)}>
          ¿Cómo funciona?
        </button>
      )}
      {variante === 'boton' && (
        <button type="button" className="btn btn-outline btn-small" onClick={() => setAbierto(true)}>
          <span aria-hidden="true">?</span> {texto}
        </button>
      )}

      {abierto && <PanelAyuda temaInicial={id} onCerrar={() => setAbierto(false)} />}
    </>
  );
}

/**
 * El panel lateral. Guarda su propia pila de navegación para que se pueda
 * saltar a un artículo relacionado y volver sin perder de vista de dónde
 * venías.
 */
function PanelAyuda({ temaInicial, onCerrar }: { temaInicial: string; onCerrar: () => void }) {
  const [pila, setPila] = useState<string[]>([temaInicial]);
  const actual = articulo(pila[pila.length - 1]);

  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  useEffect(() => {
    function tecla(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar();
    }
    document.addEventListener('keydown', tecla);
    // Con el panel abierto, el fondo no debe desplazarse bajo el dedo.
    const previo = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', tecla);
      document.body.style.overflow = previo;
    };
  }, [cerrar]);

  if (!actual) return null;

  function ir(id: string) {
    setPila((p) => [...p, id]);
    document.querySelector('.ayuda-panel-cuerpo')?.scrollTo({ top: 0 });
  }

  const relacionados = (actual.relacionados ?? [])
    .map((r) => articulo(r))
    .filter((a): a is Articulo => !!a);

  return (
    <div className="ayuda-fondo" onClick={cerrar} role="presentation">
      <aside
        className="ayuda-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Ayuda: ${actual.titulo}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ayuda-panel-cabecera">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            {pila.length > 1 && (
              <button
                type="button"
                className="ayuda-volver"
                onClick={() => setPila((p) => p.slice(0, -1))}
                aria-label="Volver al artículo anterior"
              >
                ←
              </button>
            )}
            <div style={{ minWidth: 0 }}>
              <div className="ayuda-panel-seccion">{actual.seccion}</div>
              <h3 className="ayuda-panel-titulo">{actual.titulo}</h3>
            </div>
          </div>
          <button type="button" className="ayuda-cerrar" onClick={cerrar} aria-label="Cerrar la ayuda">
            ×
          </button>
        </header>

        <div className="ayuda-panel-cuerpo">
          <Cuerpo bloques={actual.cuerpo} />

          {relacionados.length > 0 && (
            <>
              <h4 className="ayuda-h">Seguir leyendo</h4>
              <div className="ayuda-relacionados">
                {relacionados.map((r) => (
                  <button key={r.id} type="button" className="ayuda-relacionado" onClick={() => ir(r.id)}>
                    <span className="ayuda-relacionado-t">{r.titulo}</span>
                    <span className="ayuda-relacionado-r">{r.resumen}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <footer className="ayuda-panel-pie">
          <Link href={`/ayuda?tema=${actual.id}`} onClick={cerrar}>
            Ver el manual completo →
          </Link>
        </footer>
      </aside>
    </div>
  );
}
