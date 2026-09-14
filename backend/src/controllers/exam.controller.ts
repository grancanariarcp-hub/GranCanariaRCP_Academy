import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { assertEditor, assertEditaModulo } from '../services/courseAuth.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { r2Configured, buildKey, uploadObject, withImageUrls } from '../services/r2.js';
import { norm, separarOpciones, resolverCorrecta, opcionesDepuradas } from '../services/importacionPreguntas.js';

/** Exams live inside a module; each is also an activity in that module. */

async function assertExamInCourse(examId: string, courseId: string): Promise<{ module_id: string }> {
  const { rows } = await query<{ module_id: string }>(
    `SELECT e.module_id FROM exams e JOIN modules m ON m.id = e.module_id
     WHERE e.id = $1 AND m.course_id = $2`,
    [examId, courseId],
  );
  if (rows.length === 0) throw notFound('Examen no encontrado');
  return rows[0];
}

// ---------------------------------------------------------------------------
// Create exam (also creates its activity in the module)
// ---------------------------------------------------------------------------
const createExamSchema = z.object({
  title: z.string().min(2).max(200),
  kind: z.enum(['test', 'examen']).default('test'),
  attemptsAllowed: z.number().int().min(1).max(50).default(1),
  passPct: z.number().int().min(0).max(100).default(60),
  timeLimitMin: z.number().int().min(1).max(600).nullable().optional(),
});

