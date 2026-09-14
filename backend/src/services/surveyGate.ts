import { query } from '../config/database.js';

/**
 * La encuesta de satisfacción se responde AL FINAL y actúa como requisito:
 *  · si el curso tiene examen final (kind = 'examen'), hay que responderla antes
 *    de poder realizarlo;
 *  · si no lo tiene, hay que responderla antes de obtener el certificado.
 * Así garantizamos la evaluación de la actividad, que además pide la comisión.
 */
export async function hasAnsweredSurvey(courseId: string, studentId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM survey_responses r
       JOIN course_surveys cs ON cs.id = r.survey_id
      WHERE cs.course_id = $1 AND r.student_id = $2`,
    [courseId, studentId],
  );
  return rows.length > 0;
}

/**
 * ¿La encuesta actúa como requisito? Solo si está INCLUIDA (is_open) y marcada
 * como OBLIGATORIA. Si no, no bloquea ni el examen final ni el certificado.
 */
export async function encuestaObligatoria(courseId: string): Promise<boolean> {
  const { rows } = await query<{ is_open: boolean; required: boolean }>(
    'SELECT is_open, required FROM course_surveys WHERE course_id = $1',
    [courseId],
  );
  return !!rows[0] && rows[0].is_open && rows[0].required;
}

/** ¿El curso tiene examen final? */
export async function hasFinalExam(courseId: string): Promise<boolean> {
  const { rows } = await query(
    `SELECT 1 FROM exams e JOIN modules m ON m.id = e.module_id
      WHERE m.course_id = $1 AND e.kind = 'examen'`,
    [courseId],
  );
  return rows.length > 0;
}
