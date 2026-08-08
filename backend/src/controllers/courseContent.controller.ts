import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { assertEditor, assertDirector, relacionConCurso } from '../services/courseAuth.js';
import { notify, notifyCourseStudents } from '../services/notify.js';
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
  // Clasificación temática del curso, en dos niveles (tema → subtema). Texto
  // libre: se crea escribiendo, con sugerencias de lo ya usado en la academia.
  tema: z.string().max(120).or(z.literal('')).nullish(),
  subtema: z.string().max(120).or(z.literal('')).nullish(),
  durationHours: z.number().positive().max(1000).optional(),
  certifica: z.string().max(200).optional(),
  firmante1Nombre: z.string().max(160).optional(),
  firmante1Cargo: z.string().max(160).optional(),
  firmante2Nombre: z.string().max(160).optional(),
  firmante2Cargo: z.string().max(160).optional(),
  whatsappUrl: z.string().url('Enlace no válido').or(z.literal('')).optional(),
  telegramUrl: z.string().url('Enlace no válido').or(z.literal('')).optional(),
  minPerPage: z.number().min(0.5).max(30).optional(),
  wordsPerMin: z.number().int().min(50).max(600).optional(),
  minPerQuestion: z.number().min(0.1).max(30).optional(),
  // Precio de matrícula: base (anticipado), plazo y recargo posterior.
  priceCents: z.number().int().min(0).max(10_000_00).optional(),
  earlyBirdUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).nullish(),
  lateSurchargePct: z.number().min(0).max(500).optional(),
  // Cursos por suscripción: se paga por periodos mientras se prepara.
  billingType: z.enum(['unico', 'suscripcion']).optional(),
  // El tipo (curso/OPE) NO se cambia aquí: se elige al crear y solo el super
  // admin puede cambiarlo, y solo antes de la primera matrícula (cambiarTipo).
  // Que la Comisión CFC pueda ver el curso antes de publicarse (en trámite).
  cfcEnTramite: z.boolean().optional(),
  // Datos de la parte práctica (PÚLSAR): tipo clínico, empresa y lugar.
  tipoClinico: z.enum(['SVA', 'SVB', 'SVI', 'otro']).or(z.literal('')).nullish(),
  empresa: z.string().max(160).or(z.literal('')).nullish(),
  lugar: z.string().max(160).or(z.literal('')).nullish(),
  priceMensualCents: z.number().int().min(0).max(10_000_00).nullish(),
  priceTrimestralCents: z.number().int().min(0).max(10_000_00).nullish(),
  priceSemestralCents: z.number().int().min(0).max(10_000_00).nullish(),
  priceAnualCents: z.number().int().min(0).max(10_000_00).nullish(),
});

/** Lo único que se puede tocar de un curso ajeno: retirarlo de circulación. */
const CAMPOS_DE_MODERACION = new Set(['status', 'enrollmentOpen']);