export async function createExam(req: Request, res: Response): Promise<void> {
  await assertEditaModulo(req, req.params.moduleId);
  const d = createExamSchema.parse(req.body);

  const mod = await query('SELECT 1 FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  if (mod.rows.length === 0) throw notFound('Módulo no encontrado');

  const exam = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO exams (module_id, title, kind, attempts_allowed, pass_pct, time_limit_min)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING id, title, kind, attempts_allowed, pass_pct, time_limit_min`,
      [req.params.moduleId, d.title, d.kind, d.attemptsAllowed, d.passPct, d.timeLimitMin ?? null],
    );
    const created = rows[0];
    await client.query(
      `INSERT INTO activities (module_id, type, title, exam_id, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order)+1 FROM activities WHERE module_id=$1),0))`,
      [req.params.moduleId, d.kind, d.title, created.id],
    );
    return created;
  });

  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'EXAM_CREATE', entity: 'exam', entityId: exam.id, ip: clientIp(req) });
  res.status(201).json({ exam });
}

// ---------------------------------------------------------------------------
// Get exam with its questions
// ---------------------------------------------------------------------------
export async function getExam(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const exam = await query('SELECT id, title, kind, attempts_allowed, pass_pct, time_limit_min, shuffle, random_per_student, questions_per_attempt, feedback_general, grading_policy FROM exams WHERE id = $1', [req.params.examId]);
  const questions = await query<{ id: string; image_key: string | null }>(
    'SELECT id, format, text, options, correct_index, video_url, image_key, explanation, option_feedback, sort_order FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order',
    [req.params.examId],
  );
  res.json({ exam: exam.rows[0], questions: await withImageUrls(questions.rows) });
}

// ---------------------------------------------------------------------------
// Update exam config
// ---------------------------------------------------------------------------
const updateExamSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  attemptsAllowed: z.number().int().min(0).max(50).optional(), // 0 = infinitos
  passPct: z.number().int().min(0).max(100).optional(),
  timeLimitMin: z.number().int().min(1).max(600).nullable().optional(),
  // Valoración general del examen que verá el alumno tras enviarlo.
  feedbackGeneral: z.string().max(4000).nullable().optional(),
  // Comportamiento por intento:
  //  shuffle            → baraja el orden de preguntas y opciones en cada intento.
  //  randomPerStudent   → cada intento sirve un subconjunto aleatorio (N) del examen.
  //  questionsPerAttempt→ cuántas preguntas por intento cuando es aleatorio.
  shuffle: z.boolean().optional(),
  randomPerStudent: z.boolean().optional(),
  questionsPerAttempt: z.number().int().min(1).max(300).nullable().optional(),
  // Con varios intentos: qué nota cuenta (la mejor o la del último intento).
  gradingPolicy: z.enum(['mejor', 'ultimo']).optional(),
});

export async function updateExam(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const d = updateExamSchema.parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title, attempts_allowed: d.attemptsAllowed, pass_pct: d.passPct, time_limit_min: d.timeLimitMin,
    shuffle: d.shuffle, random_per_student: d.randomPerStudent, questions_per_attempt: d.questionsPerAttempt,
    feedback_general: d.feedbackGeneral, grading_policy: d.gradingPolicy,
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
  }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.examId);
  const { rows } = await query(`UPDATE exams SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, title, attempts_allowed, pass_pct, time_limit_min, shuffle, random_per_student, questions_per_attempt, feedback_general, grading_policy`, params);
  res.json({ exam: rows[0] });
}

// ---------------------------------------------------------------------------
// Add / delete questions (test / verdadero-falso / abierta)
// ---------------------------------------------------------------------------
const addQuestionSchema = z.object({
  format: z.enum(['test', 'vf', 'abierta', 'escala', 'emparejar', 'multiple']),
  text: z.string().min(3),
  options: z.array(z.string().min(1)).optional(),
  correctIndex: z.number().int().min(0).optional(),
  videoUrl: z.string().url('URL de vídeo no válida').optional().or(z.literal('')),
  // escala (Likert): etiquetas de los extremos de la escala 1-5.
  escalaMin: z.string().max(60).optional(),
  escalaMax: z.string().max(60).optional(),
  // emparejar: parejas correctas (columna izquierda ↔ derecha).
  pares: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).max(10).optional(),
  // multiple (selección múltiple): opciones con marca de correcta. Si ninguna
  // está marcada, es una encuesta/autoinforme y no puntúa.
  opcionesMulti: z.array(z.object({ text: z.string().min(1), correct: z.boolean() })).max(20).optional(),
  // Feedback: general de la pregunta y por opción (alineado a las opciones).
  explanation: z.string().max(2000).optional(),
  optionFeedback: z.array(z.string().max(1000)).optional(),
});
type AddQuestion = z.infer<typeof addQuestionSchema>;

/**
 * Construye options / correct_index / option_feedback según el formato. El
 * feedback por opción se mantiene ALINEADO al filtrar opciones vacías (para que
 * no se descoloque respecto a la opción a la que pertenece).
 */
function construirPregunta(d: AddQuestion): { options: unknown; correctIndex: number | null; optionFeedback: string[] } {
  const fb = (d.optionFeedback ?? []).map((x) => String(x ?? ''));
  if (d.format === 'test') {
    const comb = (d.options ?? []).map((t, i) => ({ t: (t ?? '').trim(), f: (fb[i] ?? '').trim(), ok: i === d.correctIndex }));
    const kept = comb.filter((c) => c.t);
    if (kept.length < 2) throw badRequest('Añade al menos 2 opciones', 'BAD_OPTS');
    const ci = kept.findIndex((c) => c.ok);
    return { options: kept.map((c) => c.t), correctIndex: ci >= 0 ? ci : 0, optionFeedback: kept.map((c) => c.f) };
  }
  if (d.format === 'vf') {
    if (d.correctIndex !== 0 && d.correctIndex !== 1) throw badRequest('Indica si es Verdadero o Falso', 'BAD_VF');
    return { options: ['Verdadero', 'Falso'], correctIndex: d.correctIndex, optionFeedback: [fb[0] ?? '', fb[1] ?? ''] };
  }
  if (d.format === 'escala') {
    return { options: [d.escalaMin?.trim() || 'Nada de acuerdo', d.escalaMax?.trim() || 'Totalmente de acuerdo'], correctIndex: null, optionFeedback: [] };
  }
  if (d.format === 'emparejar') {
    const pares = (d.pares ?? []).map((p) => ({ left: p.left.trim(), right: p.right.trim() })).filter((p) => p.left && p.right);
    if (pares.length < 2) throw badRequest('Añade al menos 2 parejas', 'BAD_PARES');
    return { options: pares, correctIndex: null, optionFeedback: [] };
  }
  if (d.format === 'multiple') {
    const opts = (d.opcionesMulti ?? []).map((o, i) => ({ text: o.text.trim(), correct: !!o.correct, f: (fb[i] ?? '').trim() })).filter((o) => o.text);
    if (opts.length < 2) throw badRequest('Añade al menos 2 opciones', 'BAD_OPTS');
    return { options: opts.map((o) => ({ text: o.text, correct: o.correct })), correctIndex: null, optionFeedback: opts.map((o) => o.f) };
  }
  return { options: [], correctIndex: null, optionFeedback: [] }; // abierta
}

export async function addExamQuestion(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const d = addQuestionSchema.parse(req.body);
  const { options, correctIndex, optionFeedback } = construirPregunta(d);

  const { rows } = await query(
    `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, video_url, explanation, option_feedback, sort_order)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::jsonb, COALESCE((SELECT MAX(sort_order)+1 FROM exam_questions WHERE exam_id=$1),0))
     RETURNING id, format, text, options, correct_index, video_url, explanation, option_feedback`,
    [req.params.examId, d.format, d.text.trim(), JSON.stringify(options), correctIndex, d.videoUrl || null, d.explanation?.trim() || null, JSON.stringify(optionFeedback)],
  );
  res.status(201).json({ question: rows[0] });
}

/** PATCH /:id/exams/:examId/questions/:questionId — editar una pregunta y su feedback. */
export async function updateExamQuestion(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const existe = await query<{ format: string }>('SELECT format FROM exam_questions WHERE id = $1 AND exam_id = $2', [req.params.questionId, req.params.examId]);
  if (existe.rows.length === 0) throw notFound('Pregunta no encontrada');
  // El formato no cambia al editar: se toma el guardado.
  const d = addQuestionSchema.parse({ ...req.body, format: existe.rows[0].format });
  const { options, correctIndex, optionFeedback } = construirPregunta(d);

  const { rows } = await query(
    `UPDATE exam_questions SET text = $1, options = $2::jsonb, correct_index = $3, video_url = $4, explanation = $5, option_feedback = $6::jsonb
      WHERE id = $7 AND exam_id = $8
      RETURNING id, format, text, options, correct_index, video_url, explanation, option_feedback`,
    [d.text.trim(), JSON.stringify(options), correctIndex, d.videoUrl || null, d.explanation?.trim() || null, JSON.stringify(optionFeedback), req.params.questionId, req.params.examId],
  );
  res.json({ question: rows[0] });
}

// ---------------------------------------------------------------------------
// Bulk import of exam questions (JSON)
// ---------------------------------------------------------------------------
function normFmt(v: unknown): 'test' | 'vf' | 'abierta' | null {
  const s = norm(v);
  if (['test', 'opcion_multiple', 'multiple', 'opciones'].includes(s)) return 'test';
  if (['vf', 'verdadero_falso', 'verdadero/falso', 'verdaderofalso', 'v/f', 'vof'].includes(s)) return 'vf';
  if (['abierta', 'libre', 'texto'].includes(s)) return 'abierta';
  return null;
}
/**
 * Verdadero o falso.
 *
 * Los números se leen empezando por 1 —1 = Verdadero, 2 = Falso—, igual que
 * resolveCorrect, para que un mismo fichero no signifique una cosa en las
 * preguntas de test y otra en las de V/F.
 *
 * Antes había dos reglas contradictorias: `'1'` estaba en la lista de Verdadero
 * y `v === 1` pretendía significar Falso. Como el valor se convierte a texto
 * antes de compararse, la segunda no llegaba a ejecutarse nunca y un fichero
 * que usara 1 para «Falso» se importaba como «Verdadero», en silencio y sin
 * fila de error. El 0 ya no se adivina: se rechaza indicándolo, que es
 * preferible a colar mal la respuesta de un examen.
 */
function resolveVF(v: unknown): number | null {
  if (v === true) return 0;
  if (v === false) return 1;
  const s = String(v ?? '').trim().toLowerCase();
  if (['v', 'verdadero', 'true', 'si', 'sí', '1', '0-verdadero'].includes(s)) return 0;
  if (['f', 'falso', 'false', 'no', '2'].includes(s)) return 1;
  return null;
}

export async function importExamQuestions(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const { questions } = z.object({ questions: z.array(z.record(z.unknown())).min(1, 'Lista vacía') }).parse(req.body);

  const errors: Array<{ fila: number; errores: string[] }> = [];
  let created = 0;

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const errs: string[] = [];
    const format = normFmt(q.format ?? q.tipo);
    const text = String(q.text ?? q.enunciado ?? '').trim();
    if (!format) errs.push('format inválido (test/vf/abierta)');
    if (text.length < 3) errs.push('enunciado vacío o muy corto');

    let options: string[] = [];
    let correctIndex: number | null = null;
    if (format === 'test') {
      // La correcta se resuelve contra la lista ORIGINAL —con sus huecos— y solo
      // después se depuran las opciones, reajustando el índice. Al revés, una
      // opción en blanco corría las siguientes y la letra del fichero acababa
      // señalando otra respuesta.
      const brutas = separarOpciones(q.options ?? q.opciones);
      const ci = resolverCorrecta(q.correcta ?? q.correct, brutas.length);
      if (ci === null) errs.push('correcta inválida (A/B/C/D o número)');
      else {
        try {
          ({ options, correctIndex } = opcionesDepuradas(brutas, ci));
        } catch {
          errs.push('faltan opciones (mínimo 2) o la correcta señala una opción vacía');
        }
      }
    } else if (format === 'vf') {
      options = ['Verdadero', 'Falso'];
      const ci = resolveVF(q.correcta ?? q.correct);
      if (ci === null) errs.push('correcta V/F inválida');
      else correctIndex = ci;
    }

    if (errs.length > 0) { errors.push({ fila: i + 1, errores: errs }); continue; }
    await query(
      `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, sort_order)
       VALUES ($1,$2,$3,$4::jsonb,$5, COALESCE((SELECT MAX(sort_order)+1 FROM exam_questions WHERE exam_id=$1),0))`,
      [req.params.examId, format, text, JSON.stringify(options), correctIndex],
    );
    created += 1;
  }
  res.json({ created, total: questions.length, errors });
}

export async function deleteExamQuestion(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  await query('DELETE FROM exam_questions WHERE id = $1 AND exam_id = $2', [req.params.questionId, req.params.examId]);
  res.json({ ok: true });
}

// GET /api/courses/:id/exams/:examId/attempts — calificaciones (profesor)
export async function listExamAttempts(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const { rows } = await query(
    `SELECT a.id, a.student_id, a.score, a.passed, a.time_spent_seconds, a.submitted_at,
            s.display_name AS student, s.email,
            (SELECT COUNT(*) FROM exam_attempts a2
               WHERE a2.exam_id = a.exam_id AND a2.student_id = a.student_id AND a2.submitted_at IS NOT NULL) AS attempts,
            COALESCE((SELECT g.extra_attempts FROM exam_attempt_grants g
               WHERE g.exam_id = a.exam_id AND g.student_id = a.student_id), 0) AS extra_attempts
     FROM exam_attempts a JOIN students s ON s.id = a.student_id
     WHERE a.exam_id = $1 AND a.submitted_at IS NOT NULL
     ORDER BY a.submitted_at DESC`,
    [req.params.examId],
  );
  res.json({ attempts: rows });
}

// POST /api/courses/:id/exams/:examId/students/:studentId/otra-oportunidad
// Concede UN intento extra al alumno en este examen (p. ej. si lo envió por
// error). No borra su historial; según la política de nota (mejor/último) el
// nuevo intento contará como corresponda.
export async function grantExtraAttempt(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const enr = await query('SELECT 1 FROM students WHERE id = $1', [req.params.studentId]);
  if (enr.rows.length === 0) throw notFound('Alumno no encontrado');
  const { rows } = await query<{ extra_attempts: number }>(
    `INSERT INTO exam_attempt_grants (exam_id, student_id, extra_attempts, granted_by)
     VALUES ($1, $2, 1, $3)
     ON CONFLICT (exam_id, student_id)
     DO UPDATE SET extra_attempts = exam_attempt_grants.extra_attempts + 1, granted_by = $3, granted_at = NOW()
     RETURNING extra_attempts`,
    [req.params.examId, req.params.studentId, req.auth!.sub],
  );
  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'EXAM_GRANT_ATTEMPT', entity: 'exam', entityId: req.params.examId, ip: clientIp(req) });
  res.json({ extraAttempts: rows[0].extra_attempts });
}

// GET /api/courses/:id/exams/:examId/attempts/:attemptId/abiertas
// Devuelve las respuestas ABIERTAS de un intento para que el profesor las corrija.
export async function getAttemptOpenAnswers(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const att = await query<{ id: string; answers: Record<string, unknown> | null; served_questions: string[] | null; score: number | null; passed: boolean | null; student: string }>(
    `SELECT a.id, a.answers, a.served_questions, a.score, a.passed, s.display_name AS student
       FROM exam_attempts a JOIN students s ON s.id = a.student_id
      WHERE a.id = $1 AND a.exam_id = $2`,
    [req.params.attemptId, req.params.examId],
  );
  if (att.rows.length === 0) throw notFound('Intento no encontrado');
  const served = att.rows[0].served_questions;
  const qs = await query<{ id: string; text: string }>(
    `SELECT id, text FROM exam_questions
      WHERE exam_id = $1 AND format = 'abierta'
      ${served && served.length > 0 ? 'AND id = ANY($2)' : ''} ORDER BY sort_order`,
    served && served.length > 0 ? [req.params.examId, served] : [req.params.examId],
  );
  const g = await query<{ question_id: string; points: string; comment: string | null }>(
    'SELECT question_id, points, comment FROM exam_open_grades WHERE attempt_id = $1', [req.params.attemptId],
  );
  const gradeByQ = new Map(g.rows.map((r) => [r.question_id, r]));
  const answers = att.rows[0].answers ?? {};
  res.json({
    student: att.rows[0].student, score: att.rows[0].score, passed: att.rows[0].passed,
    abiertas: qs.rows.map((q) => ({
      questionId: q.id, text: q.text,
      answer: typeof answers[q.id] === 'string' ? (answers[q.id] as string) : '',
      points: gradeByQ.has(q.id) ? Number(gradeByQ.get(q.id)!.points) : null,
      comment: gradeByQ.get(q.id)?.comment ?? '',
    })),
  });
}

// PUT /api/courses/:id/exams/:examId/attempts/:attemptId/abiertas
// Guarda las notas de las abiertas y RECALCULA la nota del intento.
export async function gradeAttemptOpenAnswers(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const { grades } = z.object({
    grades: z.array(z.object({ questionId: z.string().uuid(), points: z.number().min(0).max(1), comment: z.string().max(2000).optional() })),
  }).parse(req.body);

  const att = await query<{ auto_correct: number | null; auto_total: number | null; served_questions: string[] | null }>(
    'SELECT auto_correct, auto_total, served_questions FROM exam_attempts WHERE id = $1 AND exam_id = $2',
    [req.params.attemptId, req.params.examId],
  );
  if (att.rows.length === 0) throw notFound('Intento no encontrado');

  await withTransaction(async (client) => {
    for (const g of grades) {
      await client.query(
        `INSERT INTO exam_open_grades (attempt_id, question_id, points, comment, graded_by)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (attempt_id, question_id) DO UPDATE SET points = EXCLUDED.points, comment = EXCLUDED.comment, graded_by = EXCLUDED.graded_by, graded_at = NOW()`,
        [req.params.attemptId, g.questionId, g.points, g.comment ?? null, req.auth!.sub],
      );
    }
  });

  // Recalcular: auto (ya guardado) + puntos de abiertas, sobre auto_total + nº abiertas.
  const served = att.rows[0].served_questions;
  const nAbiertas = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM exam_questions WHERE exam_id = $1 AND format = 'abierta'
      ${served && served.length > 0 ? 'AND id = ANY($2)' : ''}`,
    served && served.length > 0 ? [req.params.examId, served] : [req.params.examId],
  );
  const suma = await query<{ s: string | null }>('SELECT SUM(points) AS s FROM exam_open_grades WHERE attempt_id = $1', [req.params.attemptId]);
  const autoTotal = att.rows[0].auto_total ?? 0;
  const autoCorrect = att.rows[0].auto_correct ?? 0;
  const openCount = nAbiertas.rows[0].n;
  const openPoints = Number(suma.rows[0].s ?? 0);
  const denom = autoTotal + openCount;
  const score = denom > 0 ? Math.round(((autoCorrect + openPoints) / denom) * 100) : null;

  const exam = await query<{ pass_pct: number }>('SELECT pass_pct FROM exams WHERE id = $1', [req.params.examId]);
  const passed = score !== null ? score >= exam.rows[0].pass_pct : null;
  await query('UPDATE exam_attempts SET score = $1, passed = $2 WHERE id = $3', [score, passed, req.params.attemptId]);

  // Reflejar el resultado en la finalización de la actividad del examen.
  const act = await query<{ id: string; student_id: string }>(
    'SELECT a.id, ea.student_id FROM activities a, exam_attempts ea WHERE a.exam_id = $1 AND ea.id = $2', [req.params.examId, req.params.attemptId],
  );
  if (act.rows.length > 0) {
    const { id: activityId, student_id } = act.rows[0];
    if (passed) {
      await query('INSERT INTO activity_completions (student_id, activity_id) VALUES ($1, $2) ON CONFLICT (student_id, activity_id) DO NOTHING', [student_id, activityId]).catch(() => {});
    } else {
      await query('DELETE FROM activity_completions WHERE student_id = $1 AND activity_id = $2', [student_id, activityId]).catch(() => {});
    }
  }
  res.json({ score, passed });
}

