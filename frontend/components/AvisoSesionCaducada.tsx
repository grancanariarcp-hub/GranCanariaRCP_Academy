'use client';

import { useEffect, useState } from 'react';

/**
 * Explica por qué se ha vuelto a la pantalla de acceso.
 *
 * Cuando la sesión deja de valer —caduca, o se cierra sola porque se ha abierto
 * en un tercer dispositivo— la plataforma devuelve al usuario aquí. Sin este
 * aviso, la pantalla de acceso aparecía de la nada en mitad de lo que estuviera
 * haciendo y parecía un fallo.
 *
 * Se lee de window.location en lugar de useSearchParams a propósito: ese hook
 * obliga a envolver la página en un Suspense y le quita el renderizado estático
 * a una pantalla que conviene que cargue instantánea.
 */
export function AvisoSesionCaducada() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(new URLSearchParams(window.location.search).get('caducada') === '1');
  }, []);

  if (!visible) return null;

  return (
    <div className="alert alert-error" style={{ marginBottom: 14, fontSize: 13.5 }}>
      Tu sesión ha caducado o se ha cerrado porque entraste desde otro dispositivo. Vuelve a acceder
      para continuar; no has perdido nada de lo que llevabas hecho.
    </div>
  );
}
