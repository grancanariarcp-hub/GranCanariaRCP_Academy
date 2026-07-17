import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

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
    `SELECT e.id, e.title, e.attempts_allowed, e.pass_pct, e.time_limit_min, m.course_id
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
  if ((await submittedCount(exam.id, req.auth!.sub)) >= exam.attempts_allowed) {
    throw badRequest('Has agotado los intentos de este examen', 'NO_ATTEMPTS');
  }
  const att = await query<{ id: string; started_at: string }>(
    'INSERT INTO exam_attempts (exam_id, student_id) VALUES ($1, $2) RETURNING id, started_at',
    [exam.id, req.auth!.sub],
  );
  // Questions WITHOUT the correct answer.
  const q = await query('SELECT id, format, text, options FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order', [exam.id]);
  res.status(201).json({
    attemptId: att.rows[0].id,
    startedAt: att.rows[0].started_at,
    exam: { title: exam.title, timeLimitMin: exam.time_limit_min, passPct: exam.pass_pct },
    questions: q.rows,
  });
}

// POST /api/student/exams/:examId/attempts/:attemptId/submit
export async function submitExam(req: Request, res: Response): Promise<void> {
  const exam = await examForStudent(req.params.examId, req.auth!.sub);
  const att = await query<{ started_at: string; submitted_at: string | null }>(
    'SELECT started_at, submitted_at FROM exam_attempts WHERE id = $1 AND exam_id = $2 AND student_id = $3',
    [req.params.attemptId, exam.id, req.auth!.sub],
  );
  if (att.rows.length === 0) throw notFound('Intento no encontrado');
  if (att.rows[0].submitted_at) throw badRequest('Este intento ya fue enviado', 'ALREADY_SUBMITTED');

  const answers = z.record(z.union([z.number(), z.string()])).parse(req.body.answers ?? {});
  const q = await query<{ id: string; format: string; correct_index: number | null }>(
    'SELECT id, format, correct_index FROM exam_questions WHERE exam_id = $1',
    [exam.id],
  );

  let autoTotal = 0;
  let autoCorrect = 0;
  for (const question of q.rows) {
    if (question.format === 'abierta') continue;
    autoTotal += 1;
    const a = answers[question.id];
    if (typeof a === 'number' && a === question.correct_index) autoCorrect += 1;
  }
  const score = autoTotal > 0 ? Math.round((autoCorrect / autoTotal) * 100) : null;
  const passed = score !== null ? score >= exam.pass_pct : null;
  const timeSpent = Math.max(0, Math.round((Date.now() - new Date(att.rows[0].started_at).getTime()) / 1000));

  await query(
    `UPDATE exam_attempts SET submitted_at = NOW(), score = $1, passed = $2, time_spent_seconds = $3,
       answers = $4::jsonb, auto_total = $5, auto_correct = $6 WHERE id = $7`,
    [score, passed, timeSpent, JSON.stringify(answers), autoTotal, autoCorrect, req.params.attemptId],
  );
  await audit({ actorId: req.auth!.sub, actorType: 'student', action: 'EXAM_SUBMIT', entity: 'exam', entityId: exam.id, ip: clientIp(req), metadata: { score, passed } });

  res.json({ score, passed, autoCorrect, autoTotal, hasOpen: q.rows.some((x) => x.format === 'abierta') });
}

// GET /api/student/exams/:examId/attempts/:attemptId  — free review with feedback
export async function reviewAttempt(req: Request, res: Response): Promise<void> {
  const exam = await examForStudent(req.params.examId, req.auth!.sub);
  const att = await query(
    'SELECT id, answers, score, passed, submitted_at, time_spent_seconds FROM exam_attempts WHERE id = $1 AND exam_id = $2 AND student_id = $3',
    [req.params.attemptId, exam.id, req.auth!.sub],
  );
  if (att.rows.length === 0 || !att.rows[0].submitted_at) throw notFound('Intento no encontrado');
  const q = await query('SELECT id, format, text, options, correct_index FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order', [exam.id]);
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
