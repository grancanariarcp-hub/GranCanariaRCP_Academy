import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { assertEditor } from '../services/courseAuth.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

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
  await assertEditor(req);
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
  const exam = await query('SELECT id, title, kind, attempts_allowed, pass_pct, time_limit_min FROM exams WHERE id = $1', [req.params.examId]);
  const questions = await query(
    'SELECT id, format, text, options, correct_index, sort_order FROM exam_questions WHERE exam_id = $1 ORDER BY sort_order',
    [req.params.examId],
  );
  res.json({ exam: exam.rows[0], questions: questions.rows });
}

// ---------------------------------------------------------------------------
// Update exam config
// ---------------------------------------------------------------------------
const updateExamSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  attemptsAllowed: z.number().int().min(1).max(50).optional(),
  passPct: z.number().int().min(0).max(100).optional(),
  timeLimitMin: z.number().int().min(1).max(600).nullable().optional(),
});

export async function updateExam(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const d = updateExamSchema.parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title, attempts_allowed: d.attemptsAllowed, pass_pct: d.passPct, time_limit_min: d.timeLimitMin,
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val); fields.push(`${col} = $${params.length}`); }
  }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.examId);
  const { rows } = await query(`UPDATE exams SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, title, attempts_allowed, pass_pct, time_limit_min`, params);
  res.json({ exam: rows[0] });
}

// ---------------------------------------------------------------------------
// Add / delete questions (test / verdadero-falso / abierta)
// ---------------------------------------------------------------------------
const addQuestionSchema = z.object({
  format: z.enum(['test', 'vf', 'abierta']),
  text: z.string().min(3),
  options: z.array(z.string().min(1)).optional(),
  correctIndex: z.number().int().min(0).optional(),
});

export async function addExamQuestion(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  const d = addQuestionSchema.parse(req.body);

  let options: string[] = [];
  let correctIndex: number | null = null;

  if (d.format === 'test') {
    options = (d.options ?? []).map((o) => o.trim()).filter(Boolean);
    if (options.length < 2) throw badRequest('Un test necesita al menos 2 opciones', 'FEW_OPTIONS');
    if (d.correctIndex === undefined || d.correctIndex >= options.length) throw badRequest('Marca la opción correcta', 'BAD_CORRECT');
    correctIndex = d.correctIndex;
  } else if (d.format === 'vf') {
    options = ['Verdadero', 'Falso'];
    if (d.correctIndex !== 0 && d.correctIndex !== 1) throw badRequest('Indica si es Verdadero o Falso', 'BAD_VF');
    correctIndex = d.correctIndex;
  } // abierta: sin opciones ni correcta

  const { rows } = await query(
    `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, sort_order)
     VALUES ($1,$2,$3,$4::jsonb,$5, COALESCE((SELECT MAX(sort_order)+1 FROM exam_questions WHERE exam_id=$1),0))
     RETURNING id, format, text, options, correct_index`,
    [req.params.examId, d.format, d.text.trim(), JSON.stringify(options), correctIndex],
  );
  res.status(201).json({ question: rows[0] });
}

export async function deleteExamQuestion(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await assertExamInCourse(req.params.examId, req.params.id);
  await query('DELETE FROM exam_questions WHERE id = $1 AND exam_id = $2', [req.params.questionId, req.params.examId]);
  res.json({ ok: true });
}