export async function updateCourse(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const d = updateCourseSchema.parse(req.body);

  // Sobre un curso que no es suyo, el super admin modera pero no edita: puede
  // ocultarlo o cerrarle la matrícula, no reescribir su contenido. Quien firma
  // un curso acreditado responde de lo que enseña, y no puede responder de algo
  // que otro cambió por debajo.
  if (req.auth!.role === 'super_admin') {
    const rel = await relacionConCurso(req.params.id, req.auth!.sub);
    const ajeno = rel.existe && !rel.esCreador && rel.rolStaff === null;
    if (ajeno) {
      const tocados = Object.keys(d).filter((k) => d[k as keyof typeof d] !== undefined);
      const prohibidos = tocados.filter((k) => !CAMPOS_DE_MODERACION.has(k));
      if (prohibidos.length > 0) {
        throw forbidden(
          'Este curso lo creó otra persona: puedes ocultarlo o cerrar su matrícula, pero no editar su contenido. '
          + `Campos no permitidos: ${prohibidos.join(', ')}.`,
        );
      }
      if (d.status && d.status === 'borrador') {
        throw forbidden('Sobre un curso ajeno solo puedes ocultarlo (archivado) o volver a publicarlo.');
      }
      await audit({
        actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_MODERATED',
        entity: 'course', entityId: req.params.id, ip: clientIp(req),
        metadata: { status: d.status, enrollmentOpen: d.enrollmentOpen },
      }).catch(() => { /* moderar no debe fallar por el registro */ });
    }
  }

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
    tema: d.tema, subtema: d.subtema,
    certifica: d.certifica, firmante1_nombre: d.firmante1Nombre, firmante1_cargo: d.firmante1Cargo,
    firmante2_nombre: d.firmante2Nombre, firmante2_cargo: d.firmante2Cargo,
    whatsapp_url: d.whatsappUrl, telegram_url: d.telegramUrl,
    min_per_page: d.minPerPage, words_per_min: d.wordsPerMin, min_per_question: d.minPerQuestion,
    price_cents: d.priceCents, early_bird_until: d.earlyBirdUntil, late_surcharge_pct: d.lateSurchargePct,
    billing_type: d.billingType, cfc_en_tramite: d.cfcEnTramite,
    tipo_clinico: d.tipoClinico, empresa: d.empresa, lugar: d.lugar,
    price_mensual_cents: d.priceMensualCents,
    price_trimestral_cents: d.priceTrimestralCents,
    price_semestral_cents: d.priceSemestralCents,
    price_anual_cents: d.priceAnualCents,
  };
  const cambios = Object.entries(map).filter(([, val]) => val !== undefined)
    .map(([col, val]) => ({ col, val: val === '' ? null : val }));
  if (cambios.length === 0) throw badRequest('Nada que actualizar');

  // Estado del curso antes del cambio: para saber si la solicitud de CFC ya
  // congeló los campos acreditables, y para registrar el valor anterior.
  const antesRow = await query<Record<string, unknown>>(
    `SELECT cfc_solicitado_at, ${cambios.map((c) => c.col).join(', ')} FROM courses WHERE id = $1`,
    [req.params.id],
  );
  if (antesRow.rows.length === 0) throw notFound('Curso no encontrado');
  const antes = antesRow.rows[0];
  const cfcCongelado = antes.cfc_solicitado_at !== null;

  // Campos acreditables: bloqueados desde que se registra la solicitud de CFC.
  const ACREDITABLES: Record<string, string> = {
    title: 'el título', duration_hours: 'las horas lectivas',
    starts_at: 'la fecha de inicio', ends_at: 'la fecha de fin',
  };
  if (cfcCongelado) {
    const bloqueados = cambios
      .filter((c) => ACREDITABLES[c.col] && String(antes[c.col] ?? '') !== String(c.val ?? ''))
      .map((c) => ACREDITABLES[c.col]);
    if (bloqueados.length > 0) {
      throw forbidden(
        `Este curso tiene una solicitud de CFC registrada, así que ${bloqueados.join(', ')} no se puede(n) cambiar. `
        + 'El resto de campos (materiales, avisos, descripciones, imagen…) sí, y cada cambio queda registrado.',
      );
    }
  }

  const fields = cambios.map((c, i) => `${c.col} = $${i + 1}`);
  const params: unknown[] = [...cambios.map((c) => c.val), req.params.id];
  const { rows } = await query(
    `UPDATE courses SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length} RETURNING id, status, enrollment_open`,
    params,
  );
  if (rows.length === 0) throw notFound('Curso no encontrado');

  // Con la solicitud de CFC ya registrada, cada cambio efectivo se anota en el
  // registro (qué campo, antes, después, quién): la prueba de que lo impartido
  // coincide con lo acreditado.
  if (cfcCongelado) {
    for (const c of cambios) {
      const ant = antes[c.col] ?? null;
      if (String(ant ?? '') === String(c.val ?? '')) continue;
      await query(
        `INSERT INTO course_field_changes (course_id, campo, valor_antes, valor_nuevo, changed_by)
         VALUES ($1,$2,$3,$4,$5)`,
        [req.params.id, c.col, ant === null ? null : String(ant), c.val === null ? null : String(c.val), req.auth!.sub],
      ).catch(() => { /* el registro no debe impedir el cambio ya aplicado */ });
    }
  }

  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_UPDATE', entity: 'course', entityId: req.params.id, ip: clientIp(req), metadata: d });
  res.json({ course: rows[0] });
}

