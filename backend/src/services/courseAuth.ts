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

export async function assertDirector(req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  if (req.auth!.role === 'auditor') return;
  const role = await roleInCourse(req.params.id, req.auth!.sub);
  if (role !== 'director') throw forbidden('Solo un director del curso puede hacer esto');
}
