import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { assertEditor } from '../services/courseAuth.js';

/**
 * Calidad de las preguntas de examen:
 *  · el alumno señala si una pregunta le pareció correcta, ambigua, mal
 *    redactada o errónea;
 *  · el profesorado ve el índice de dificultad real (cuántos la fallan) junto a
 *    esos avisos, y puede ANULARLA para que no cuente a nadie.
 */

// POST /api/student/exams/:examId/questions/:questionId/report
const reportSchema = z.object({
  kind: z.enum(['ok', 'ambigua', 'mal_redactada', 'error']),
  comment: z.string().max(600).optional(),
});

export async function reportQuestion(req: Request, res: Response): Promise<void> {
  const { questionId, examId } = req.params;
  const d = reportSchema.parse(req.body);

  // Debe haber hecho ese examen y la pregunta debe ser suya.
  const ok = await query(
    `SELECT 1 FROM exam_questions eq
       JOIN exam_attempts a ON a.exam_id = eq.exam_id
      WHERE eq.id = $1 AND eq.exam_id = $2 AND a.student_id = $3 AND a.submitted_at IS NOT NULL`,
    [questionId, examId, req.auth!.sub],
  );
  if (ok.rows.length === 0) throw forbidden('Solo puedes valorar preguntas de exámenes que hayas realizado');

  await query(
    `INSERT INTO question_reports (exam_question_id, student_id, kind, comment)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (exam_question_id, student_id)
     DO UPDATE SET kind = EXCLUDED.kind, comment = EXCLUDED.comment, created_at = NOW()`,
    [questionId, req.auth!.sub, d.kind, d.comment ?? null],
  );
  res.json({ ok: true });
}

/**
 * GET /api/courses/:id/exams/:examId/quality — dificultad + avisos por pregunta.
 * La dificultad se calcula sobre las respuestas guardadas en cada intento.
 */
export async function examQuality(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { examId } = req.params;
  const exam = await query('SELECT 1 FROM exams e JOIN modules m ON m.id = e.module_id WHERE e.id = $1 AND m.course_id = $2',
    [examId, req.params.id]);
  if (exam.rows.length === 0) throw notFound('Examen no encontrado');

  const { rows } = await query(
    `WITH respuestas AS (
       SELECT (kv.key)::uuid AS question_id, kv.value AS respuesta
         FROM exam_attempts a, jsonb_each(COALESCE(a.answers, '{}'::jsonb)) kv
        WHERE a.exam_id = $1 AND a.submitted_at IS NOT NULL
     ),
     stats AS (
       SELECT r.question_id,
              COUNT(*) AS respondida,
              COUNT(*) FILTER (
                WHERE jsonb_typeof(r.respuesta) = 'number'
                  AND (r.respuesta)::text::int = eq.correct_index
              ) AS aciertos
         FROM respuestas r JOIN exam_questions eq ON eq.id = r.question_id
        GROUP BY r.question_id
     )
     -- Los recuentos se convierten a entero aquí: Postgres devuelve COUNT y
     -- ROUND como texto, y comparar "0" < 30 en la pantalla solo funciona por
     -- coerción de JavaScript. Un contrato que se apoya en eso se rompe el día
     -- que alguien escribe una comparación estricta.
     SELECT eq.id, eq.text, eq.format, eq.excluded_from_grading,
            COALESCE(s.respondida, 0)::int AS respondida,
            COALESCE(s.aciertos, 0)::int AS aciertos,
            CASE WHEN COALESCE(s.respondida,0) > 0
                 THEN ROUND(100.0 * COALESCE(s.aciertos,0) / s.respondida)::int END AS acierto_pct,
            (SELECT COUNT(*) FROM question_reports qr WHERE qr.exam_question_id = eq.id AND qr.kind <> 'ok')::int AS avisos,
            (SELECT COALESCE(json_agg(json_build_object('kind', qr.kind, 'comment', qr.comment)), '[]')
               FROM question_reports qr WHERE qr.exam_question_id = eq.id AND qr.kind <> 'ok') AS detalle_avisos
       FROM exam_questions eq
       LEFT JOIN stats s ON s.question_id = eq.id
      WHERE eq.exam_id = $1
      ORDER BY (SELECT COUNT(*) FROM question_reports qr WHERE qr.exam_question_id = eq.id AND qr.kind <> 'ok') DESC,
               acierto_pct ASC NULLS LAST`,
    [examId],
  );
  res.json({ questions: rows });
}

