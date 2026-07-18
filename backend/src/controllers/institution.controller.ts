import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, conflict, forbidden, notFound } from '../utils/httpError.js';
import { hashPassword } from '../utils/crypto.js';
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

// ---------------------------------------------------------------------------
// institution_admin: su institución + sus maestros
// ---------------------------------------------------------------------------
async function myInstitutionId(req: Request): Promise<string> {
  const id = req.auth!.institutionId;
  if (!id) throw forbidden('No perteneces a ninguna institución');
  return id;
}

export async function getMyInstitution(req: Request, res: Response): Promise<void> {
  const id = await myInstitutionId(req);
  const inst = await query<{ id: string; name: string; code: string; status: string }>(
    'SELECT id, name, code, status, contact_email, contact_name, contact_phone, address FROM institutions WHERE id = $1',
    [id],
  );
  if (inst.rows.length === 0) throw notFound('Institución no encontrada');
  const teachers = await query(
    "SELECT id, name, email, is_active FROM users WHERE institution_id = $1 AND role = 'institution_teacher' ORDER BY name",
    [id],
  );
  res.json({ institution: inst.rows[0], teachers: teachers.rows });
}

const teacherSchema = z.object({
  name: z.string().min(2).max(160),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

/** Alta de un MAESTRO (institution_teacher). Requiere institución activa. */
export async function createTeacher(req: Request, res: Response): Promise<void> {
  const id = await myInstitutionId(req);
  const inst = await query<{ status: string }>('SELECT status FROM institutions WHERE id = $1', [id]);
  if (inst.rows[0]?.status !== 'active') throw badRequest('Tu institución aún no está validada', 'INSTITUTION_NOT_ACTIVE');

  const d = teacherSchema.parse(req.body);
  const email = d.email.toLowerCase();
  const taken = await query('SELECT 1 FROM users WHERE email = $1 UNION SELECT 1 FROM students WHERE email = $1', [email]);
  if (taken.rows.length > 0) throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');

  const passwordHash = await hashPassword(d.password);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role, institution_id, status)
     VALUES ($1,$2,$3,'institution_teacher',$4,'active') RETURNING id`,
    [email, passwordHash, d.name, id],
  );
  await notify({ id: rows[0].id, type: 'user' }, 'Te han dado de alta como maestro',
    'Ya puedes crear clases y generar códigos para tus alumnos.', '/maestro').catch(() => {});
  res.status(201).json({ teacher: { id: rows[0].id, name: d.name, email, is_active: true } });
}

export async function deleteTeacher(req: Request, res: Response): Promise<void> {
  const id = await myInstitutionId(req);
  const r = await query(
    "DELETE FROM users WHERE id = $1 AND institution_id = $2 AND role = 'institution_teacher' RETURNING id",
    [req.params.id, id],
  );
  if (r.rows.length === 0) throw notFound('Maestro no encontrado');
  res.json({ ok: true });
}
