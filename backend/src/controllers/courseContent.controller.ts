import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Editing the inside of a course: modules, activities and staff.
 * - "editor"  = super_admin or any staff member (director/instructor)
 * - "director" = super_admin or a director of the course
 */
async function roleInCourse(courseId: string, userId: string): Promise<string | null> {
  const { rows } = await query<{ role: string }>(
    'SELECT role FROM course_staff WHERE course_id = $1 AND user_id = $2',
    [courseId, userId],
  );
  return rows[0]?.role ?? null;
}

async function assertEditor(req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  const role = await roleInCourse(req.params.id, req.auth!.sub);
  if (!role) throw forbidden('No formas parte de este curso');
}
async function assertDirector(req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  const role = await roleInCourse(req.params.id, req.auth!.sub);
  if (role !== 'director') throw forbidden('Solo un director del curso puede hacer esto');
}

// ---------------------------------------------------------------------------
// Course update (publish, open enrollment, dates, basics) — director only
// ---------------------------------------------------------------------------
const updateCourseSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  status: z.enum(['borrador', 'publicado', 'archivado']).optional(),
  enrollmentOpen: z.boolean().optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  finalExamStart: z.string().optional(),
  finalExamEnd: z.string().optional(),
});

export async function updateCourse(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const d = updateCourseSchema.parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title, status: d.status, enrollment_open: d.enrollmentOpen,
    starts_at: d.startsAt, ends_at: d.endsAt, final_exam_start: d.finalExamStart, final_exam_end: d.finalExamEnd,
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val === '' ? null : val); fields.push(`${col} = $${params.length}`); }
  }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE courses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, status, enrollment_open`,
    params,
  );
  if (rows.length === 0) throw notFound('Curso no encontrado');
  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_UPDATE', entity: 'course', entityId: req.params.id, ip: clientIp(req), metadata: d });
  res.json({ course: rows[0] });
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
export async function addModule(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { title } = z.object({ title: z.string().min(2).max(200) }).parse(req.body);
  const { rows } = await query(
    `INSERT INTO modules (course_id, title, sort_order)
     VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM modules WHERE course_id = $1), 0))
     RETURNING id, title, sort_order, is_mandatory`,
    [req.params.id, title],
  );
  res.status(201).json({ module: rows[0] });
}

export async function updateModule(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = z.object({ title: z.string().min(2).max(200).optional(), isMandatory: z.boolean().optional() }).parse(req.body);
  const fields: string[] = [];
  const params: unknown[] = [];
  if (d.title !== undefined) { params.push(d.title); fields.push(`title = $${params.length}`); }
  if (d.isMandatory !== undefined) { params.push(d.isMandatory); fields.push(`is_mandatory = $${params.length}`); }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.moduleId, req.params.id);
  const { rows } = await query(
    `UPDATE modules SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND course_id = $${params.length} RETURNING id, title, is_mandatory`,
    params,
  );
  res.json({ module: rows[0] ?? null });
}

export async function deleteModule(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await query('DELETE FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------
const addActivitySchema = z.object({
  type: z.enum(['documento', 'video', 'enlace']),
  title: z.string().min(2).max(200),
  documentId: z.string().uuid().optional(),
  url: z.string().url('URL no válida').optional(),
  isMandatory: z.boolean().optional().default(false),
});

export async function addActivity(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = addActivitySchema.parse(req.body);

  // Make sure the module belongs to this course.
  const mod = await query('SELECT 1 FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  if (mod.rows.length === 0) throw notFound('Módulo no encontrado');

  if (d.type === 'documento' && !d.documentId) throw badRequest('Elige un documento', 'NO_DOCUMENT');
  if ((d.type === 'video' || d.type === 'enlace') && !d.url) throw badRequest('Falta la URL', 'NO_URL');

  const { rows } = await query(
    `INSERT INTO activities (module_id, type, title, document_id, url, is_mandatory, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, COALESCE((SELECT MAX(sort_order) + 1 FROM activities WHERE module_id = $1), 0))
     RETURNING id, type, title, document_id, url, is_mandatory`,
    [req.params.moduleId, d.type, d.title, d.documentId ?? null, d.url ?? null, d.isMandatory],
  );
  res.status(201).json({ activity: rows[0] });
}

export async function deleteActivity(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  // Ensure the activity is within a module of this course before deleting.
  await query(
    `DELETE FROM activities WHERE id = $1
     AND module_id IN (SELECT id FROM modules WHERE course_id = $2)`,
    [req.params.activityId, req.params.id],
  );
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// Staff (invite / remove) — director only
// ---------------------------------------------------------------------------
export async function inviteStaff(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const { email, role } = z.object({
    email: z.string().email(),
    role: z.enum(['director', 'instructor']).default('instructor'),
  }).parse(req.body);

  const u = await query<{ id: string; name: string; status: string }>(
    "SELECT id, name, status FROM users WHERE email = $1 AND role = 'profesor'",
    [email.toLowerCase()],
  );
  if (u.rows.length === 0) throw notFound('No hay un profesor con ese email (¿está registrado y aprobado?)');
  if (u.rows[0].status !== 'active') throw badRequest('Ese profesor aún no está activo/validado', 'NOT_ACTIVE');

  await query(
    `INSERT INTO course_staff (course_id, user_id, role) VALUES ($1, $2, $3)
     ON CONFLICT (course_id, user_id) DO UPDATE SET role = EXCLUDED.role`,
    [req.params.id, u.rows[0].id, role],
  );
  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_STAFF_ADD', entity: 'course', entityId: req.params.id, ip: clientIp(req), metadata: { email: email.toLowerCase(), role } });
  res.status(201).json({ staff: { id: u.rows[0].id, name: u.rows[0].name, email: email.toLowerCase(), role } });
}

export async function removeStaff(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  if (req.params.userId === req.auth!.sub) throw badRequest('No puedes quitarte a ti mismo', 'SELF_REMOVE');
  await query('DELETE FROM course_staff WHERE course_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.json({ ok: true });
}
