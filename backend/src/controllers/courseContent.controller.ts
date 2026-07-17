import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { assertEditor, assertDirector } from '../services/courseAuth.js';
import { r2Configured, buildKey, uploadObject, presignedGetUrl } from '../services/r2.js';

/** Editing the inside of a course: modules, activities and staff. */

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
  resumen: z.string().optional(),
  acreditacion: z.string().max(200).optional(),
  cfc: z.string().max(120).optional(),
  durationHours: z.number().positive().max(1000).optional(),
});

export async function updateCourse(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const d = updateCourseSchema.parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title, status: d.status, enrollment_open: d.enrollmentOpen,
    starts_at: d.startsAt, ends_at: d.endsAt, final_exam_start: d.finalExamStart, final_exam_end: d.finalExamEnd,
    resumen: d.resumen, acreditacion: d.acreditacion, cfc: d.cfc, duration_hours: d.durationHours,
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
  type: z.enum(['documento', 'video', 'enlace', 'texto']),
  title: z.string().min(2).max(200),
  documentId: z.string().uuid().optional(),
  url: z.string().url('URL no válida').optional(),
  body: z.string().optional(),
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
  if (d.type === 'texto' && (!d.body || d.body.trim().length === 0)) throw badRequest('Escribe el texto', 'NO_BODY');

  const { rows } = await query(
    `INSERT INTO activities (module_id, type, title, document_id, url, body, is_mandatory, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE((SELECT MAX(sort_order) + 1 FROM activities WHERE module_id = $1), 0))
     RETURNING id, type, title, document_id, url, body, is_mandatory`,
    [req.params.moduleId, d.type, d.title, d.documentId ?? null, d.url ?? null, d.body ?? null, d.isMandatory],
  );
  res.status(201).json({ activity: rows[0] });
}

/** Upload the course thumbnail (multipart image) to R2. */
export async function uploadCourseThumbnail(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');

  const key = buildKey(file.originalname, 'thumbs');
  await uploadObject(key, file.buffer, file.mimetype);
  await query('UPDATE courses SET thumbnail_key = $1, updated_at = NOW() WHERE id = $2', [key, req.params.id]);
  res.json({ thumbnail_url: await presignedGetUrl(key, 3600) });
}

/** Add an image activity (multipart: file + title). Stores the image in R2. */
export async function addImageActivity(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file) throw badRequest('Falta la imagen', 'NO_FILE');
  if (!file.mimetype.startsWith('image/')) throw badRequest('El archivo debe ser una imagen', 'NOT_IMAGE');

  const mod = await query('SELECT 1 FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  if (mod.rows.length === 0) throw notFound('Módulo no encontrado');

  const title = String(req.body.title ?? file.originalname).slice(0, 200);
  const key = buildKey(file.originalname, 'images');
  await uploadObject(key, file.buffer, file.mimetype);

  const { rows } = await query(
    `INSERT INTO activities (module_id, type, title, image_key, is_mandatory, sort_order)
     VALUES ($1, 'imagen', $2, $3, FALSE, COALESCE((SELECT MAX(sort_order) + 1 FROM activities WHERE module_id = $1), 0))
     RETURNING id, type, title, image_key`,
    [req.params.moduleId, title, key],
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
