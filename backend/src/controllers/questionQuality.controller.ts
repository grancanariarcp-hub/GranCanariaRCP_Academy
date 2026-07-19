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
     SELECT eq.id, eq.text, eq.format, eq.excluded_from_grading,
            COALESCE(s.respondida, 0) AS respondida,
            COALESCE(s.aciertos, 0) AS aciertos,
            CASE WHEN COALESCE(s.respondida,0) > 0
                 THEN ROUND(100.0 * COALESCE(s.aciertos,0) / s.respondida) END AS acierto_pct,
            (SELECT COUNT(*) FROM question_reports qr WHERE qr.exam_question_id = eq.id AND qr.kind <> 'ok') AS avisos,
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
  res.json({ ok: true, excluded });
}