/** PATCH /api/courses/:id/exams/:examId/questions/:questionId/grading — anular. */
export async function setQuestionGrading(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { excluded } = z.object({ excluded: z.boolean() }).parse(req.body);
  const r = await query(
    `UPDATE exam_questions eq SET excluded_from_grading = $1
       FROM exams e JOIN modules m ON m.id = e.module_id
      WHERE eq.id = $2 AND eq.exam_id = e.id AND e.id = $3 AND m.course_id = $4
      RETURNING eq.id, eq.excluded_from_grading`,
    [excluded, req.params.questionId, req.params.examId, req.params.id],
  );
  if (r.rows.length === 0) throw badRequest('Pregunta no encontrada en este examen', 'NOT_FOUND');

  const recalificados = await recalificarIntentos(req.params.examId, Number(
    (await query<{ p: number }>('SELECT pass_pct AS p FROM exams WHERE id = $1', [req.params.examId])).rows[0]?.p ?? 50,
  ));
  res.json({ ok: true, excluded, recalificados });
}

/**
 * Vuelve a calificar los exámenes YA ENTREGADOS.
 *
 * Anular una pregunta solo cambiaba una casilla: las notas seguían siendo las
 * que se congelaron al entregar, así que una pregunta reconocida como errónea
 * dejaba en pie todos los suspensos que había provocado. En formación
 * acreditada eso es una nota que no se puede defender ante quien la reclame.
 *
 * Se recalcula sobre las respuestas guardadas de cada intento, contando solo
 * las preguntas vigentes y las que le tocaron a cada alumno. Nadie baja de
 * nota: anular puede subir el porcentaje o dejarlo igual, nunca perjudicar.
 */
async function recalificarIntentos(examId: string, passPct: number): Promise<number> {
  const preguntas = await query<{ id: string; format: string; correct_index: number | null }>(
    `SELECT id, format, correct_index FROM exam_questions
      WHERE exam_id = $1 AND excluded_from_grading = FALSE`,
    [examId],
  );
  const vigentes = new Map(preguntas.rows.map((q) => [q.id, q]));

  const intentos = await query<{ id: string; answers: Record<string, unknown> | null; served_questions: string[] | null }>(
    `SELECT id, answers, served_questions FROM exam_attempts
      WHERE exam_id = $1 AND submitted_at IS NOT NULL`,
    [examId],
  );

  let tocados = 0;
  for (const intento of intentos.rows) {
    const suyas = intento.served_questions && intento.served_questions.length > 0
      ? intento.served_questions.filter((id) => vigentes.has(id))
      : [...vigentes.keys()];

    let total = 0;
    let aciertos = 0;
    for (const id of suyas) {
      const q = vigentes.get(id)!;
      if (q.format === 'abierta') continue;
      total += 1;
      const marcada = (intento.answers ?? {})[id];
      if (typeof marcada === 'number' && marcada === q.correct_index) aciertos += 1;
    }
    const nota = total > 0 ? Math.round((aciertos / total) * 100) : null;
    const aprobado = nota !== null ? nota >= passPct : null;

    const upd = await query(
      `UPDATE exam_attempts
          SET score = $1, passed = $2, auto_total = $3, auto_correct = $4
        WHERE id = $5 AND fuera_de_plazo = FALSE
          AND (score IS DISTINCT FROM $1 OR passed IS DISTINCT FROM $2)`,
      [nota, aprobado, total, aciertos, intento.id],
    );
    if (upd.rowCount && upd.rowCount > 0) tocados += 1;
  }
  return tocados;
}