// Tipos de una pregunta de opinión de escala o de selección múltiple (encuesta).
type OpQ = { id: string; text: string; format: string; options: unknown };

/** Calcula la estadística de una pregunta de opinión sobre un conjunto de
 *  respuestas (answers de los intentos). Devuelve null si la pregunta puntúa
 *  (una múltiple con opción correcta no es de opinión). */
function computarOpinion(q: OpQ, respuestas: Array<Record<string, unknown>>) {
  if (q.format === 'escala') {
    const labels = Array.isArray(q.options) ? (q.options as string[]) : [];
    const dist = [0, 0, 0, 0, 0]; let n = 0; let sum = 0;
    for (const ans of respuestas) {
      const v = ans[q.id];
      if (typeof v === 'number' && v >= 1 && v <= 5) { dist[v - 1] += 1; n += 1; sum += v; }
    }
    return { id: q.id, text: q.text, format: 'escala', etiquetaMin: labels[0] ?? '1', etiquetaMax: labels[1] ?? '5', dist, n, media: n ? Math.round((sum / n) * 100) / 100 : null };
  }
  // multiple: solo cuenta como opinión si NINGUNA opción es correcta (encuesta).
  const opts = Array.isArray(q.options) ? (q.options as Array<{ text: string; correct?: boolean }>) : [];
  if (opts.some((o) => o && o.correct)) return null;
  const counts = opts.map(() => 0); let n = 0;
  for (const ans of respuestas) {
    const v = ans[q.id];
    if (Array.isArray(v)) { n += 1; for (const idx of v) { const k = Number(idx); if (counts[k] != null) counts[k] += 1; } }
  }
  return { id: q.id, text: q.text, format: 'multiple', opciones: opts.map((o, i) => ({ text: o.text, count: counts[i] })), n };
}

