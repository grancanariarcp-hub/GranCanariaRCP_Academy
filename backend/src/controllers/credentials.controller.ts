import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { hashPassword, generateTempPassword } from '../utils/crypto.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { notify } from '../services/notify.js';

/**
 * Reseteo de credenciales con clave de UN SOLO USO: se genera una contraseña
 * temporal, se marca must_change_password y se devuelve UNA VEZ para que quien
 * la resetea se la comunique. Al entrar, el usuario define la suya definitiva.
 * Los menores quedan fuera: ellos entran con el código de su maestro.
 */
async function resetFor(table: 'users' | 'students', id: string, req: Request): Promise<{ name: string; email: string | null; tempPassword: string }> {
  const nameCol = table === 'students' ? 'display_name' : 'name';
  const row = await query<{ name: string; email: string | null; is_minor?: boolean }>(
    `SELECT ${nameCol} AS name, email${table === 'students' ? ', is_minor' : ''} FROM ${table} WHERE id = $1`,
    [id],
  );
  if (row.rows.length === 0) throw notFound('Cuenta no encontrada');
  if (table === 'students' && row.rows[0].is_minor) {
    throw badRequest('Los menores entran con el código de su maestro, no con contraseña', 'IS_MINOR');
  }

  const tempPassword = generateTempPassword();
  await query(`UPDATE ${table} SET password_hash = $1, must_change_password = TRUE WHERE id = $2`,
    [await hashPassword(tempPassword), id]);

  await notify({ id, type: table === 'students' ? 'student' : 'user' },
    'Tu contraseña ha sido restablecida',
    'Entra con la clave temporal que te han facilitado y define tu nueva contraseña.', '/perfil').catch(() => {});

  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'PASSWORD_RESET', entity: table, entityId: id, ip: clientIp(req) });
  return { name: row.rows[0].name, email: row.rows[0].email, tempPassword };
}

/** super_admin: resetea la contraseña de cualquier cuenta de staff o alumno. */
export async function adminResetPassword(req: Request, res: Response): Promise<void> {
  const { type, id } = req.params as { type: string; id: string };
  if (type !== 'user' && type !== 'student') throw badRequest('Tipo no válido', 'BAD_TYPE');
  res.json(await resetFor(type === 'student' ? 'students' : 'users', id, req));
}

/** Director de curso: resetea la contraseña de un alumno matriculado en SU curso. */
export async function directorResetStudentPassword(req: Request, res: Response): Promise<void> {
  const { id: courseId, studentId } = req.params;

  if (req.auth!.role !== 'super_admin') {
    const staff = await query(
      "SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2 AND role = 'director'",
      [courseId, req.auth!.sub],
    );
    if (staff.rows.length === 0) throw forbidden('Solo el director del curso puede restablecer credenciales');
  }

  const enrolled = await query('SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2', [courseId, studentId]);
  if (enrolled.rows.length === 0) throw notFound('Ese alumno no está matriculado en este curso');

  res.json(await resetFor('students', studentId, req));
}