/**
 * POST /api/courses/:id/solicitar-cfc — registrar la solicitud de acreditación.
 *
 * Es la acción que congela los campos acreditables (título, horas, temario,
 * profesorado, fechas). Un solo clic, deliberado: antes de él nada se bloquea.
 * Marca además el curso como «en trámite» para que la Comisión pueda verlo.
 */
export async function solicitarCfc(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const cur = await query<{ cfc_solicitado_at: string | null; es_ope: boolean }>(
    'SELECT cfc_solicitado_at, es_ope FROM courses WHERE id = $1', [req.params.id],
  );
  if (cur.rows.length === 0) throw notFound('Curso no encontrado');
  if (cur.rows[0].es_ope) throw badRequest('Una OPE no solicita CFC', 'ES_OPE');
  if (cur.rows[0].cfc_solicitado_at) { res.json({ ok: true, yaEstaba: true }); return; }

  await query(
    `UPDATE courses SET cfc_solicitado_at = NOW(), cfc_solicitado_by = $2, cfc_en_tramite = TRUE, updated_at = NOW()
      WHERE id = $1`,
    [req.params.id, req.auth!.sub],
  );
  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'CFC_SOLICITADO', entity: 'course', entityId: req.params.id, ip: clientIp(req) });
  res.json({ ok: true });
}

/** GET /api/courses/:id/cambios-cfc — registro de cambios tras la solicitud. */
export async function cambiosCfc(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { rows } = await query(
    `SELECT c.campo, c.valor_antes, c.valor_nuevo, c.changed_at, u.name AS quien
       FROM course_field_changes c LEFT JOIN users u ON u.id = c.changed_by
      WHERE c.course_id = $1 ORDER BY c.changed_at DESC LIMIT 500`,
    [req.params.id],
  );
  res.json({ cambios: rows });
}

/**
 * GET /api/courses/:id/auditoria — historial completo del curso para la comisión
 * CFC: el registro de cambios acreditables + los eventos del propio curso
 * (publicación, ficha, temario, profesorado, solicitud CFC). SIN datos de
 * alumnos: la comisión audita el curso, no a las personas (hay menores).
 * Lo ven super admin, el profesorado del curso y el auditor (via assertEditor).
 */
export async function auditoriaCurso(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const cambios = await query(
    `SELECT c.campo, c.valor_antes, c.valor_nuevo, c.changed_at, u.name AS quien
       FROM course_field_changes c LEFT JOIN users u ON u.id = c.changed_by
      WHERE c.course_id = $1 ORDER BY c.changed_at DESC LIMIT 500`,
    [req.params.id],
  );
  // Eventos del curso desde el registro de auditoría. Solo acciones sobre el
  // propio curso; nada de alumnos (matrículas, pagos, notas se excluyen).
  const eventos = await query(
    `SELECT a.action, a.actor_type, a.created_at, u.name AS quien
       FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
      WHERE a.entity = 'course' AND a.entity_id = $1
        AND a.action NOT LIKE '%STUDENT%' AND a.action NOT LIKE '%PAYMENT%' AND a.action NOT LIKE '%ENROLL%'
      ORDER BY a.created_at DESC LIMIT 500`,
    [req.params.id],
  );
  res.json({ cambios: cambios.rows, eventos: eventos.rows });
}

// ---------------------------------------------------------------------------
// Modules
// ---------------------------------------------------------------------------
/**
 * Impide tocar el temario o el profesorado cuando ya se registró la solicitud
 * de CFC: ambos son acreditables. Los materiales de apoyo (actividades) SÍ se
 * pueden seguir cambiando; solo se fija la estructura.
 */
async function assertAcreditableAbierto(courseId: string, que: string): Promise<void> {
  const r = await query<{ cfc_solicitado_at: string | null }>('SELECT cfc_solicitado_at FROM courses WHERE id = $1', [courseId]);
  if (r.rows[0]?.cfc_solicitado_at) {
    throw forbidden(`Con la solicitud de CFC registrada, ${que} queda fijado. Los materiales de apoyo sí puedes seguir cambiándolos.`);
  }
}

