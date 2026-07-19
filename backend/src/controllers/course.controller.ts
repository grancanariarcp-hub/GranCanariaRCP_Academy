import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { forbidden, notFound } from '../utils/httpError.js';
import { withImageUrls, presignKeys } from '../services/r2.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { precioDe } from '../services/pricing.js';

/**
 * Courses. super_admin sees/manages all; a profesor sees/manages the courses
 * where they are staff (director or instructor). The creator becomes director.
 */

const createSchema = z.object({
  title: z.string().min(3).max(200),
  tema: z.string().max(120).optional(),
  subtema: z.string().max(120).optional(),
  durationHours: z.number().positive().max(1000).optional(),
  modality: z.enum(['online', 'mixto', 'presencial']).default('online'),
  objetivoGeneral: z.string().optional(),
  objetivosEspecificos: z.string().optional(),
  publicoObjetivo: z.array(z.string()).optional().default([]),
  priceCents: z.number().int().min(0).optional().default(0),
  resumen: z.string().optional(),
  acreditacion: z.string().max(200).optional(),
  cfc: z.string().max(120).optional(),
});

export async function createCourse(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  const userId = req.auth!.sub;

  const course = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO courses
         (title, tema, subtema, duration_hours, modality, objetivo_general,
          objetivos_especificos, publico_objetivo, price_cents, resumen, acreditacion, cfc, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, title, tema, subtema, status, created_at`,
      [
        data.title, data.tema ?? null, data.subtema ?? null, data.durationHours ?? null,
        data.modality, data.objetivoGeneral ?? null, data.objetivosEspecificos ?? null,
        data.publicoObjetivo, data.priceCents, data.resumen ?? null, data.acreditacion ?? null, data.cfc ?? null, userId,
      ],
    );
    const created = rows[0];

    // Creator becomes director of the course.
    await client.query(
      `INSERT INTO course_staff (course_id, user_id, role) VALUES ($1, $2, 'director')`,
      [created.id, userId],
    );

    // Auto-generate a welcome + first module.
    await client.query(
      `INSERT INTO modules (course_id, title, sort_order) VALUES ($1, 'Bienvenida', 0), ($1, 'Módulo 1', 1)`,
      [created.id],
    );

    // Y su encuesta de satisfacción, lista desde el primer momento.
    await client.query('INSERT INTO course_surveys (course_id) VALUES ($1) ON CONFLICT (course_id) DO NOTHING', [created.id]);

    return created;
  });

  await audit({
    actorId: userId, actorType: req.auth!.role, action: 'COURSE_CREATE',
    entity: 'course', entityId: course.id, ip: clientIp(req), metadata: { title: data.title },
  });

  res.status(201).json({ course });
}

/**
 * Public: todos los cursos publicados (para la portada / descubrimiento).
 * Se muestran también los que tienen la matrícula cerrada, como "próximamente"
 * (genera interés); la tarjeta indica el estado con enrollment_open.
 * Los de matrícula abierta salen primero.
 */
/** Añade el precio vigente calculado, para que la ficha y el cobro coincidan. */
function conPrecio<T extends Record<string, unknown>>(c: T): T & { precio: ReturnType<typeof precioDe> } {
  return {
    ...c,
    precio: precioDe({
      priceCents: Number(c.price_cents),
      earlyBirdUntil: (c.early_bird_until as string | null) ?? null,
      lateSurchargePct: (c.late_surcharge_pct as number | null) ?? 0,
    }),
  };
}

export async function listOpenCourses(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, tema, subtema, modality, duration_hours, price_cents, publico_objetivo, resumen, thumbnail_key, enrollment_open, cfc,
            early_bird_until, late_surcharge_pct
     FROM courses WHERE status = 'publicado'
     ORDER BY enrollment_open DESC, created_at DESC`,
  );
  const conUrl = await presignKeys(rows, 'thumbnail_key', 'thumbnail_url');
  res.json({ courses: conUrl.map(conPrecio) });
}

