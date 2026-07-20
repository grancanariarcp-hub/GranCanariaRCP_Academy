import type { Request } from 'express';
import { forbidden } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Restricciones del usuario auditor (comisión de formación continuada).
 *
 * Puede VER todo y no puede tocar ni llevarse nada. Se resuelve en un único
 * sitio en lugar de repartir excepciones por decenas de rutas: cualquier
 * endpoint nuevo queda cubierto por defecto, que es justo lo que se necesita
 * en un permiso de solo lectura.
 *
 * Se deniega por regla general y se permite lo concreto, no al revés.
 */

/** Rutas que devuelven ficheros: el auditor consulta en pantalla, no descarga. */
const DESCARGAS = [
  /\.pdf($|\?)/i,
  /\/export($|\?)/,
  /\/template($|\?)/,
  /\/legajo($|\?)/,
  /\/backup($|\?)/,
  // Enlaces firmados a documentos almacenados: equivalen a una descarga.
  /\/documents\/[^/]+\/url($|\?)/,
];

export function restringirAuditor(req: Request): void {
  if (req.auth?.role !== 'auditor') return;

  // Solo lectura: nada de crear, modificar ni borrar.
  if (!['GET', 'HEAD'].includes(req.method)) {
    throw forbidden(
      'Tu acceso es de solo consulta: puedes revisar la plataforma pero no modificar nada.',
      'AUDITOR_SOLO_LECTURA',
    );
  }

  if (DESCARGAS.some((re) => re.test(req.originalUrl))) {
    throw forbidden(
      'Tu acceso no permite descargar documentos. Puedes consultarlos en pantalla.',
      'AUDITOR_SIN_DESCARGAS',
    );
  }

  // Cada consulta queda registrada: es lo que da garantías a ambas partes.
  audit({
    actorId: req.auth.sub,
    actorType: 'auditor',
    action: 'AUDITOR_VIEW',
    entity: 'ruta',
    entityId: null,
    ip: clientIp(req),
    metadata: { ruta: req.originalUrl.slice(0, 300) },
  }).catch(() => { /* la auditoría nunca puede tumbar una consulta */ });
}
