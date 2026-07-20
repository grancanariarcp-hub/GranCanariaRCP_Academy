import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { hasAnsweredSurvey } from '../services/surveyGate.js';
import { withImageUrls } from '../services/r2.js';

/** Student side: taking exams. All routes assume role 'student'. */

interface ExamRow {
  id: string;
  title: string;
  attempts_allowed: number;
  pass_pct: number;
  time_limit_min: number | null;
  course_id: string;
}

async function examForStudent(examId: string, studentId: string): Promise<ExamRow> {
  const { rows } = await query<ExamRow>(
    `SELECT e.id, e.title, e.kind, e.attempts_allowed, e.pass_pct, e.time_limit_min, e.shuffle,
            e.random_per_student, e.questions_per_attempt, m.course_id
     FROM exams e JOIN modules m ON m.id = e.module_id
     WHERE e.id = $1`,
    [examId],
  );
  if (rows.length === 0) throw notFound('Examen no encontrado');
  const enr = await query('SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2', [studentId, rows[0].course_id]);
  if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');
  return rows[0];
}

async function submittedCount(examId: string, studentId: string): Promise<number> {
  const { rows } = await query<{ count: string }>(
    'SELECT COUNT(*) FROM exam_attempts WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NOT NULL',
    [examId, studentId],
  );
  return Number(rows[0].count);
}

// POST /api/student/exams/:examId/start
export async function startExam(req: Request, res: Response): Promise<void> {
  const exam = await examForStudent(req.params.examId, req.auth!.sub);
  // El examen FINAL solo se habilita tras responder la encuesta de satisfacción.
  if ((exam as { kind?: string }).kind === 'examen' && !(await hasAnsweredSurvey(exam.course_id, req.auth!.sub))) {
    throw badRequest('Antes de realizar el examen final debes responder la encuesta de satisfacción del curso.', 'SURVEY_REQUIRED');
  }
  // Un intento empezado y sin enviar SE REANUDA, no se sustituye por otro.
  // Antes, «Comenzar» creaba siempre un intento nuevo y solo contaban los
  // enviados: bastaba abrir el examen, leerlo entero, cerrar la pestaña y
  // volver a empezar tantas veces como hiciera falta para memorizar el
  // cuestionario, con el contador siempre a cero. Reanudar cierra ese camino y
  // además es lo que hay que hacer cuando a alguien se le cae la conexión: las
  // mismas preguntas y el mismo reloj, que sigue corriendo desde el principio.
  const abierto = await query<{ id: string; started_at: string; served_questions: string[] | null }>(
    `SELECT id, started_at, served_questions FROM exam_attempts
      WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NULL
      ORDER BY started_at DESC LIMIT 1`,
    [exam.id, req.auth!.sub],
  );
  if (abierto.rows.length > 0) {
    const a = abierto.rows[0];
    const ids = a.served_questions ?? [];
    const q = await query<{ id: string; image_key: string | null }>(
      `SELECT id, format, text, options, video_url, image_key FROM exam_questions
        WHERE exam_id = $1 AND excluded_from_grading = FALSE
          ${ids.length > 0 ? 'AND id = ANY($2)' : ''}
        ORDER BY ${ids.length > 0 ? 'array_position($2, id)' : 'sort_order'}`,
      ids.length > 0 ? [exam.id, ids] : [exam.id],
    );
    res.status(200).json({
      attemptId: a.id,
      startedAt: a.started_at,
      reanudado: true,
      exam: { title: exam.title, timeLimitMin: exam.time_limit_min, passPct: exam.pass_pct },
      questions: await withImageUrls(q.rows),
    });
    return;
  }

  if ((await submittedCount(exam.id, req.auth!.sub)) >= exam.attempts_allowed) {
    throw badRequest('Has agotado los intentos de este examen', 'NO_ATTEMPTS');
  }
  const att = await query<{ id: string; started_at: string }>(
    'INSERT INTO exam_attempts (exam_id, student_id) VALUES ($1, $2) RETURNING id, started_at',
    [exam.id, req.auth!.sub],
  );

  // Preguntas SIN la respuesta correcta.
  //  · shuffle: mismo contenido en distinto orden para cada alumno.
  //  · random_per_student (opcional): además, a cada alumno le tocan N preguntas
  //    distintas sacadas del conjunto. Se guarda cuáles, para corregir sobre esas.
  const e = exam as { shuffle?: boolean; random_per_student?: boolean; questions_per_attempt?: number | null };
  const shuffle = e.shuffle !== false;
  const limit = e.random_per_student && e.questions_per_attempt ? e.questions_per_attempt : null;
  const q = await query<{ id: string; image_key: string | null }>(
    `SELECT id, format, text, options, video_url, image_key FROM exam_questions
      WHERE exam_id = $1 AND excluded_from_grading = FALSE
      ORDER BY ${limit || shuffle ? 'RANDOM()' : 'sort_order'}
      ${limit ? 'LIMIT $2' : ''}`,
    limit ? [exam.id, limit] : [exam.id],
  );
  await query('UPDATE exam_attempts SET served_questions = $1::jsonb WHERE id = $2',
    [JSON.stringify(q.rows.map((x) => x.id)), att.rows[0].id]);
  res.status(201).json({
    attemptId: att.rows[0].id,
    startedAt: att.rows[0].started_at,
    exam: { title: exam.title, timeLimitMin: exam.time_limit_min, passPct: exam.pass_pct },
    questions: await withImageUrls(q.rows),
  });
}