// GET /api/courses/:id/exams/:examId/opinion — estadística de las preguntas de
// opinión (escala 1-5 y selección múltiple sin correctas), para perfilar/mejorar.
export async function examOpinionStats(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const qs = await query<OpQ>(
    "SELECT id, text, format, options FROM exam_questions WHERE exam_id = $1 AND format IN ('escala','multiple') ORDER BY sort_order",
    [req.params.examId],
  );
  const att = await query<{ answers: Record<string, unknown> | null }>(
    'SELECT answers FROM exam_attempts WHERE exam_id = $1 AND submitted_at IS NOT NULL', [req.params.examId],
  );
  const respuestas = att.rows.map((a) => a.answers ?? {});
  const preguntas = qs.rows.map((q) => computarOpinion(q, respuestas)).filter(Boolean);
  res.json({ preguntas });
}

// GET /api/courses/:id/opinion — estadística de opinión de TODO el curso, agrupada
// por examen, para verla de un vistazo en el Resumen del curso.
export async function courseOpinionStats(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const id = req.params.id;
  if (req.auth!.role !== 'super_admin' && req.auth!.role !== 'auditor') {
    const staff = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [id, req.auth!.sub]);
    if (staff.rows.length === 0) throw forbidden('No formas parte de este curso');
  }
  const qs = await query<OpQ & { exam_id: string; exam_title: string }>(
    `SELECT q.id, q.text, q.format, q.options, e.id AS exam_id, e.title AS exam_title
       FROM exam_questions q
       JOIN exams e ON e.id = q.exam_id
       JOIN modules m ON m.id = e.module_id
      WHERE m.course_id = $1 AND q.format IN ('escala','multiple')
      ORDER BY e.title, q.sort_order`,
    [id],
  );
  const att = await query<{ exam_id: string; answers: Record<string, unknown> | null }>(
    `SELECT a.exam_id, a.answers FROM exam_attempts a
       JOIN exams e ON e.id = a.exam_id
       JOIN modules m ON m.id = e.module_id
      WHERE m.course_id = $1 AND a.submitted_at IS NOT NULL`,
    [id],
  );
  // Respuestas agrupadas por examen (cada pregunta se mide sobre las de SU examen).
  const porExamen = new Map<string, Array<Record<string, unknown>>>();
  for (const a of att.rows) {
    const arr = porExamen.get(a.exam_id) ?? [];
    arr.push(a.answers ?? {});
    porExamen.set(a.exam_id, arr);
  }
  const examenes: Array<{ examId: string; examTitle: string; preguntas: unknown[] }> = [];
  for (const q of qs.rows) {
    const stat = computarOpinion(q, porExamen.get(q.exam_id) ?? []);
    if (!stat) continue;
    let g = examenes.find((x) => x.examId === q.exam_id);
    if (!g) { g = { examId: q.exam_id, examTitle: q.exam_title, preguntas: [] }; examenes.push(g); }
    g.preguntas.push(stat);
  }
  res.json({ examenes });
}