export async function addModule(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertAcreditableAbierto(req.params.id, 'el temario');
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
  await assertAcreditableAbierto(req.params.id, 'el temario');
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
  await assertAcreditableAbierto(req.params.id, 'el temario');
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
  // Duración en minutos (sobre todo para vídeos): cuenta para las horas CFC.
  durationMin: z.number().int().min(0).max(1000).optional(),
  // Evaluable: el profesor decide si esta actividad cuenta como calificación y
  // con qué método (finalización = apto al completarla, manual = pone la nota).
  evaluable: z.boolean().optional().default(false),
  metodoEval: z.enum(['examen', 'finalizacion', 'manual']).nullable().optional(),
});

/**
 * Avisa a los alumnos matriculados de que hay contenido nuevo en el curso.
 *
 * Solo en cursos PUBLICADOS: un borrador aún no tiene alumnos, así que montar el
 * curso no dispara avisos. Es un aviso in-app (campanita); si Resend está
 * configurado, además por correo. No bloquea nunca la respuesta al profesor.
 */
async function avisarContenidoNuevo(courseId: string, titulo: string, tipoLabel: string): Promise<void> {
  const c = await query<{ status: string; title: string }>('SELECT status, title FROM courses WHERE id = $1', [courseId]);
  if (c.rows[0]?.status !== 'publicado') return;
  // Una sola sentencia para todo el alumnado: sin bucle por alumno.
  await notifyCourseStudents(
    courseId,
    `Nuevo contenido en «${c.rows[0].title}»`,
    `${tipoLabel}: ${titulo}`,
    `/student/curso/${courseId}`,
  );
}

