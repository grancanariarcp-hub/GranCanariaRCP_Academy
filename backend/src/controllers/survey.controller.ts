import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';

/**
 * Encuesta de satisfacción del curso.
 * Los ítems se generan al vuelo: un ítem por cada MÓDULO, uno por cada PROFESOR
 * del curso y un bloque fijo de aspectos generales (metodología, organización,
 * materiales…). Así la encuesta siempre refleja el curso tal y como está.
 */

const ITEMS_GENERALES = [
  'Metodología docente',
  'Organización del curso',
  'Materiales y documentación',
  'Claridad de los contenidos',
  'Duración adecuada al contenido',
  'Utilidad para mi práctica profesional',
];

async function surveyIdFor(courseId: string): Promise<string> {
  const s = await query<{ id: string }>('SELECT id FROM course_surveys WHERE course_id = $1', [courseId]);
  if (s.rows.length > 0) return s.rows[0].id;
  const ins = await query<{ id: string }>('INSERT INTO course_surveys (course_id) VALUES ($1) RETURNING id', [courseId]);
  return ins.rows[0].id;
}

/** GET /api/student/courses/:courseId/survey — la encuesta que verá el alumno. */
export async function getSurveyForStudent(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  const enr = await query('SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.auth!.sub, courseId]);
  if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');

  const surveyId = await surveyIdFor(courseId);
  const [survey, mods, profes, mine] = await Promise.all([
    query<{ is_open: boolean }>('SELECT is_open FROM course_surveys WHERE id = $1', [surveyId]),
    // El módulo de bienvenida no se evalúa: no es contenido formativo.
    query<{ id: string; title: string }>(
      "SELECT id, title FROM modules WHERE course_id = $1 AND title NOT ILIKE 'bienvenida%' ORDER BY sort_order",
      [courseId],
    ),
    query<{ id: string; name: string; role: string }>(
      `SELECT u.id, u.name, cs.role FROM course_staff cs JOIN users u ON u.id = cs.user_id
        WHERE cs.course_id = $1 ORDER BY cs.role, u.name`,
      [courseId],
    ),
    query('SELECT submitted_at FROM survey_responses WHERE survey_id = $1 AND student_id = $2', [surveyId, req.auth!.sub]),
  ]);

  res.json({
    abierta: survey.rows[0]?.is_open ?? true,
    yaRespondida: mine.rows.length > 0,
    escala: { min: 1, max: 10, etiquetaMin: 'Muy deficiente', etiquetaMax: 'Excelente' },
    items: [
      ...mods.rows.map((m) => ({ kind: 'modulo' as const, ref: m.id, label: m.title })),
      ...profes.rows.map((p) => ({ kind: 'profesor' as const, ref: p.id, label: `${p.name} (${p.role})` })),
      ...ITEMS_GENERALES.map((g) => ({ kind: 'general' as const, ref: null, label: g })),
    ],
  });
}

/** POST /api/student/courses/:courseId/survey — enviar la encuesta. */
const submitSchema = z.object({
  scores: z.array(z.object({
    kind: z.enum(['modulo', 'profesor', 'general']),
    ref: z.string().uuid().nullable().optional(),
    label: z.string().min(1).max(200),
    score: z.number().int().min(1).max(10).nullable().optional(),
    skipped: z.boolean().optional().default(false),
    comment: z.string().max(1000).optional(),
  }).refine((i) => i.skipped || (i.score != null), {
    message: 'Valora el ítem o marca «No deseo evaluar este ítem»',
  })).min(1),
  globalRating: z.number().int().min(1).max(10),
  wouldRecommend: z.boolean(),
  comments: z.string().max(2000).optional(),
});

export async function submitSurvey(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  const enr = await query('SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.auth!.sub, courseId]);
  if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');

  const surveyId = await surveyIdFor(courseId);
  const open = await query<{ is_open: boolean }>('SELECT is_open FROM course_surveys WHERE id = $1', [surveyId]);
  if (!open.rows[0]?.is_open) throw badRequest('La encuesta está cerrada', 'SURVEY_CLOSED');

  const already = await query('SELECT 1 FROM survey_responses WHERE survey_id = $1 AND student_id = $2', [surveyId, req.auth!.sub]);
  if (already.rows.length > 0) throw badRequest('Ya has respondido esta encuesta. ¡Gracias!', 'ALREADY_ANSWERED');

  const d = submitSchema.parse(req.body);
  await withTransaction(async (client) => {
    const r = await client.query<{ id: string }>(
      `INSERT INTO survey_responses (survey_id, student_id, global_rating, would_recommend, comments)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [surveyId, req.auth!.sub, d.globalRating, d.wouldRecommend, d.comments ?? null],
    );
    for (const s of d.scores) {
      await client.query(
        `INSERT INTO survey_item_scores (response_id, item_kind, item_ref, item_label, score, skipped, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [r.rows[0].id, s.kind, s.ref ?? null, s.label, s.skipped ? null : s.score, s.skipped ?? false, s.comment ?? null],
      );
    }
  });
  res.status(201).json({ ok: true });
}

/** GET /api/courses/:id/survey/results — resultados agregados (profesorado). */
export async function surveyResults(req: Request, res: Response): Promise<void> {
  const courseId = req.params.id;
  if (req.auth!.role !== 'super_admin') {
    const staff = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [courseId, req.auth!.sub]);
    if (staff.rows.length === 0) throw forbidden('No formas parte de este curso');
  }
  const s = await query<{ id: string }>('SELECT id FROM course_surveys WHERE course_id = $1', [courseId]);
  if (s.rows.length === 0) { res.json({ respuestas: 0, porItem: [], comentarios: [] }); return; }
  const surveyId = s.rows[0].id;

  const [resumen, porItem, comentarios, matriculados] = await Promise.all([
    query<{ n: string; media_global: string | null; recomiendan: string }>(
      `SELECT COUNT(*) AS n, ROUND(AVG(global_rating), 2) AS media_global,
              COUNT(*) FILTER (WHERE would_recommend) AS recomiendan
         FROM survey_responses WHERE survey_id = $1`,
      [surveyId],
    ),
    query<{ item_kind: string; item_label: string; media: string | null; n: string; sin_evaluar: string; comentarios: string[] }>(
      `SELECT si.item_kind, si.item_label,
              ROUND(AVG(si.score) FILTER (WHERE NOT si.skipped), 2) AS media,
              COUNT(*) FILTER (WHERE NOT si.skipped) AS n,
              COUNT(*) FILTER (WHERE si.skipped) AS sin_evaluar,
              COALESCE(ARRAY_AGG(si.comment) FILTER (WHERE si.comment IS NOT NULL AND si.comment <> ''), '{}') AS comentarios
         FROM survey_item_scores si
         JOIN survey_responses r ON r.id = si.response_id
        WHERE r.survey_id = $1
        GROUP BY si.item_kind, si.item_label
        ORDER BY si.item_kind, AVG(si.score) FILTER (WHERE NOT si.skipped) DESC NULLS LAST`,
      [surveyId],
    ),
    query<{ comments: string; submitted_at: string }>(
      `SELECT comments, submitted_at FROM survey_responses
        WHERE survey_id = $1 AND comments IS NOT NULL AND comments <> ''
        ORDER BY submitted_at DESC LIMIT 50`,
      [surveyId],
    ),
    query<{ n: string }>('SELECT COUNT(*) AS n FROM enrollments WHERE course_id = $1', [courseId]),
  ]);

  const n = Number(resumen.rows[0].n);
  const matric = Number(matriculados.rows[0].n);
  res.json({
    respuestas: n,
    matriculados: matric,
    participacionPct: matric > 0 ? Math.round((n / matric) * 100) : 0,
    mediaGlobal: resumen.rows[0].media_global ? Number(resumen.rows[0].media_global) : null,
    recomiendanPct: n > 0 ? Math.round((Number(resumen.rows[0].recomiendan) / n) * 100) : null,
    porItem: porItem.rows.map((i) => ({
      kind: i.item_kind, label: i.item_label,
      media: i.media != null ? Number(i.media) : null,
      n: Number(i.n), sinEvaluar: Number(i.sin_evaluar), comentarios: i.comentarios ?? [],
    })),
    comentarios: comentarios.rows,
  });
}

/** PATCH /api/courses/:id/survey — abrir o cerrar la encuesta (director). */
export async function setSurveyOpen(req: Request, res: Response): Promise<void> {
  const courseId = req.params.id;
  if (req.auth!.role !== 'super_admin') {
    const staff = await query("SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2 AND role = 'director'", [courseId, req.auth!.sub]);
    if (staff.rows.length === 0) throw forbidden('Solo el director puede abrir o cerrar la encuesta');
  }
  const { isOpen } = z.object({ isOpen: z.boolean() }).parse(req.body);
  const surveyId = await surveyIdFor(courseId);
  const r = await query('UPDATE course_surveys SET is_open = $1 WHERE id = $2 RETURNING is_open', [isOpen, surveyId]);
  if (r.rows.length === 0) throw notFound('Encuesta no encontrada');
  res.json({ ok: true, isOpen });
}