/**
 * Copia preguntas de un banco al examen. Sirve para reutilizar cualquier banco
 * PÚBLICO como fuente sin poder descargarlo: las preguntas se copian dentro del
 * examen del curso, no se entrega el banco.
 */
export async function addExamQuestionsFromBank(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { bankId, tema, count } = z.object({
    bankId: z.string().uuid(),
    tema: z.string().max(160).optional(),
    count: z.number().int().min(1).max(200),
  }).parse(req.body);

  const exam = await query('SELECT 1 FROM exams e JOIN modules m ON m.id = e.module_id WHERE e.id = $1 AND m.course_id = $2',
    [req.params.examId, req.params.id]);
  if (exam.rows.length === 0) throw notFound('Examen no encontrado');

  // Solo bancos propios o públicos.
  const bank = await query<{ visibility: string; created_by: string | null }>(
    'SELECT visibility, created_by FROM question_banks WHERE id = $1', [bankId],
  );
  if (bank.rows.length === 0) throw notFound('Banco no encontrado');
  if (req.auth!.role !== 'super_admin' && bank.rows[0].visibility !== 'publico' && bank.rows[0].created_by !== req.auth!.sub) {
    // Puede ser un banco restringido compartido con este profesor.
    const acc = await query('SELECT 1 FROM bank_access WHERE bank_id = $1 AND user_id = $2', [bankId, req.auth!.sub]);
    if (acc.rows.length === 0) throw forbidden('No puedes usar ese banco');
  }

  const qs = await query<{ text: string; options: string[]; correct_index: number; video_url: string | null; image_key: string | null; explanation: string | null }>(
    `SELECT text, options, correct_index, video_url, image_key, explanation FROM questions
      WHERE bank_id = $1 AND is_active = TRUE ${tema ? 'AND tema = $3' : ''}
      ORDER BY RANDOM() LIMIT $2`,
    tema ? [bankId, count, tema] : [bankId, count],
  );
  if (qs.rows.length === 0) throw badRequest('No hay preguntas con ese criterio', 'NO_QUESTIONS');

  let added = 0;
  for (const q of qs.rows) {
    await query(
      `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, video_url, image_key, explanation, sort_order)
       VALUES ($1, 'test', $2, $3::jsonb, $4, $5, $6, $7,
               COALESCE((SELECT MAX(sort_order) + 1 FROM exam_questions WHERE exam_id = $1), 0))`,
      [req.params.examId, q.text, JSON.stringify(q.options), q.correct_index, q.video_url, q.image_key, q.explanation],
    );
    added += 1;
  }
  res.status(201).json({ added });
}