export async function addActivity(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = addActivitySchema.parse(req.body);

  // Make sure the module belongs to this course.
  const mod = await query('SELECT 1 FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  if (mod.rows.length === 0) throw notFound('Módulo no encontrado');

  if (d.type === 'documento' && !d.documentId) throw badRequest('Elige un documento', 'NO_DOCUMENT');
  if ((d.type === 'video' || d.type === 'enlace') && !d.url) throw badRequest('Falta la URL', 'NO_URL');
  if (d.type === 'texto' && (!d.body || d.body.trim().length === 0)) throw badRequest('Escribe el texto', 'NO_BODY');

  // No basta con no ver un documento en la lista: hay que impedir enlazar uno al
  // que no se tiene acceso aunque se conozca su id (mismo criterio que la
  // biblioteca: propio, público o restringido con permiso).
  if (d.type === 'documento' && d.documentId && req.auth!.role !== 'super_admin') {
    const acc = await query(
      `SELECT 1 FROM documents d WHERE d.id = $1 AND d.is_active = TRUE
         AND (d.uploaded_by = $2 OR d.visibility = 'publico'
              OR (d.visibility = 'restringido'
                  AND EXISTS (SELECT 1 FROM document_access da WHERE da.document_id = d.id AND da.user_id = $2)))`,
      [d.documentId, req.auth!.sub],
    );
    if (acc.rows.length === 0) throw forbidden('No tienes acceso a ese documento');
  }

  const { rows } = await query(
    `INSERT INTO activities (module_id, type, title, document_id, url, body, is_mandatory, duration_min, evaluable, metodo_eval, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, COALESCE((SELECT MAX(sort_order) + 1 FROM activities WHERE module_id = $1), 0))
     RETURNING id, type, title, document_id, url, body, is_mandatory, duration_min, evaluable, metodo_eval`,
    [req.params.moduleId, d.type, d.title, d.documentId ?? null, d.url ?? null, d.body ?? null, d.isMandatory, d.durationMin ?? null,
      d.evaluable ?? false, d.evaluable ? (d.metodoEval ?? 'finalizacion') : null],
  );
  avisarContenidoNuevo(req.params.id, d.title, 'Nueva actividad').catch(() => { /* el aviso no debe romper la creación */ });
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

/**
 * PATCH /api/courses/:id/activities/:activityId/eval — marca una actividad como
 * evaluable y con qué método. El profesor decide qué cuenta como calificación.
 */
export async function setActivityEval(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = z.object({
    evaluable: z.boolean(),
    metodoEval: z.enum(['examen', 'finalizacion', 'manual']).nullable().optional(),
  }).parse(req.body);
  const metodo = d.evaluable ? (d.metodoEval ?? 'finalizacion') : null;
  const { rows } = await query(
    `UPDATE activities SET evaluable = $1, metodo_eval = $2
      WHERE id = $3 AND module_id IN (SELECT id FROM modules WHERE course_id = $4)
      RETURNING id, evaluable, metodo_eval`,
    [d.evaluable, metodo, req.params.activityId, req.params.id],
  );
  if (rows.length === 0) throw notFound('Actividad no encontrada');
  res.json({ activity: rows[0] });
}

/**
 * GET /api/courses/:id/activities/:activityId/grades — alumnos del curso con su
 * nota manual (para el panel de calificación del profesor).
 */
export async function listActivityGrades(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { rows } = await query(
    `SELECT s.id AS student_id, COALESCE(s.display_name, s.email) AS nombre,
            g.nota, g.apto
       FROM enrollments e
       JOIN students s ON s.id = e.student_id
       LEFT JOIN activity_grades g ON g.student_id = s.id AND g.activity_id = $2
      WHERE e.course_id = $1 AND e.status IN ('activo','completado')
      ORDER BY nombre`,
    [req.params.id, req.params.activityId],
  );
  res.json({ alumnos: rows });
}

/**
 * PUT /api/courses/:id/activities/:activityId/grades/:studentId — pone/actualiza
 * la nota manual de un alumno en una actividad.
 */
export async function setActivityGrade(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = z.object({
    nota: z.number().min(0).max(100).nullable().optional(),
    apto: z.boolean().nullable().optional(),
  }).parse(req.body);
  // La actividad debe ser de este curso.
  const a = await query('SELECT 1 FROM activities WHERE id = $1 AND module_id IN (SELECT id FROM modules WHERE course_id = $2)', [req.params.activityId, req.params.id]);
  if (a.rows.length === 0) throw notFound('Actividad no encontrada');
  await query(
    `INSERT INTO activity_grades (activity_id, student_id, nota, apto, graded_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (activity_id, student_id) DO UPDATE SET nota = EXCLUDED.nota, apto = EXCLUDED.apto, graded_by = EXCLUDED.graded_by, graded_at = NOW()`,
    [req.params.activityId, req.params.studentId, d.nota ?? null, d.apto ?? null, req.auth!.sub],
  );
  res.json({ ok: true });
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
  avisarContenidoNuevo(req.params.id, title, 'Nueva actividad').catch(() => { /* idem */ });
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
  await assertAcreditableAbierto(req.params.id, 'el profesorado');
  const { email, role, parte } = z.object({
    email: z.string().email(),
    role: z.enum(['director', 'instructor']).default('instructor'),
    // En qué parte participa: teórica (academia), práctica (PÚLSAR) o ambas.
    parte: z.enum(['teorica', 'practica', 'ambas']).default('ambas'),
  }).parse(req.body);

  const u = await query<{ id: string; name: string; status: string }>(
    "SELECT id, name, status FROM users WHERE email = $1 AND role = 'profesor'",
    [email.toLowerCase()],
  );
  if (u.rows.length === 0) throw notFound('No hay un profesor con ese email (¿está registrado y aprobado?)');
  if (u.rows[0].status !== 'active') throw badRequest('Ese profesor aún no está activo/validado', 'NOT_ACTIVE');

  // Solo se invita a quien tiene el perfil docente completo: así ningún curso
  // acaba con un profesor a medias (es lo que ve el alumno y lo que exige la
  // comisión). El director no puede completar el perfil de otro; se le avisa
  // para que se lo pida al invitado.
  const perfilInv = await estadoPerfilDocente(u.rows[0].id);
  if (!perfilInv.completo) {
    throw badRequest(
      `${u.rows[0].name} todavía no tiene el perfil docente completo (le falta: ${perfilInv.faltan.join(', ')}). `
      + 'Pídele que lo complete desde su perfil y vuelve a añadirlo.',
      'PERFIL_INVITADO_INCOMPLETO',
    );
  }

  // El invitado nace 'pendiente' (default): no participa hasta que lo acepte.
  // Al reinvitar no se pisa un estado ya resuelto sin querer, salvo que estuviera
  // rechazado, en cuyo caso vuelve a quedar pendiente para que pueda reconsiderar.
  await query(
    `INSERT INTO course_staff (course_id, user_id, role, parte) VALUES ($1, $2, $3, $4)
     ON CONFLICT (course_id, user_id) DO UPDATE SET role = EXCLUDED.role, parte = EXCLUDED.parte,
       status = CASE WHEN course_staff.status = 'rechazado' THEN 'pendiente' ELSE course_staff.status END`,
    [req.params.id, u.rows[0].id, role, parte],
  );
  const ct = await query<{ title: string }>('SELECT title FROM courses WHERE id = $1', [req.params.id]);
  await notify({ id: u.rows[0].id, type: 'user' }, 'Invitación a un curso',
    `Te han invitado a participar como ${role} en «${ct.rows[0]?.title ?? 'un curso'}». Acéptala desde tu perfil.`,
    '/admin/perfil').catch(() => { /* no bloquear */ });
  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_STAFF_ADD', entity: 'course', entityId: req.params.id, ip: clientIp(req), metadata: { email: email.toLowerCase(), role } });
  res.status(201).json({ staff: { id: u.rows[0].id, name: u.rows[0].name, email: email.toLowerCase(), role, status: 'pendiente' } });
}

export async function removeStaff(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  await assertAcreditableAbierto(req.params.id, 'el profesorado');
  if (req.params.userId === req.auth!.sub) throw badRequest('No puedes quitarte a ti mismo', 'SELF_REMOVE');
  await query('DELETE FROM course_staff WHERE course_id = $1 AND user_id = $2', [req.params.id, req.params.userId]);
  res.json({ ok: true });
}

/**
 * DELETE /api/courses/:id — borrar un curso.
 *
 * Solo lo borra quien lo creó, y solo mientras no haya dejado rastro en la vida
 * de nadie. En cuanto hay una matrícula, un cobro, un certificado emitido o un
 * acta cerrada, el curso deja de ser un borrador propio para ser el respaldo
 * documental de la formación de otra persona: un certificado remite a su curso
 * y un acta es el registro que pide la comisión. Borrarlo dejaría huérfano un
 * documento que alguien puede tener que acreditar años después.
 *
 * Para esos casos está archivar, que lo retira de circulación sin destruir nada.
 */
/**
 * PATCH /api/courses/:id/tipo — cambiar entre Curso y OPE.
 *
 * El tipo se elige al crear y es, de hecho, irreversible: un Curso y una OPE no
 * comparten campos suficientes como para convertir uno en otro sin dejar un
 * registro a medias. La única marcha atrás es para el SUPER ADMIN y solo
 * mientras el curso siga siendo un borrador virgen —sin matrículas, cobros,
 * certificados ni actas—: ahí todavía no hay nada de nadie que proteger.
 *
 * Al cambiar se descarta el contenido que no aplica al nuevo tipo (los módulos
 * de un Curso, o los bancos asignados de una OPE): quien lo pide ya sabe que
 * empieza esa parte de cero.
 */
export async function cambiarTipoCurso(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'super_admin') {
    throw forbidden('Solo el super admin puede cambiar el tipo de un curso');
  }
  const { tipo } = z.object({ tipo: z.enum(['curso', 'ope']) }).parse(req.body);
  const esOpe = tipo === 'ope';

  const cur = await query<{ es_ope: boolean; status: string }>('SELECT es_ope, status FROM courses WHERE id = $1', [req.params.id]);
  if (cur.rows.length === 0) throw notFound('Curso no encontrado');
  if (cur.rows[0].es_ope === esOpe) { res.json({ ok: true, sinCambios: true }); return; }

  // Mismo listón que el borrado: en cuanto hay rastro de alguien, el tipo queda fijo.
  const { rows } = await query<{ matriculas: string; pagos: string; certificados: string; actas: string }>(
    `SELECT (SELECT COUNT(*) FROM enrollments        WHERE course_id = $1)::text AS matriculas,
            (SELECT COUNT(*) FROM payments           WHERE course_id = $1)::text AS pagos,
            (SELECT COUNT(*) FROM issued_certificates WHERE course_id = $1)::text AS certificados,
            (SELECT COUNT(*) FROM course_actas       WHERE course_id = $1)::text AS actas`,
    [req.params.id],
  );
  const r = rows[0];
  if (Number(r.matriculas) + Number(r.pagos) + Number(r.certificados) + Number(r.actas) > 0) {
    throw badRequest(
      'Este curso ya tiene actividad (matrículas, cobros, certificados o actas): su tipo no puede cambiarse. '
      + 'Si de verdad necesitas el otro tipo, créalo nuevo.',
      'CURSO_CON_HISTORIAL',
    );
  }

  await withTransaction(async (c) => {
    if (esOpe) {
      // Curso → OPE: se van los módulos (y con ellos sus actividades y exámenes).
      await c.query('DELETE FROM modules WHERE course_id = $1', [req.params.id]);
    } else {
      // OPE → Curso: se deshace su vínculo con los bancos; y vuelve a nacer con
      // un módulo de Bienvenida, como cualquier curso recién creado.
      await c.query('DELETE FROM ope_convocatorias WHERE course_id = $1', [req.params.id]);
      await c.query(
        `INSERT INTO modules (course_id, title, sort_order) VALUES ($1, 'Bienvenida', 0)`,
        [req.params.id],
      );
    }
    await c.query('UPDATE courses SET es_ope = $1, updated_at = NOW() WHERE id = $2', [esOpe, req.params.id]);
  });

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_TYPE_CHANGED',
    entity: 'course', entityId: req.params.id, ip: clientIp(req), metadata: { tipo },
  }).catch(() => { /* el cambio no debe fallar por el registro */ });
  res.json({ ok: true, esOpe });
}

