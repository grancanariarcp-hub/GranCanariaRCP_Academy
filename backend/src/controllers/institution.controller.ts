import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { notFound } from '../utils/httpError.js';
import { notify } from '../services/notify.js';

/** Público: instituciones activas (para el desplegable "represento a…"). */
export async function listPublicInstitutions(_req: Request, res: Response): Promise<void> {
  const { rows } = await query('SELECT id, name FROM institutions WHERE status = $1 ORDER BY name', ['active']);
  res.json({ institutions: rows });
}

/** super_admin: aprobar / rechazar una institución registrada. */
export async function setInstitutionStatus(req: Request, res: Response): Promise<void> {
  const approve = req.params.action === 'approve';
  const status = approve ? 'active' : 'rejected';
  const { rows } = await query<{ id: string; name: string }>(
    `UPDATE institutions SET status = $1, is_active = $2, updated_at = NOW() WHERE id = $3 RETURNING id, name`,
    [status, approve, req.params.id],
  );
  if (rows.length === 0) throw notFound('Institución no encontrada');

  // Avisar a los administradores de esa institución.
  const admins = await query<{ id: string }>(
    "SELECT id FROM users WHERE institution_id = $1 AND role = 'institution_admin'",
    [req.params.id],
  );
  for (const a of admins.rows) {
    await notify(
      { id: a.id, type: 'user' },
      approve ? 'Institución validada' : 'Institución rechazada',
      approve ? `«${rows[0].name}» ya está activa. Puedes crear profesores y clases.` : `La solicitud de «${rows[0].name}» no ha sido aprobada.`,
      '/institucion',
    ).catch(() => { /* no bloquear */ });
  }
  res.json({ ok: true, status });
}