/**
 * Importa preguntas CONCRETAS de un banco (las que el autor marca), no al azar.
 * Copia también imagen y vídeo. Mismo criterio de permiso que desde-banco.
 */
export async function addExamQuestionsFromBankByIds(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { bankId, questionIds } = z.object({
    bankId: z.string().uuid(),
    questionIds: z.array(z.string().uuid()).min(1).max(300),
  }).parse(req.body);

  const exam = await query('SELECT 1 FROM exams e JOIN modules m ON m.id = e.module_id WHERE e.id = $1 AND m.course_id = $2',
    [req.params.examId, req.params.id]);
  if (exam.rows.length === 0) throw notFound('Examen no encontrado');

  const bank = await query<{ visibility: string; created_by: string | null }>(
    'SELECT visibility, created_by FROM question_banks WHERE id = $1', [bankId],
  );
  if (bank.rows.length === 0) throw notFound('Banco no encontrado');
  if (req.auth!.role !== 'super_admin' && bank.rows[0].visibility !== 'publico' && bank.rows[0].created_by !== req.auth!.sub) {
    const acc = await query('SELECT 1 FROM bank_access WHERE bank_id = $1 AND user_id = $2', [bankId, req.auth!.sub]);
    if (acc.rows.length === 0) throw forbidden('No puedes usar ese banco');
  }

  const qs = await query<{ text: string; options: string[]; correct_index: number; video_url: string | null; image_key: string | null; explanation: string | null }>(
    `SELECT text, options, correct_index, video_url, image_key, explanation FROM questions
      WHERE bank_id = $1 AND is_active = TRUE AND id = ANY($2::uuid[])`,
    [bankId, questionIds],
  );
  if (qs.rows.length === 0) throw badRequest('Ninguna de las preguntas elegidas está disponible', 'NO_QUESTIONS');

  let added = 0;
  for (const q of qs.rows) {
    await query(
      `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, video_url, image_key, explanation, sort_order)
       VALUES ($1, 'test', $2, $3::jsonb, $4, $5, $6, $7,
               COALESCE((SELECT MAX(sort_order) + 1 FROM exam_questions WHERE exam_id = $1), 0))`,
      [req.params.examId, q.text, JSON.stringify(q.options), q.correct_index, q.video_url, q.image_key, q.explanation],
    );
    added += 1;
  }
  res.status(201).json({ added });
}