// POST /api/student/exams/:examId/attempts/:attemptId/submit
export async function submitExam(req: Request, res: Response): Promise<void> {
  const exam = await examForStudent(req.params.examId, req.auth!.sub);
  const att = await query<{ started_at: string; submitted_at: string | null; served_questions: string[] | null }>(
    'SELECT started_at, submitted_at, served_questions FROM exam_attempts WHERE id = $1 AND exam_id = $2 AND student_id = $3',
    [req.params.attemptId, exam.id, req.auth!.sub],
  );
  if (att.rows.length === 0) throw notFound('Intento no encontrado');
  if (att.rows[0].submitted_at) throw badRequest('Este intento ya fue enviado', 'ALREADY_SUBMITTED');

  const answers = z.record(z.union([z.number(), z.string()])).parse(req.body.answers ?? {});
  // Se corrige solo sobre las preguntas que le tocaron a ESTE alumno y que no
  // estén anuladas por el profesorado.
  const served = att.rows[0].served_questions;
  const q = await query<{ id: string; format: string; correct_index: number | null }>(
    `SELECT id, format, correct_index FROM exam_questions
      WHERE exam_id = $1 AND excluded_from_grading = FALSE
      ${served && served.length > 0 ? 'AND id = ANY($2)' : ''}`,
    served && served.length > 0 ? [exam.id, served] : [exam.id],
  );

  let autoTotal = 0;
  let autoCorrect = 0;
  for (const question of q.rows) {
    if (question.format === 'abierta') continue;
    autoTotal += 1;
    const a = answers[question.id];
    if (typeof a === 'number' && a === question.correct_index) autoCorrect += 1;
  }
  const timeSpent = Math.max(0, Math.round((Date.now() - new Date(att.rows[0].started_at).getTime()) / 1000));

  // El plazo se comprueba AQUÍ, no solo en el navegador. El temporizador de la
  // pantalla muere al cerrar la pestaña, así que sin esta comprobación bastaba
  // con cerrarla, resolver el examen con calma y entregarlo horas después.
  // Se conceden dos minutos de cortesía por si la conexión falla justo al
  // enviar: castigar un problema de red no es vigilar un examen.
  const CORTESIA_SEG = 120;
  const fueraDePlazo = !!exam.time_limit_min && timeSpent > exam.time_limit_min * 60 + CORTESIA_SEG;

  const score = fueraDePlazo ? 0 : autoTotal > 0 ? Math.round((autoCorrect / autoTotal) * 100) : null;
  const passed = fueraDePlazo ? false : score !== null ? score >= exam.pass_pct : null;

  // El WHERE evita que dos envíos a la vez —dos pestañas, o un reintento tras
  // agotarse la espera— se pisen y acabe contando el último en llegar.
  const upd = await query(
    `UPDATE exam_attempts SET submitted_at = NOW(), score = $1, passed = $2, time_spent_seconds = $3,
       answers = $4::jsonb, auto_total = $5, auto_correct = $6, fuera_de_plazo = $8
     WHERE id = $7 AND submitted_at IS NULL`,
    [score, passed, timeSpent, JSON.stringify(answers), autoTotal, autoCorrect, req.params.attemptId, fueraDePlazo],
  );
  if (upd.rowCount === 0) throw badRequest('Este intento ya fue enviado', 'ALREADY_SUBMITTED');

  if (fueraDePlazo) {
    await audit({ actorId: req.auth!.sub, actorType: 'student', action: 'EXAM_OUT_OF_TIME', entity: 'exam', entityId: exam.id, ip: clientIp(req), metadata: { timeSpent, limite: exam.time_limit_min } });
    throw badRequest(
      `Se agotó el tiempo del examen (${exam.time_limit_min} minutos) y la entrega llegó fuera de plazo, así que el intento queda a cero. ` +
      'Habla con la dirección del curso si crees que se debe a un problema técnico.',
      'FUERA_DE_PLAZO',
    );
  }
  // Al aprobar, la actividad de ese examen queda completada automáticamente.
  if (passed) {
    await query(
      `INSERT INTO activity_completions (student_id, activity_id)
       SELECT $1, a.id FROM activities a WHERE a.exam_id = $2
       ON CONFLICT (student_id, activity_id) DO NOTHING`,
      [req.auth!.sub, exam.id],
    ).catch(() => { /* el progreso no debe romper el envío del examen */ });
  }

  await audit({ actorId: req.auth!.sub, actorType: 'student', action: 'EXAM_SUBMIT', entity: 'exam', entityId: exam.id, ip: clientIp(req), metadata: { score, passed } });

  res.json({ score, passed, autoCorrect, autoTotal, hasOpen: q.rows.some((x) => x.format === 'abierta') });
}

