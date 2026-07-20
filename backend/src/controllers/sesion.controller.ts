import type { Request, Response } from 'express';
import { misSesiones, cerrarSesion, señalesDeReparto } from '../services/sesiones.js';
import { notFound } from '../utils/httpError.js';

/** GET /api/profile/sessions — mis dispositivos conectados. */
export async function listarSesiones(req: Request, res: Response): Promise<void> {
  const sesiones = await misSesiones(req.auth!.sub);
  res.json({
    sesiones: sesiones.map((s) => ({ ...s, actual: s.id === req.auth!.sid })),
    // Se dice el límite: quien lo conoce no se sorprende cuando le cierran una.
    maximo: 2,
  });
}

/** DELETE /api/profile/sessions/:id — cerrar una sesión propia. */
export async function revocarSesion(req: Request, res: Response): Promise<void> {
  const ok = await cerrarSesion(req.params.id, req.auth!.sub);
  if (!ok) throw notFound('Esa sesión no existe o ya estaba cerrada');
  res.json({ ok: true });
}

/**
 * GET /api/admin/uso-compartido — cuentas con indicios de reparto.
 *
 * Solo informa: no bloquea nada. Una heurística que expulse en automático
 * acabaría echando a quien estudia desde el hospital, su casa y la biblioteca,
 * que es exactamente el cliente que se quiere conservar.
 */
export async function usoCompartido(req: Request, res: Response): Promise<void> {
  const dias = Math.min(90, Math.max(1, Number(req.query.dias) || 7));
  res.json({ dias, cuentas: await señalesDeReparto(dias) });
}
