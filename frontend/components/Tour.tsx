'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUser, type Role } from '@/lib/auth';
import { tourDe, claveVista, type PasoTour } from '@/lib/tour/pasos';

/**
 * Visita guiada. Se monta una vez (en AppShell) y hace tres cosas:
 *  - se lanza sola la primera vez que un rol entra;
 *  - se puede repetir en cualquier momento (evento `iniciar-tour`);
 *  - resalta el elemento de cada paso y explica qué es, sin librerías externas.
 *
 * Formato mínimo de texto: **negrita**, como en el resto de la ayuda.
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

interface Rect { top: number; left: number; width: number; height: number }

export function Tour() {
  const [rol, setRol] = useState<Role | null>(null);
  const [pasos, setPasos] = useState<PasoTour[]>([]);
  const [i, setI] = useState(-1); // -1 = cerrado
  const [rect, setRect] = useState<Rect | null>(null);

  const abierto = i >= 0 && i < pasos.length;
  const paso = abierto ? pasos[i] : null;

  // Localiza el elemento del paso (si lo tiene), lo trae a la vista y guarda su
  // posición. Si el objetivo no existe en esta pantalla, el paso se salta solo.
  const situar = useCallback((p: PasoTour | null) => {
    if (!p?.target) { setRect(null); return true; }
    const el = document.querySelector(p.target) as HTMLElement | null;
    if (!el) { setRect(null); return false; }
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
    return true;
  }, []);

  // Al cambiar de paso, situarlo; si su objetivo no está, avanzar hasta uno que sí.
  useEffect(() => {
    if (!abierto) return;
    let paso = i;
    while (paso < pasos.length && pasos[paso].target && !document.querySelector(pasos[paso].target!)) paso++;
    if (paso !== i) { setI(paso); return; }
    situar(pasos[paso] ?? null);
  }, [i, abierto, pasos, situar]);

  // Recalcular la posición mientras la visita está abierta (scroll, resize).
  useEffect(() => {
    if (!abierto || !paso?.target) return;
    const recalcular = () => situar(paso);
    window.addEventListener('resize', recalcular);
    window.addEventListener('scroll', recalcular, true);
    const t = setInterval(recalcular, 400); // sigue al elemento tras el scroll suave
    return () => {
      window.removeEventListener('resize', recalcular);
      window.removeEventListener('scroll', recalcular, true);
      clearInterval(t);
    };
  }, [abierto, paso, situar]);

  const cerrar = useCallback((completado: boolean) => {
    setI(-1);
    if (completado && rol) {
      try { localStorage.setItem(claveVista(rol), '1'); } catch { /* almacenamiento no disponible */ }
    }
  }, [rol]);

  const empezar = useCallback((r: Role) => {
    const t = tourDe(r);
    if (t.length === 0) return;
    setPasos(t);
    setI(0);
  }, []);

  // Arranque automático la primera vez + escucha del botón «repetir».
  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setRol(u.role);
    let yaVista = true;
    try { yaVista = localStorage.getItem(claveVista(u.role)) === '1'; } catch { /* ignore */ }
    if (!yaVista) {
      // Pequeña espera a que el panel termine de pintarse.
      const t = setTimeout(() => empezar(u.role), 700);
      return () => clearTimeout(t);
    }
  }, [empezar]);

  useEffect(() => {
    const u = getUser();
    const repetir = () => { if (u) empezar(u.role); };
    window.addEventListener('iniciar-tour', repetir);
    return () => window.removeEventListener('iniciar-tour', repetir);
  }, [empezar]);

  // Esc cierra; flechas navegan.
  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar(true);
      else if (e.key === 'ArrowRight') setI((n) => Math.min(pasos.length - 1, n + 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(0, n - 1));
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [abierto, pasos.length, cerrar]);

  if (!paso) return null;

  const ultimo = i === pasos.length - 1;
  const pad = 6;
  // Globo: bajo el elemento si hay sitio, si no encima; centrado si no hay objetivo.
  const globo: React.CSSProperties = rect
    ? (rect.top + rect.height + 190 < window.innerHeight
      ? { top: rect.top + rect.height + pad + 10, left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) }
      : { top: Math.max(12, rect.top - 190), left: Math.max(12, Math.min(rect.left, window.innerWidth - 372)) })
    : { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div className="tour-fondo" role="dialog" aria-modal="true" aria-label="Visita guiada">
      {/* Recorte que ilumina el elemento: cuatro sombras enormes rodean su hueco. */}
      {rect && (
        <div
          className="tour-foco"
          style={{
            top: rect.top - pad, left: rect.left - pad,
            width: rect.width + pad * 2, height: rect.height + pad * 2,
          }}
        />
      )}

      <div className="tour-globo" style={globo}>
        <div className="tour-paso">Paso {i + 1} de {pasos.length}</div>
        <h3 className="tour-titulo">{paso.titulo}</h3>
        <p className="tour-texto"><Negrita>{paso.texto}</Negrita></p>
        <div className="tour-acciones">
          <button type="button" className="tour-saltar" onClick={() => cerrar(true)}>
            {ultimo ? '' : 'Saltar'}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {i > 0 && (
              <button type="button" className="btn btn-outline btn-small" onClick={() => setI(i - 1)}>Anterior</button>
            )}
            <button
              type="button"
              className="btn btn-primary btn-small"
              onClick={() => (ultimo ? cerrar(true) : setI(i + 1))}
            >
              {ultimo ? 'Entendido' : 'Siguiente'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