// ---------------------------------------------------------------------------
// Asistente de creación de exámenes
// ---------------------------------------------------------------------------

/** Minutos sugeridos para responder N preguntas (1,5 min por pregunta). */
export function suggestedMinutes(nQuestions: number): number {
  return Math.max(5, Math.ceil((nQuestions * 1.5) / 5) * 5); // redondeado a múltiplos de 5
}

/**
 * POST /api/banks/availability — cuántas preguntas hay disponibles en los
 * bancos elegidos, en total y por tema. Evita configurar un examen de 50
 * preguntas cuando solo hay 30.
 */
export async function bankAvailability(req: Request, res: Response): Promise<void> {
  const { bankIds } = z.object({ bankIds: z.array(z.string().uuid()).min(1) }).parse(req.body);

  // Solo bancos propios o públicos (el super_admin ve todos).
  const allowed = await query<{ id: string }>(
    `SELECT id FROM question_banks
      WHERE id = ANY($1) AND ($2::boolean OR visibility = 'publico' OR created_by = $3
        OR EXISTS (SELECT 1 FROM bank_access ba WHERE ba.bank_id = question_banks.id AND ba.user_id = $3))`,
    [bankIds, req.auth!.role === 'super_admin', req.auth!.sub],
  );
  const ids = allowed.rows.map((r) => r.id);
  if (ids.length === 0) { res.json({ total: 0, porTema: [] }); return; }

  const [tot, temas] = await Promise.all([
    query<{ n: string }>('SELECT COUNT(*) AS n FROM questions WHERE bank_id = ANY($1) AND is_active = TRUE', [ids]),
    query<{ tema: string; n: string }>(
      `SELECT COALESCE(tema, '(sin tema)') AS tema, COUNT(*) AS n
         FROM questions WHERE bank_id = ANY($1) AND is_active = TRUE
        GROUP BY tema ORDER BY tema`,
      [ids],
    ),
  ]);
  const total = Number(tot.rows[0].n);
  res.json({
    total,
    porTema: temas.rows.map((t) => ({ tema: t.tema, disponibles: Number(t.n) })),
    sugerencia: { minutosPara: (n: number) => n }, // el cálculo real lo hace el asistente
  });
}

const wizardSchema = z.object({
  title: z.string().min(2).max(200),
  kind: z.enum(['test', 'examen']).default('test'),
  bankIds: z.array(z.string().uuid()).min(1, 'Elige al menos un banco'),
  mode: z.enum(['aleatorio', 'temas']).default('aleatorio'),
  count: z.number().int().min(1).max(200).optional(),
  porTema: z.array(z.object({ tema: z.string().min(1), count: z.number().int().min(1).max(200) })).optional(),
  timeLimitMin: z.number().int().min(1).max(600).nullable().optional(),
  passPct: z.number().int().min(0).max(100).default(60),
  attemptsAllowed: z.number().int().min(1).max(10).default(1),
  shuffle: z.boolean().optional().default(true),
  // Opcional: cada alumno recibe N preguntas distintas del conjunto.
  randomPerStudent: z.boolean().optional().default(false),
  questionsPerAttempt: z.number().int().min(1).max(200).nullable().optional(),
});

