import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { assertEditor, assertDirector } from '../services/courseAuth.js';
import { notify } from '../services/notify.js';
import { r2Configured, buildKey, uploadObject, presignedGetUrl, deleteObject } from '../services/r2.js';
import { estadoPerfilDocente } from '../services/perfilDocente.js';

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
  certifica: z.string().max(200).optional(),
  firmante1Nombre: z.string().max(160).optional(),
  firmante1Cargo: z.string().max(160).optional(),
  firmante2Nombre: z.string().max(160).optional(),
  firmante2Cargo: z.string().max(160).optional(),
  whatsappUrl: z.string().url('Enlace no válido').or(z.literal('')).optional(),
  minPerPage: z.number().min(0.5).max(30).optional(),
  wordsPerMin: z.number().int().min(50).max(600).optional(),
  minPerQuestion: z.number().min(0.1).max(30).optional(),
  // Precio de matrícula: base (anticipado), plazo y recargo posterior.
  priceCents: z.number().int().min(0).max(10_000_00).optional(),
  earlyBirdUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullish(),
  lateSurchargePct: z.number().min(0).max(500).optional(),
  // Cursos por suscripción: se paga por periodos mientras se prepara.
  billingType: z.enum(['unico', 'suscripcion']).optional(),
  esOpe: z.boolean().optional(),
  priceMensualCents: z.number().int().min(0).max(10_000_00).nullish(),
  priceTrimestralCents: z.number().int().min(0).max(10_000_00).nullish(),
  priceSemestralCents: z.number().int().min(0).max(10_000_00).nullish(),
  priceAnualCents: z.number().int().min(0).max(10_000_00).nullish(),
});

export async function updateCourse(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const d = updateCourseSchema.parse(req.body);

  // Publicar exige tener el currículum al día: es lo que el alumno lee para
  // decidir, y lo prometemos en la página pública. No se pide al registrarse
  // —espantaría a quien aún no ha decidido nada— sino justo aquí.
  if (d.status === 'publicado' && req.auth!.role === 'profesor') {
    const perfil = await estadoPerfilDocente(req.auth!.sub);
    if (!perfil.completo) {
      throw badRequest(
        `Completa tu perfil docente antes de publicar: falta ${perfil.faltan.join(', ')}. `
        + 'Es lo que verán tus alumnos para saber quién imparte el curso.',
        'PERFIL_INCOMPLETO',
      );
    }
  }
  const map: Record<string, unknown> = {
    title: d.title, status: d.status, enrollment_open: d.enrollmentOpen,
    starts_at: d.startsAt, ends_at: d.endsAt, final_exam_start: d.finalExamStart, final_exam_end: d.finalExamEnd,
    resumen: d.resumen, acreditacion: d.acreditacion, cfc: d.cfc, duration_hours: d.durationHours,
    certifica: d.certifica, firmante1_nombre: d.firmante1Nombre, firmante1_cargo: d.firmante1Cargo,
    firmante2_nombre: d.firmante2Nombre, firmante2_cargo: d.firmante2Cargo,
    whatsapp_url: d.whatsappUrl,
    min_per_page: d.minPerPage, words_per_min: d.wordsPerMin, min_per_question: d.minPerQuestion,
    price_cents: d.priceCents, early_bird_until: d.earlyBirdUntil, late_surcharge_pct: d.lateSurchargePct,
    billing_type: d.billingType, es_ope: d.esOpe,
    price_mensual_cents: d.priceMensualCents,
    price_trimestral_cents: d.priceTrimestralCents,
    price_semestral_cents: d.priceSemestralCents,
    price_anual_cents: d.priceAnualCents,
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

/** Duración manual de una actividad (minutos). Útil sobre todo para vídeos. */
export async function setActivityDuration(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { minutes } = z.object({ minutes: z.number().int().min(0).max(1000).nullable() }).parse(req.body);
  const { rows } = await query(
    `UPDATE activities SET duration_min = $1
      WHERE id = $2 AND module_id IN (SELECT id FROM modules WHERE course_id = $3)
      RETURNING id, duration_min`,
    [minutes, req.params.activityId, req.params.id],
  );
  if (rows.length === 0) throw notFound('Actividad no encontrada');
  res.json({ activity: rows[0] });
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

// ---------------------------------------------------------------------------
// Galería del curso (carrusel de la ficha) — imágenes en R2
// ---------------------------------------------------------------------------
export async function addCourseImage(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');

  const key = buildKey(file.originalname, 'gallery');
  await uploadObject(key, file.buffer, file.mimetype);
  const { rows } = await query(
    `INSERT INTO course_images (course_id, image_key, sort_order)
     VALUES ($1, $2, COALESCE((SELECT MAX(sort_order) + 1 FROM course_images WHERE course_id = $1), 0))
     RETURNING id, image_key`,
    [req.params.id, key],
  );
  res.status(201).json({ image: { id: rows[0].id, url: await presignedGetUrl(key, 3600) } });
}

export async function deleteCourseImage(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { rows } = await query<{ image_key: string }>(
    'DELETE FROM course_images WHERE id = $1 AND course_id = $2 RETURNING image_key',
    [req.params.imageId, req.params.id],
  );
  if (rows.length === 0) throw notFound('Imagen no encontrada');
  await deleteObject(rows[0].image_key).catch(() => { /* si R2 falla, la fila ya se borró */ });
  res.json({ ok: true });
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
  const ct = await query<{ title: string }>('SELECT title FROM courses WHERE id = $1', [req.params.id]);
  await notify({ id: u.rows[0].id, type: 'user' }, 'Te han añadido a un curso',
    `Ahora eres ${role} de «${ct.rows[0]?.title ?? 'un curso'}»`, `/admin/cursos/${req.params.id}`).catch(() => { /* no bloquear */ });
  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_STAFF_ADD', entity: 'course', entityId: req.params.id, ip: clientIp(req), metadata: { email: email.toLowerCase(), role } });
  res.status(201).json({ staff: { id: u.rows[0].id, name: u.rows[0].name, email: email.toLowerCase(), role } });
}

export async function removeStaff(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  if (req.params.userId === req.auth!.sub) throw badRequest('No puedes quitarte a ti mismo', 'SELF_REMOVE');
  await query('DELETE FROM course_staff WHERE course_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.json({ ok: true });
}
