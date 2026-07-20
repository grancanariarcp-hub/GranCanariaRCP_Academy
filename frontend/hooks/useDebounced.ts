'use client';

import { useEffect, useState } from 'react';

/**
 * Retrasa un valor hasta que deja de cambiar.
 *
 * Los filtros de bancos y de preguntas se resuelven en el servidor y su efecto
 * depende del objeto de filtros entero. Como ese objeto se recrea en cada
 * pulsación, escribir «adrenalina» lanzaba diez peticiones —cada una con sus
 * facetas y su LIMIT 500— y la respuesta de una lenta podía llegar después de
 * otra posterior y pisarla. Esperando a que la mano se detenga, esa búsqueda
 * son una petición y un resultado.
 */
export function useDebounced<T>(valor: T, ms = 350): T {
  const [retrasado, setRetrasado] = useState(valor);

  useEffect(() => {
    const t = setTimeout(() => setRetrasado(valor), ms);
    return () => clearTimeout(t);
  }, [valor, ms]);

  return retrasado;
}