// GET /api/student/exams/:examId/attempts/:attemptId  — free review with feedback
export async function reviewAttempt(req: Request, res: Response): Promise<void> {
  const exam = await examForStudent(req.params.examId, req.auth!.sub);
  const att = await query<{ submitted_at: string | null; served_questions: string[] | null }>(
    `SELECT id, answers, score, passed, submitted_at, time_spent_seconds, served_questions
       FROM exam_attempts WHERE id = $1 AND exam_id = $2 AND student_id = $3`,
    [req.params.attemptId, exam.id, req.auth!.sub],
  );
  if (att.rows.length === 0 || !att.rows[0].submitted_at) throw notFound('Intento no encontrado');

  // Solo las preguntas que le TOCARON, y sin las anuladas. Antes se devolvía el
  // examen entero con su respuesta correcta: en un examen con varios intentos y
  // preguntas repartidas al azar, revisar el primer intento entregaba la
  // plantilla completa y el segundo era un aprobado garantizado.
  const served = att.rows[0].served_questions;
  const p: unknown[] = [exam.id];
  const soloSuyas = served && served.length > 0 ? (p.push(served), `AND id = ANY($${p.length})`) : '';
  const q = await query(
    `SELECT id, format, text, options, correct_index FROM exam_questions
      WHERE exam_id = $1 AND excluded_from_grading = FALSE ${soloSuyas}
      ORDER BY sort_order`,
    p,
  );
  res.json({ attempt: att.rows[0], questions: q.rows });
}

// GET /api/student/exams/:examId/attempts  — my attempts + config
export async function listMyAttempts(req: Request, res: Response): Promise<void> {
  const exam = await examForStudent(req.params.examId, req.auth!.sub);
  const rows = await query(
    `SELECT id, submitted_at, score, passed, time_spent_seconds
     FROM exam_attempts WHERE exam_id = $1 AND student_id = $2 AND submitted_at IS NOT NULL
     ORDER BY submitted_at DESC`,
    [exam.id, req.auth!.sub],
  );
  res.json({
    exam: { title: exam.title, attemptsAllowed: exam.attempts_allowed, passPct: exam.pass_pct, timeLimitMin: exam.time_limit_min },
    used: rows.rows.length,
    attempts: rows.rows,
  });
}
