'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, type Role } from '@/lib/auth';
import { guiasDe, guiaPorId, type Guia } from '@/lib/guias/guias';

/**
 * Guías paso a paso de tareas que cruzan varias pantallas (crear un curso,
 * cerrar el acta, exportar a PÚLSAR…).
 *
 * A diferencia de la visita guiada (Tour), este panel NO bloquea la pantalla:
 * el usuario tiene que pulsar los botones de verdad mientras la guía le
 * acompaña. Por eso el panel va acoplado en una esquina, resalta el elemento
 * del paso sin taparlo, y su estado vive en sessionStorage para sobrevivir al
 * cambio de página.
 */

function Negrita({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\*\*[^*]+\*\*)/g).map((t, i) =>
        t.startsWith('**') && t.endsWith('**') ? <strong key={i}>{t.slice(2, -2)}</strong> : <span key={i}>{t}</span>,
      )}
    </>
  );
}

const CLAVE = 'guia_activa';

export function GuiaPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const [rol, setRol] = useState<Role | null>(null);
  const [lanzador, setLanzador] = useState(false);
  const [guia, setGuia] = useState<Guia | null>(null);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

  // Restaurar la guía en curso al montar (y al navegar de página se conserva).
  useEffect(() => {
    setRol(getUser()?.role ?? null);
    try {
      const raw = sessionStorage.getItem(CLAVE);
      if (raw) {
        const { id, paso } = JSON.parse(raw) as { id: string; paso: number };
        const g = guiaPorId(id);
        if (g) { setGuia(g); setI(Math.min(paso, g.pasos.length - 1)); }
      }
    } catch { /* sessionStorage no disponible */ }
  }, []);

  const guardar = useCallback((g: Guia | null, paso: number) => {
    try {
      if (g) sessionStorage.setItem(CLAVE, JSON.stringify({ id: g.id, paso }));
      else sessionStorage.removeItem(CLAVE);
    } catch { /* ignore */ }
  }, []);

  const iniciar = useCallback((g: Guia) => {
    setGuia(g); setI(0); setLanzador(false); guardar(g, 0);
  }, [guardar]);

  const cerrar = useCallback(() => { setGuia(null); setRect(null); guardar(null, 0); }, [guardar]);
  const irPaso = useCallback((n: number) => { if (guia) { setI(n); guardar(guia, n); } }, [guia, guardar]);

  useEffect(() => {
    const abrir = () => setLanzador(true);
    window.addEventListener('abrir-guias', abrir);
    return () => window.removeEventListener('abrir-guias', abrir);
  }, []);

  const paso = guia?.pasos[i] ?? null;
  // ¿Estamos en la pantalla donde se hace este paso?
  const enPantalla = !paso?.ruta || (pathname ?? '').startsWith(paso.ruta);

  // Resaltar el elemento del paso, si su pantalla es la actual y existe.
  useEffect(() => {
    if (!paso?.target || !enPantalla) { setRect(null); return; }
    let cancelado = false;
    // Si el elemento vive dentro de una pestaña de la ficha, pídele a la página
    // que la abra antes de intentar resaltarlo.
    if (paso.tab) window.dispatchEvent(new CustomEvent('curso-pestana', { detail: paso.tab }));
    const situar = () => {
      const el = document.querySelector(paso.target!) as HTMLElement | null;
      if (!el) { setRect(null); return; }
      const r = el.getBoundingClientRect();
      if (!cancelado) setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    // Espera breve a que la pantalla pinte tras navegar.
    const t0 = setTimeout(() => {
      const el = document.querySelector(paso.target!);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      situar();
    }, 300);
    const iv = setInterval(situar, 400);
    window.addEventListener('resize', situar);
    window.addEventListener('scroll', situar, true);
    return () => {
      cancelado = true; clearTimeout(t0); clearInterval(iv);
      window.removeEventListener('resize', situar);
      window.removeEventListener('scroll', situar, true);
    };
  }, [paso, enPantalla, pathname]);

  // --- Lanzador (lista de guías) ---
  if (lanzador) {
    const disponibles = rol ? guiasDe(rol) : [];
    return (
      <div className="modal-backdrop" onClick={() => setLanzador(false)} role="presentation">
        <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Guías paso a paso">
          <div className="card-header">
            <div className="card-title">Guías paso a paso</div>
            <div className="card-subtitle">Te acompañan mientras haces la tarea, sin salir de la pantalla</div>
          </div>
          {disponibles.length === 0 ? (
            <p className="muted" style={{ fontSize: 14 }}>No hay guías para tu perfil.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {disponibles.map((g) => (
                <button key={g.id} type="button" className="guia-item" onClick={() => iniciar(g)}>
                  <span className="guia-item-t">{g.titulo}</span>
                  <span className="guia-item-r">{g.resumen}</span>
                </button>
              ))}
            </div>
          )}
          <button className="btn btn-outline btn-small" style={{ marginTop: 14 }} onClick={() => setLanzador(false)}>Cerrar</button>
        </div>
      </div>
    );
  }

  if (!guia || !paso) return null;

  const ultimo = i === guia.pasos.length - 1;

  return (
    <>
      {rect && <div className="guia-foco" style={{ top: rect.top - 5, left: rect.left - 5, width: rect.width + 10, height: rect.height + 10 }} />}

      <aside className="guia-panel" role="dialog" aria-label={`Guía: ${guia.titulo}`}>
        <div className="guia-cab">
          <div>
            <div className="guia-tit">{guia.titulo}</div>
            <div className="guia-paso">Paso {i + 1} de {guia.pasos.length}</div>
          </div>
          <button type="button" className="guia-x" onClick={cerrar} aria-label="Cerrar la guía">×</button>
        </div>

        <h4 className="guia-h">{paso.titulo}</h4>
        <p className="guia-txt"><Negrita>{paso.texto}</Negrita></p>

        {!enPantalla && (
          <div className="guia-aviso">
            Este paso se hace en otra pantalla.
            {paso.irA && (
              <button type="button" className="btn btn-primary btn-small" style={{ marginTop: 8 }}
                onClick={() => router.push(paso.irA!)}>Ir a esa pantalla →</button>
            )}
          </div>
        )}

        <div className="guia-acciones">
          <button type="button" className="btn btn-outline btn-small" disabled={i === 0} onClick={() => irPaso(i - 1)}>Anterior</button>
          {ultimo
            ? <button type="button" className="btn btn-primary btn-small" onClick={cerrar}>Terminar</button>
            : <button type="button" className="btn btn-primary btn-small" onClick={() => irPaso(i + 1)}>Siguiente</button>}
        </div>
      </aside>
    </>
  );
}