/** Public: full info of one published course (for its landing page). */
export async function getPublicCourse(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, tema, subtema, modality, duration_hours, price_cents,
            publico_objetivo, objetivo_general, objetivos_especificos, resumen, acreditacion, cfc,
            thumbnail_key, enrollment_open, early_bird_until, late_surcharge_pct
     FROM courses WHERE id = $1 AND status = 'publicado'`,
    [req.params.id],
  );
  if (rows.length === 0) throw notFound('Curso no encontrado');
  const staff = await query(
    `SELECT u.id, u.name, u.headline, cs.role FROM course_staff cs JOIN users u ON u.id = cs.user_id WHERE cs.course_id = $1`,
    [req.params.id],
  );
  // Programa público: módulos con los títulos de sus actividades (temas).
  const program = await query<{ id: string; title: string }>(
    `SELECT m.id, m.title,
            COALESCE(json_agg(json_build_object('type', a.type, 'title', a.title) ORDER BY a.sort_order)
                     FILTER (WHERE a.id IS NOT NULL), '[]') AS activities
     FROM modules m
     LEFT JOIN activities a ON a.module_id = m.id
     WHERE m.course_id = $1
     GROUP BY m.id, m.title, m.sort_order
     ORDER BY m.sort_order`,
    [req.params.id],
  );
  const gallery = await presignKeys(
    (await query<{ id: string; image_key: string; url?: string }>('SELECT id, image_key FROM course_images WHERE course_id = $1 ORDER BY sort_order', [req.params.id])).rows,
    'image_key', 'url',
  );
  const [conUrl] = await presignKeys(rows, 'thumbnail_key', 'thumbnail_url');
  const course = conPrecio(conUrl);
  res.json({ course, staff: staff.rows, program: program.rows, gallery: gallery.map((g) => ({ id: g.id, url: g.url })) });
}

export async function listCourses(req: Request, res: Response): Promise<void> {
  const isSuper = req.auth!.role === 'super_admin';
  const { rows } = isSuper
    ? await query(
        `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
                c.price_cents, c.created_at,
                (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules
         FROM courses c ORDER BY c.created_at DESC`,
      )
    : await query(
        `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
                c.price_cents, c.created_at,
                (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules,
                cs.role AS my_role
         FROM courses c
         JOIN course_staff cs ON cs.course_id = c.id AND cs.user_id = $1
         ORDER BY c.created_at DESC`,
        [req.auth!.sub],
      );
  res.json({ courses: rows });
}

/**
 * Duración lectiva estimada del curso, desglosada por tipo de contenido.
 * Es el dato que se necesita para justificar las horas ante la comisión de
 * formación continuada (CFC). Cada actividad puede llevar duración manual
 * (duration_min), que siempre prevalece sobre la estimación.
 */
export async function courseDuration(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await assertCanAccess(id, req);

  const c = await query<{ min_per_page: string; words_per_min: number; min_per_question: string; duration_hours: string | null }>(
    'SELECT min_per_page, words_per_min, min_per_question, duration_hours FROM courses WHERE id = $1',
    [id],
  );
  if (c.rows.length === 0) throw notFound('Curso no encontrado');
  const minPerPage = Number(c.rows[0].min_per_page);
  const wordsPerMin = Number(c.rows[0].words_per_min);
  const minPerQuestion = Number(c.rows[0].min_per_question);

  const acts = await query<{
    id: string; type: string; title: string; body: string | null; duration_min: number | null;
    pages: number | null; time_limit_min: number | null; n_questions: string | null;
  }>(
    `SELECT a.id, a.type, a.title, a.body, a.duration_min,
            d.pages,
            e.time_limit_min,
            (SELECT COUNT(*) FROM exam_questions eq WHERE eq.exam_id = e.id) AS n_questions
     FROM activities a
     LEFT JOIN documents d ON d.id = a.document_id
     LEFT JOIN exams e ON e.id = a.exam_id
     WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)
     ORDER BY a.sort_order`,
    [id],
  );

  const buckets: Record<string, number> = { documentos: 0, textos: 0, videos: 0, evaluacion: 0, otros: 0 };
  const sinEstimar: Array<{ id: string; title: string; type: string }> = [];
  const detalle = acts.rows.map((a) => {
    let min = 0;
    let bucket = 'otros';
    let estimado = true;

    if (a.duration_min != null) {
      min = a.duration_min; estimado = false;
      bucket = a.type === 'video' ? 'videos' : a.type === 'documento' ? 'documentos' : a.type === 'texto' ? 'textos' : 'otros';
    } else if (a.type === 'documento') {
      bucket = 'documentos';
      min = a.pages ? Math.round(a.pages * minPerPage) : 0;
      if (!a.pages) sinEstimar.push({ id: a.id, title: a.title, type: a.type });
    } else if (a.type === 'texto') {
      bucket = 'textos';
      const words = (a.body ?? '').trim().split(/\s+/).filter(Boolean).length;
      min = Math.round(words / Math.max(1, wordsPerMin));
    } else if (a.type === 'test' || a.type === 'examen') {
      bucket = 'evaluacion';
      min = a.time_limit_min ?? Math.round(Number(a.n_questions ?? 0) * minPerQuestion);
    } else if (a.type === 'video') {
      bucket = 'videos';
      sinEstimar.push({ id: a.id, title: a.title, type: a.type }); // hay que indicar su duración
    } else {
      sinEstimar.push({ id: a.id, title: a.title, type: a.type });
    }

    buckets[bucket] += min;
    return { id: a.id, title: a.title, type: a.type, minutos: min, estimado };
  });

  const totalMin = Object.values(buckets).reduce((s, v) => s + v, 0);
  res.json({
    parametros: { minPerPage, wordsPerMin, minPerQuestion },
    porTipo: buckets,
    totalMinutos: totalMin,
    totalHoras: Math.round((totalMin / 60) * 10) / 10,
    horasDeclaradas: c.rows[0].duration_hours != null ? Number(c.rows[0].duration_hours) : null,
    sinEstimar,
    detalle,
  });
}

/** Alumnos matriculados en el curso (para el profesorado / director). */
export async function listCourseStudents(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  await assertCanAccess(id, req);
  // Total de actividades del curso: denominador de la barra de avance.
  const tot = await query<{ n: string }>(
    'SELECT COUNT(*) AS n FROM activities WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1)',
    [id],
  );
  const totalActivities = Number(tot.rows[0].n);

  const { rows } = await query(
    `SELECT s.id, s.display_name AS name, s.email, s.is_minor,
            e.status, e.enrolled_at,
            (SELECT COUNT(*) FROM activity_completions ac
              WHERE ac.student_id = s.id
                AND ac.activity_id IN (SELECT id FROM activities WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1))
            ) AS completadas,
            (SELECT COALESCE(SUM(lt.active_seconds),0) FROM learning_time lt
              WHERE lt.student_id = s.id AND lt.course_id = $1) AS active_seconds,
            (SELECT COUNT(*) FROM exam_attempts a
               JOIN exams ex ON ex.id = a.exam_id
               JOIN modules m ON m.id = ex.module_id
              WHERE m.course_id = $1 AND a.student_id = s.id) AS intentos,
            EXISTS (SELECT 1 FROM exam_attempts a
               JOIN exams ex ON ex.id = a.exam_id
               JOIN modules m ON m.id = ex.module_id
              WHERE m.course_id = $1 AND a.student_id = s.id AND a.passed) AS aprobado
     FROM enrollments e
     JOIN students s ON s.id = e.student_id
     WHERE e.course_id = $1
     ORDER BY s.display_name`,
    [id],
  );
  res.json({ students: rows, totalActivities });
}

async function assertCanAccess(courseId: string, req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  const { rows } = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [
    courseId, req.auth!.sub,
  ]);
  if (rows.length === 0) throw forbidden('No formas parte de este curso');
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const course = await query('SELECT * FROM courses WHERE id = $1', [id]);
  if (course.rows.length === 0) throw notFound('Curso no encontrado');
  await assertCanAccess(id, req);

  const [modules, staff, activities] = await Promise.all([
    query<{ id: string }>('SELECT id, title, sort_order, is_mandatory, starts_at, ends_at FROM modules WHERE course_id = $1 ORDER BY sort_order', [id]),
    query(
      `SELECT u.id, u.name, u.email, cs.role
       FROM course_staff cs JOIN users u ON u.id = cs.user_id
       WHERE cs.course_id = $1`,
      [id],
    ),
    query<{ module_id: string; image_key: string | null }>(
      `SELECT a.id, a.module_id, a.type, a.title, a.url, a.body, a.image_key, a.is_mandatory, a.document_id, a.exam_id, d.title AS document_title
       FROM activities a
       LEFT JOIN documents d ON d.id = a.document_id
       WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)
       ORDER BY a.sort_order`,
      [id],
    ),
  ]);

  const acts = await withImageUrls(activities.rows);
  const modulesWithActivities = modules.rows.map((m) => ({
    ...m,
    activities: acts.filter((a) => a.module_id === m.id),
  }));

  let [courseFull] = await presignKeys(course.rows, 'thumbnail_key', 'thumbnail_url');
  [courseFull] = await presignKeys([courseFull], 'cert_bg_key', 'cert_bg_url');
  [courseFull] = await presignKeys([courseFull], 'cfc_image_key', 'cfc_image_url');
  const gallery = await presignKeys(
    (await query<{ id: string; image_key: string; url?: string }>('SELECT id, image_key FROM course_images WHERE course_id = $1 ORDER BY sort_order', [id])).rows,
    'image_key', 'url',
  );
  res.json({ course: courseFull, modules: modulesWithActivities, staff: staff.rows, gallery: gallery.map((g) => ({ id: g.id, url: g.url })) });
}