export async function deleteCourse(req: Request, res: Response): Promise<void> {
  const rel = await relacionConCurso(req.params.id, req.auth!.sub);
  if (!rel.existe) throw notFound('Curso no encontrado');
  if (!rel.esCreador) {
    throw forbidden(
      'Solo quien creó el curso puede borrarlo. Si necesitas retirarlo de circulación, ocúltalo (archivar).',
    );
  }

  const { rows } = await query<{ matriculas: string; pagos: string; certificados: string; actas: string }>(
    `SELECT (SELECT COUNT(*) FROM enrollments        WHERE course_id = $1)::text AS matriculas,
            (SELECT COUNT(*) FROM payments           WHERE course_id = $1)::text AS pagos,
            (SELECT COUNT(*) FROM issued_certificates WHERE course_id = $1)::text AS certificados,
            (SELECT COUNT(*) FROM course_actas       WHERE course_id = $1)::text AS actas`,
    [req.params.id],
  );
  const r = rows[0];
  const impedimentos: string[] = [];
  if (Number(r.matriculas) > 0) impedimentos.push(`${r.matriculas} matrícula(s)`);
  if (Number(r.pagos) > 0) impedimentos.push(`${r.pagos} cobro(s)`);
  if (Number(r.certificados) > 0) impedimentos.push(`${r.certificados} certificado(s) emitido(s)`);
  if (Number(r.actas) > 0) impedimentos.push(`${r.actas} acta(s)`);

  if (impedimentos.length > 0) {
    throw badRequest(
      `Este curso ya tiene ${impedimentos.join(', ')}, así que no puede borrarse: hay documentos y registros `
      + 'que dependen de él. Ocúltalo (archivar) para retirarlo de circulación conservando el histórico.',
      'CURSO_CON_HISTORIAL',
    );
  }

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_DELETED',
    entity: 'course', entityId: req.params.id, ip: clientIp(req),
  }).catch(() => { /* el borrado no debe fallar por el registro */ });
  await query('DELETE FROM courses WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}
