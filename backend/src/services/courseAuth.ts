import type { Request } from 'express';
import { query } from '../config/database.js';
import { forbidden } from '../utils/httpError.js';

/**
 * Shared course-permission helpers.
 * Routes are mounted under /api/courses/:id, so req.params.id is the course id.
 * - editor  = super_admin or any staff member (director/instructor)
 * - director = super_admin or a director of the course
 */
export async function roleInCourse(courseId: string, userId: string): Promise<string | null> {
  const { rows } = await query<{ role: string }>(
    'SELECT role FROM course_staff WHERE course_id = $1 AND user_id = $2',
    [courseId, userId],
  );
  return rows[0]?.role ?? null;
}

export async function assertEditor(req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  // El auditor consulta cualquier curso; escribir ya se lo impide requireAuth.
  if (req.auth!.role === 'auditor') return;
  const role = await roleInCourse(req.params.id, req.auth!.sub);
  if (!role) throw forbidden('No formas parte de este curso');
}

/**
 * ¿El usuario puede editar ESTE módulo? Un instructor con alcance por módulos
 * solo puede tocar los suyos; sin alcance (o director/super) puede con todos.
 */
export async function moduloEnAlcance(courseId: string, userId: string, moduleId: string): Promise<boolean> {
  const alguno = await query('SELECT 1 FROM staff_module_scope WHERE course_id = $1 AND user_id = $2 LIMIT 1', [courseId, userId]);
  if (alguno.rows.length === 0) return true; // sin restricción = todo el curso
  const m = await query('SELECT 1 FROM staff_module_scope WHERE course_id = $1 AND user_id = $2 AND module_id = $3', [courseId, userId, moduleId]);
  return m.rows.length > 0;
}

/** Exige que pueda editar el módulo indicado (actividades dentro de él). */
export async function assertEditaModulo(req: Request, moduleId: string): Promise<void> {
  await assertEditor(req);
  if (req.auth!.role === 'super_admin' || req.auth!.role === 'auditor') return;
  if (await roleInCourse(req.params.id, req.auth!.sub) === 'director') return;
  if (!(await moduloEnAlcance(req.params.id, req.auth!.sub, moduleId))) {
    throw forbidden('Estás asignado solo a ciertos módulos de este curso; este no es uno de ellos.');
  }
}

/** Exige poder crear módulos (director, super o instructor de todo el curso). */
export async function assertCreaModulo(req: Request): Promise<void> {
  await assertEditor(req);
  if (req.auth!.role === 'super_admin') return;
  if (await roleInCourse(req.params.id, req.auth!.sub) === 'director') return;
  const scope = await query('SELECT 1 FROM staff_module_scope WHERE course_id = $1 AND user_id = $2 LIMIT 1', [req.params.id, req.auth!.sub]);
  if (scope.rows.length > 0) throw forbidden('Estás asignado solo a ciertos módulos; no puedes crear módulos nuevos.');
}

/** Resuelve el módulo de una actividad y exige poder editarlo. */
export async function assertEditaActividad(req: Request, activityId: string): Promise<void> {
  const { rows } = await query<{ module_id: string }>(
    'SELECT module_id FROM activities WHERE id = $1', [activityId],
  );
  if (rows.length === 0) { await assertEditor(req); return; } // no existe: deja que el handler dé 404
  await assertEditaModulo(req, rows[0].module_id);
}

/**
 * Qué es esta persona respecto a este curso.
 *
 * Ser super admin no es lo mismo que ser el autor. Sobre un curso ajeno el
 * super admin puede intervenir —ocultarlo, cerrar su matrícula— porque responde
 * de la plataforma, pero no reescribirlo: el contenido docente y la
 * responsabilidad de lo que en él se enseña son de quien lo firma.
 */
export async function relacionConCurso(
  courseId: string,
  userId: string,
): Promise<{ esCreador: boolean; rolStaff: string | null; existe: boolean }> {
  const { rows } = await query<{ created_by: string | null }>(
    'SELECT created_by FROM courses WHERE id = $1',
    [courseId],
  );
  if (rows.length === 0) return { esCreador: false, rolStaff: null, existe: false };
  return {
    esCreador: rows[0].created_by === userId,
    rolStaff: await roleInCourse(courseId, userId),
    existe: true,
  };
}

export async function assertDirector(req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  if (req.auth!.role === 'auditor') return;
  const role = await roleInCourse(req.params.id, req.auth!.sub);
  if (role !== 'director') throw forbidden('Solo un director del curso puede hacer esto');
}
