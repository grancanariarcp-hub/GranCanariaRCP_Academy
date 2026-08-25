import type { Request, Response } from 'express';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { assertEditor } from '../services/courseAuth.js';
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
  // Marca que el curso está en trámite de acreditación: hace que la Comisión CFC
  // pueda verlo antes de publicarse.
  cfcEnTramite: z.boolean().optional().default(false),
  // Tipo elegido al crear: una OPE es un generador de exámenes, no un curso.
  esOpe: z.boolean().optional().default(false),
  // Plantilla: añade un módulo «Evaluación final» con un examen (para acreditar).
  conExamenFinal: z.boolean().optional().default(false),
});

export async function createCourse(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  const userId = req.auth!.sub;

  const course = await withTransaction(async (client) => {
    // Código legible del curso: PREFIJO-Modalidad-AÑO-NN. El prefijo sale del
    // tema (o el título); NN es el nº de curso de ese año.
    const year = new Date().getFullYear();
    const cnt = await client.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM courses WHERE date_part('year', created_at) = $1", [year],
    );
    const nn = String((cnt.rows[0]?.n ?? 0) + 1).padStart(2, '0');
    const base = ((data.tema || data.title || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4)) || (data.esOpe ? 'OPE' : 'CUR');
    const mod = data.modality === 'online' ? 'ONL' : data.modality === 'presencial' ? 'PRE' : 'MIX';
    const codigo = `${base}-${mod}-${year}-${nn}`;

    const { rows } = await client.query(
      `INSERT INTO courses
         (title, tema, subtema, duration_hours, modality, objetivo_general,
          objetivos_especificos, publico_objetivo, price_cents, resumen, acreditacion, cfc, cfc_en_tramite, es_ope, created_by, codigo_curso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       RETURNING id, title, tema, subtema, status, es_ope, created_at, codigo_curso`,
      [
        data.title, data.tema ?? null, data.subtema ?? null, data.durationHours ?? null,
        data.modality, data.objetivoGeneral ?? null, data.objetivosEspecificos ?? null,
        data.publicoObjetivo, data.priceCents, data.resumen ?? null, data.acreditacion ?? null, data.cfc ?? null, data.cfcEnTramite, data.esOpe, userId, codigo,
      ],
    );
    const created = rows[0];

    // Creator becomes director of the course, ya aceptado (creó el curso).
    await client.query(
      `INSERT INTO course_staff (course_id, user_id, role, status) VALUES ($1, $2, 'director', 'aceptado')`,
      [created.id, userId],
    );

    // Una OPE no tiene módulos ni encuesta de satisfacción: es un generador de
    // exámenes. Solo un Curso arranca con Bienvenida + Módulo 1 y su encuesta.
    if (!data.esOpe) {
      await client.query(
        `INSERT INTO modules (course_id, title, sort_order) VALUES ($1, 'Bienvenida', 0), ($1, 'Módulo 1', 1)`,
        [created.id],
      );
      await client.query('INSERT INTO course_surveys (course_id) VALUES ($1) ON CONFLICT (course_id) DO NOTHING', [created.id]);

      // Plantilla CFC: un módulo «Evaluación final» con un examen ya creado
      // (vacío; el profesor le añade preguntas). Arranca verde el requisito de
      // evaluación del asistente de acreditación.
      if (data.conExamenFinal) {
        const m = await client.query<{ id: string }>(
          `INSERT INTO modules (course_id, title, sort_order) VALUES ($1, 'Evaluación final', 2) RETURNING id`, [created.id],
        );
        const ex = await client.query<{ id: string }>(
          `INSERT INTO exams (module_id, title, kind, attempts_allowed, pass_pct) VALUES ($1, 'Examen final', 'examen', 1, 60) RETURNING id`,
          [m.rows[0].id],
        );
        await client.query(
          `INSERT INTO activities (module_id, type, title, exam_id, sort_order) VALUES ($1, 'examen', 'Examen final', $2, 0)`,
          [m.rows[0].id, ex.rows[0].id],
        );
      }
    }

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
     FROM courses WHERE status = 'publicado' AND NOT es_ope
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
            thumbnail_key, enrollment_open, early_bird_until, late_surcharge_pct, tipo_clinico
     FROM courses WHERE id = $1 AND status = 'publicado' AND NOT es_ope`,
    [req.params.id],
  );
  if (rows.length === 0) throw notFound('Curso no encontrado');
  // Profesorado del curso con su ficha: el director primero, porque es quien
  // responde de la actividad ante la comisión y ante el alumnado.
  const staffRows = await query<{ id: string; name: string; headline: string | null; role: string; photo_key: string | null }>(
    `SELECT u.id, u.name, u.headline, u.photo_key, cs.role
       FROM course_staff cs JOIN users u ON u.id = cs.user_id
      WHERE cs.course_id = $1
      ORDER BY CASE cs.role WHEN 'director' THEN 0 ELSE 1 END, u.name`,
    [req.params.id],
  );
  // Se devuelve una forma estable y sin la clave interna de almacenamiento.
  const staffConFoto = await presignKeys(staffRows.rows, 'photo_key', 'photo_url');
  const staff = {
    rows: staffConFoto.map((u) => ({
      id: u.id, name: u.name, headline: u.headline, role: u.role,
      photo_url: (u as { photo_url?: string }).photo_url ?? null,
    })),
  };
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

/**
 * GET /api/courses/taxonomia — temas y subtemas ya usados en la academia.
 *
 * Alimenta las sugerencias del formulario: el profesor escribe libremente, pero
 * ve lo que ya existe para reutilizar la misma clasificación en vez de inventar
 * variantes («RCP», «rcp», «R.C.P.»). Devuelve los temas y, por cada tema, sus
 * subtemas, para que el desplegable de subtema se acote al tema elegido.
 */
export async function courseTaxonomy(_req: Request, res: Response): Promise<void> {
  const { rows } = await query<{ tema: string; subtema: string | null }>(
    `SELECT DISTINCT tema, subtema FROM courses
      WHERE tema IS NOT NULL AND tema <> ''
      ORDER BY tema, subtema`,
  );
  const temas: string[] = [];
  const porTema: Record<string, string[]> = {};
  for (const r of rows) {
    if (!temas.includes(r.tema)) { temas.push(r.tema); porTema[r.tema] = []; }
    if (r.subtema && !porTema[r.tema].includes(r.subtema)) porTema[r.tema].push(r.subtema);
  }
  res.json({ temas, porTema });
}

export async function listCourses(req: Request, res: Response): Promise<void> {
  const rol = req.auth!.role;
  // El auditor de la comisión revisa, pero solo lo que le compete: cursos ya
  // publicados o marcados «en trámite de CFC». No los borradores a medio montar.
  if (rol === 'auditor') {
    const { rows } = await query(
      `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
              c.price_cents, c.created_at, c.cfc_en_tramite, c.codigo_curso,
              (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules
         FROM courses c
        WHERE c.status = 'publicado' OR c.cfc_en_tramite
        ORDER BY c.created_at DESC`,
    );
    res.json({ courses: rows });
    return;
  }
  const isSuper = rol === 'super_admin';
  const { rows } = isSuper
    ? await query(
        `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
                c.price_cents, c.created_at, c.cfc_en_tramite, c.ends_at, c.acta_closed_at, c.es_ope, c.codigo_curso,
                (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules
         FROM courses c ORDER BY c.created_at DESC`,
      )
    : await query(
        `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
                c.price_cents, c.created_at, c.ends_at, c.acta_closed_at, c.es_ope, c.codigo_curso,
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
  // La Comisión CFC audita el curso (contenido, estructura, horas), no a las
  // personas: no debe ver el listado nominal con nombres, correos y aprobados.
  if (req.auth!.role === 'auditor') throw forbidden('La comisión no accede a los datos nominales del alumnado');
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

async function assertCanAccess(courseId: string, req: Request, course?: { status: string; cfc_en_tramite?: boolean }): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  // El auditor solo entra a lo que le compete: publicado o en trámite de CFC.
  // Si no, un borrador ajeno sería accesible tecleando su URL. Se carga el curso
  // aquí cuando el llamador no lo pasa, para que la regla valga en todas las
  // sub-pantallas del curso (duración, alumnos…) sin repetir la comprobación.
  if (req.auth!.role === 'auditor') {
    let c = course;
    if (!c) {
      const r = await query<{ status: string; cfc_en_tramite: boolean }>(
        'SELECT status, cfc_en_tramite FROM courses WHERE id = $1', [courseId],
      );
      c = r.rows[0];
    }
    if (c && (c.status === 'publicado' || c.cfc_en_tramite)) return;
    throw forbidden('La comisión solo puede consultar cursos publicados o en trámite de CFC');
  }
  const { rows } = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [
    courseId, req.auth!.sub,
  ]);
  if (rows.length === 0) throw forbidden('No formas parte de este curso');
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const course = await query('SELECT * FROM courses WHERE id = $1', [id]);
  if (course.rows.length === 0) throw notFound('Curso no encontrado');
  await assertCanAccess(id, req, course.rows[0] as { status: string; cfc_en_tramite?: boolean });

  const [modules, staff, activities] = await Promise.all([
    query<{ id: string }>('SELECT id, title, sort_order, is_mandatory, starts_at, ends_at FROM modules WHERE course_id = $1 ORDER BY sort_order', [id]),
    query(
      `SELECT u.id, u.name, u.email, cs.role, cs.parte, cs.status
       FROM course_staff cs JOIN users u ON u.id = cs.user_id
       WHERE cs.course_id = $1`,
      [id],
    ),
    query<{ module_id: string; image_key: string | null }>(
      `SELECT a.id, a.module_id, a.type, a.title, a.url, a.body, a.image_key, a.is_mandatory, a.document_id, a.exam_id, a.evaluable, a.metodo_eval, d.title AS document_title
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

/**
 * Copia una fila (y solo una) aplicando overrides, mediante INSERT ... SELECT en
 * el propio Postgres: así los tipos jsonb y arrays se copian intactos (un
 * round-trip por JavaScript los rompería). Devuelve el id de la copia.
 */
async function duplicarFila(
  c: PoolClient, tabla: string, whereCol: string, whereVal: string,
  overrides: Record<string, unknown>,
): Promise<string> {
  const cols = (await c.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
        AND column_name NOT IN ('id', 'created_at', 'updated_at')
      ORDER BY ordinal_position`, [tabla],
  )).rows.map((r) => r.column_name);
  const params: unknown[] = [];
  const selects = cols.map((cn) => {
    if (Object.prototype.hasOwnProperty.call(overrides, cn)) {
      params.push(overrides[cn]);
      return `$${params.length}`;
    }
    return `"${cn}"`;
  });
  params.push(whereVal);
  const r = await c.query<{ id: string }>(
    `INSERT INTO "${tabla}" (${cols.map((cn) => `"${cn}"`).join(', ')})
     SELECT ${selects.join(', ')} FROM "${tabla}" WHERE "${whereCol}" = $${params.length}
     RETURNING id`, params,
  );
  return r.rows[0].id;
}

/**
 * POST /api/courses/:id/duplicar — duplica un curso como plantilla.
 * Copia la ficha, los módulos, las actividades y sus exámenes (con preguntas).
 * NO copia alumnos, matrículas ni profesorado; queda en BORRADOR, sin código y
 * a nombre de quien lo duplica.
 */
export async function duplicateCourse(req: Request, res: Response): Promise<void> {
  if (req.auth!.role === 'auditor') throw forbidden('La comisión no crea cursos');
  await assertEditor(req); // super_admin o parte del profesorado del curso origen
  const src = req.params.id;

  const nuevoId = await withTransaction(async (c) => {
    const existe = await c.query<{ title: string }>('SELECT title FROM courses WHERE id = $1', [src]);
    if (existe.rows.length === 0) throw notFound('Curso no encontrado');

    const newCourseId = await duplicarFila(c, 'courses', 'id', src, {
      created_by: req.auth!.sub,
      status: 'borrador',
      enrollment_open: false,
      title: `${existe.rows[0].title} (copia)`,
      codigo_curso: null,
      cfc_en_tramite: false,
      cfc_solicitado_at: null,
      cfc_solicitado_by: null,
      starts_at: null,
      ends_at: null,
      final_exam_start: null,
      final_exam_end: null,
    });

    // Módulos: mapa viejo → nuevo para recolgar sus actividades.
    const mods = await c.query<{ id: string }>('SELECT id FROM modules WHERE course_id = $1 ORDER BY sort_order', [src]);
    const modMap = new Map<string, string>();
    for (const m of mods.rows) {
      modMap.set(m.id, await duplicarFila(c, 'modules', 'id', m.id, { course_id: newCourseId }));
    }

    // Actividades, con su examen y preguntas si lo tienen.
    if (mods.rows.length > 0) {
      const acts = await c.query<{ id: string; module_id: string; exam_id: string | null }>(
        'SELECT id, module_id, exam_id FROM activities WHERE module_id = ANY($1::uuid[]) ORDER BY module_id, sort_order',
        [mods.rows.map((m) => m.id)],
      );
      for (const a of acts.rows) {
        const newModId = modMap.get(a.module_id)!;
        let newExamId: string | null = null;
        if (a.exam_id) {
          newExamId = await duplicarFila(c, 'exams', 'id', a.exam_id, { module_id: newModId });
          const eqs = await c.query<{ id: string }>('SELECT id FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order', [a.exam_id]);
          for (const q of eqs.rows) await duplicarFila(c, 'exam_questions', 'id', q.id, { exam_id: newExamId });
        }
        await duplicarFila(c, 'activities', 'id', a.id, { module_id: newModId, exam_id: newExamId });
      }
    }
    return newCourseId;
  });

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'COURSE_DUPLICATE',
    entity: 'course', entityId: nuevoId, ip: clientIp(req), metadata: { origen: src },
  });
  res.status(201).json({ course: { id: nuevoId } });
}
