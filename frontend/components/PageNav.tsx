'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { getUser, homeForRole } from '@/lib/auth';
import { articulo, temaDePantalla } from '@/lib/ayuda';
import { Ayuda } from '@/components/ayuda/Ayuda';

/**
 * Navegación superior común a todas las páginas: flecha "Volver" que devuelve a
 * la página anterior real del historial y enlace "Inicio".
 *
 * "Inicio" apunta al panel del rol cuando hay sesión abierta (y solo a la
 * portada pública cuando no la hay): así volver nunca aparenta cerrar sesión.
 *
 * @param backHref  Destino fijo para el botón Volver. Si se omite, se usa el
 *                  historial del navegador, con el inicio como red de seguridad
 *                  cuando la página se abrió directamente (QR, enlace externo).
 * @param ayuda     Añade «¿Cómo funciona?», que abre la ayuda de esta pantalla.
 *                  Si la ruta no tiene ayuda escrita, no se muestra nada.
 */
export function PageNav({
  backHref,
  backLabel = 'Volver',
  light = false,
  ayuda = true,
}: {
  backHref?: string;
  backLabel?: string;
  light?: boolean;
  ayuda?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [home, setHome] = useState('/');
  const [hayAyuda, setHayAyuda] = useState(false);

  useEffect(() => {
    const u = getUser();
    setHome(u ? homeForRole(u.role) : '/');
    const tema = temaDePantalla(pathname ?? '', u?.role ?? null);
    setHayAyuda(!!tema && !!articulo(tema));
  }, [pathname]);

  const color = light ? 'rgba(255,255,255,0.9)' : undefined;

  function goBack() {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push(home);
  }

  return (
    <nav className="page-nav" style={{ color }}>
      {backHref ? (
        <Link href={backHref} className="page-nav-link" style={{ color }}>← {backLabel}</Link>
      ) : (
        <button type="button" onClick={goBack} className="page-nav-link" style={{ color }}>← {backLabel}</button>
      )}
      <span aria-hidden="true" style={{ opacity: 0.45 }}>·</span>
      <Link href={home} className="page-nav-link" style={{ color }}>Inicio</Link>
      {/* El separador se consulta aparte: si esta pantalla no tiene ayuda
          escrita, <Ayuda> no pinta nada y quedaría un "·" suelto al final. */}
      {ayuda && hayAyuda && (
        <>
          <span aria-hidden="true" style={{ opacity: 0.45 }}>·</span>
          <span className={light ? 'ayuda-enlace-claro' : undefined}>
            <Ayuda variante="enlace" />
          </span>
        </>
      )}
    </nav>
  );
}