/** Crea el examen y lo llena de preguntas en un solo paso. */
export async function createExamWizard(req: Request, res: Response): Promise<void> {
  await assertEditaModulo(req, req.params.moduleId);
  const d = wizardSchema.parse(req.body);

  const mod = await query('SELECT 1 FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  if (mod.rows.length === 0) throw notFound('Módulo no encontrado');

  // Bancos permitidos (propios o públicos).
  const allowed = await query<{ id: string }>(
    `SELECT id FROM question_banks
      WHERE id = ANY($1) AND ($2::boolean OR visibility = 'publico' OR created_by = $3
        OR EXISTS (SELECT 1 FROM bank_access ba WHERE ba.bank_id = question_banks.id AND ba.user_id = $3))`,
    [d.bankIds, req.auth!.role === 'super_admin', req.auth!.sub],
  );
  const ids = allowed.rows.map((r) => r.id);
  if (ids.length === 0) throw badRequest('No puedes usar esos bancos', 'BAD_BANKS');

  // Selección de preguntas: aleatoria del conjunto, o por temas con su cupo.
  type Q = { text: string; options: string[]; correct_index: number; video_url: string | null; image_key: string | null; explanation: string | null };
  let picked: Q[] = [];
  if (d.mode === 'temas') {
    if (!d.porTema?.length) throw badRequest('Indica cuántas preguntas quieres de cada tema', 'NO_TEMAS');
    for (const t of d.porTema) {
      const r = await query<Q>(
        `SELECT text, options, correct_index, video_url, image_key, explanation FROM questions
          WHERE bank_id = ANY($1) AND is_active = TRUE AND COALESCE(tema,'(sin tema)') = $2
          ORDER BY RANDOM() LIMIT $3`,
        [ids, t.tema, t.count],
      );
      if (r.rows.length < t.count) {
        throw badRequest(`El tema «${t.tema}» solo tiene ${r.rows.length} pregunta(s) disponibles y pediste ${t.count}`, 'NOT_ENOUGH');
      }
      picked = picked.concat(r.rows);
    }
  } else {
    const count = d.count ?? 10;
    const r = await query<Q>(
      `SELECT text, options, correct_index, video_url, image_key, explanation FROM questions
        WHERE bank_id = ANY($1) AND is_active = TRUE ORDER BY RANDOM() LIMIT $2`,
      [ids, count],
    );
    if (r.rows.length < count) {
      throw badRequest(`Los bancos elegidos solo tienen ${r.rows.length} pregunta(s) y pediste ${count}`, 'NOT_ENOUGH');
    }
    picked = r.rows;
  }

  const minutos = d.timeLimitMin === undefined ? suggestedMinutes(picked.length) : d.timeLimitMin;

  const exam = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO exams (module_id, title, kind, attempts_allowed, pass_pct, time_limit_min, shuffle, random_per_student, questions_per_attempt)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, title, kind, attempts_allowed, pass_pct, time_limit_min, shuffle, random_per_student, questions_per_attempt`,
      [req.params.moduleId, d.title, d.kind, d.attemptsAllowed, d.passPct, minutos, d.shuffle,
       d.randomPerStudent ?? false, d.randomPerStudent ? (d.questionsPerAttempt ?? null) : null],
    );
    const created = rows[0];
    await client.query(
      `INSERT INTO activities (module_id, type, title, exam_id, sort_order)
       VALUES ($1, $2, $3, $4, COALESCE((SELECT MAX(sort_order)+1 FROM activities WHERE module_id=$1),0))`,
      [req.params.moduleId, d.kind, d.title, created.id],
    );
    let i = 0;
    for (const q of picked) {
      await client.query(
        `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, video_url, image_key, explanation, sort_order)
         VALUES ($1,'test',$2,$3::jsonb,$4,$5,$6,$7,$8)`,
        [created.id, q.text, JSON.stringify(q.options), q.correct_index, q.video_url, q.image_key, q.explanation, i++],
      );
    }
    return created;
  });

  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'EXAM_WIZARD', entity: 'exam', entityId: exam.id, ip: clientIp(req), metadata: { preguntas: picked.length } });
  res.status(201).json({ exam, preguntas: picked.length, minutosSugeridos: suggestedMinutes(picked.length) });
}

/**
 * Añade una pregunta CON IMAGEN (multipart). La imagen va a R2 y la pregunta
 * sigue siendo de tipo test o V/F: el alumno responde a partir de lo que ve.
 */
export async function addExamQuestionWithImage(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');

  const format = String(req.body.format ?? 'test');
  if (format !== 'test' && format !== 'vf') throw badRequest('Una pregunta con imagen debe ser tipo test o V/F', 'BAD_FORMAT');
  const text = String(req.body.text ?? '').trim();
  if (text.length < 3) throw badRequest('Escribe el enunciado', 'NO_TEXT');

  let options: string[] = [];
  const marcada = Number(req.body.correctIndex);
  let correctIndex = marcada;
  if (format === 'vf') {
    options = ['Verdadero', 'Falso'];
    if (marcada !== 0 && marcada !== 1) throw badRequest('Indica si es Verdadero o Falso', 'BAD_VF');
  } else {
    let brutas: string[] = [];
    try { brutas = JSON.parse(String(req.body.options ?? '[]')); } catch { brutas = []; }
    ({ options, correctIndex } = opcionesDepuradas(brutas, Number.isInteger(marcada) ? marcada : undefined));
  }

  const key = buildKey(file.originalname, 'exam-questions');
  await uploadObject(key, file.buffer, file.mimetype);

  const { rows } = await query<{ id: string; image_key: string }>(
    `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, image_key, sort_order)
     VALUES ($1,$2,$3,$4::jsonb,$5,$6, COALESCE((SELECT MAX(sort_order)+1 FROM exam_questions WHERE exam_id=$1),0))
     RETURNING id, format, text, options, correct_index, image_key`,
    [req.params.examId, format, text, JSON.stringify(options), correctIndex, key],
  );
  res.status(201).json({ question: (await withImageUrls(rows))[0] });
}
