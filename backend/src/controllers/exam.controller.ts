import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
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

// ---------------------------------------------------------------------------
// Bulk import of exam questions (JSON)
// ---------------------------------------------------------------------------
function normFmt(v: unknown): 'test' | 'vf' | 'abierta' | null {
  const s = String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  if (['test', 'opcion_multiple', 'multiple', 'opciones'].includes(s)) return 'test';
  if (['vf', 'verdadero_falso', 'verdadero/falso', 'verdaderofalso', 'v/f', 'vof'].includes(s)) return 'vf';
  if (['abierta', 'libre', 'texto'].includes(s)) return 'abierta';
  return null;
}
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? '').split(/[|;]/).map((x) => x.trim()).filter(Boolean);
}
function resolveCorrect(v: unknown, n: number): number | null {
  const s = String(v ?? '').trim().toUpperCase();
  const letter = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }[s as 'A'];
  if (letter !== undefined && letter < n) return letter;
  const num = parseInt(s, 10);
  if (Number.isInteger(num) && num >= 1 && num <= n) return num - 1;
  return null;
}
function resolveVF(v: unknown): number | null {
  const s = String(v ?? '').trim().toLowerCase();
  if (['v', 'verdadero', 'true', 'si', 'sí', '1', '0-verdadero'].includes(s) || v === true || v === 0) return 0;
  if (['f', 'falso', 'false', 'no', '2'].includes(s) || v === false || v === 1) return 1;
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
      options = toList(q.options ?? q.opciones);
      if (options.length < 2) errs.push('faltan opciones (mínimo 2)');
      const ci = resolveCorrect(q.correcta ?? q.correct, options.length);
      if (ci === null) errs.push('correcta inválida (A/B/C/D o número)');
      else correctIndex = ci;
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
    `SELECT a.id, a.score, a.passed, a.time_spent_seconds, a.submitted_at,
            s.display_name AS student, s.email,
            (SELECT COUNT(*) FROM exam_attempts a2
               WHERE a2.exam_id = a.exam_id AND a2.student_id = a.student_id AND a2.submitted_at IS NOT NULL) AS attempts
     FROM exam_attempts a JOIN students s ON s.id = a.student_id
     WHERE a.exam_id = $1 AND a.submitted_at IS NOT NULL
     ORDER BY a.submitted_at DESC`,
    [req.params.examId],
  );
  res.json({ attempts: rows });
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
    throw forbidden('No puedes usar ese banco');
  }

  const qs = await query<{ text: string; options: string[]; correct_index: number }>(
    `SELECT text, options, correct_index FROM questions
      WHERE bank_id = $1 AND is_active = TRUE ${tema ? 'AND tema = $3' : ''}
      ORDER BY RANDOM() LIMIT $2`,
    tema ? [bankId, count, tema] : [bankId, count],
  );
  if (qs.rows.length === 0) throw badRequest('No hay preguntas con ese criterio', 'NO_QUESTIONS');

  let added = 0;
  for (const q of qs.rows) {
    await query(
      `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, sort_order)
       VALUES ($1, 'test', $2, $3::jsonb, $4,
               COALESCE((SELECT MAX(sort_order) + 1 FROM exam_questions WHERE exam_id = $1), 0))`,
      [req.params.examId, q.text, JSON.stringify(q.options), q.correct_index],
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
      WHERE id = ANY($1) AND ($2::boolean OR visibility = 'publico' OR created_by = $3)`,
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
});

/** Crea el examen y lo llena de preguntas en un solo paso. */
export async function createExamWizard(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = wizardSchema.parse(req.body);

  const mod = await query('SELECT 1 FROM modules WHERE id = $1 AND course_id = $2', [req.params.moduleId, req.params.id]);
  if (mod.rows.length === 0) throw notFound('Módulo no encontrado');

  // Bancos permitidos (propios o públicos).
  const allowed = await query<{ id: string }>(
    `SELECT id FROM question_banks
      WHERE id = ANY($1) AND ($2::boolean OR visibility = 'publico' OR created_by = $3)`,
    [d.bankIds, req.auth!.role === 'super_admin', req.auth!.sub],
  );
  const ids = allowed.rows.map((r) => r.id);
  if (ids.length === 0) throw badRequest('No puedes usar esos bancos', 'BAD_BANKS');

  // Selección de preguntas: aleatoria del conjunto, o por temas con su cupo.
  type Q = { text: string; options: string[]; correct_index: number; video_url: string | null; image_key: string | null };
  let picked: Q[] = [];
  if (d.mode === 'temas') {
    if (!d.porTema?.length) throw badRequest('Indica cuántas preguntas quieres de cada tema', 'NO_TEMAS');
    for (const t of d.porTema) {
      const r = await query<Q>(
        `SELECT text, options, correct_index, video_url, image_key FROM questions
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
      `SELECT text, options, correct_index, video_url, image_key FROM questions
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
      `INSERT INTO exams (module_id, title, kind, attempts_allowed, pass_pct, time_limit_min, shuffle)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, title, kind, attempts_allowed, pass_pct, time_limit_min, shuffle`,
      [req.params.moduleId, d.title, d.kind, d.attemptsAllowed, d.passPct, minutos, d.shuffle],
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
        `INSERT INTO exam_questions (exam_id, format, text, options, correct_index, video_url, image_key, sort_order)
         VALUES ($1,'test',$2,$3::jsonb,$4,$5,$6,$7)`,
        [created.id, q.text, JSON.stringify(q.options), q.correct_index, q.video_url, q.image_key, i++],
      );
    }
    return created;
  });

  await audit({ actorId: req.auth!.sub, actorType: req.auth!.role, action: 'EXAM_WIZARD', entity: 'exam', entityId: exam.id, ip: clientIp(req), metadata: { preguntas: picked.length } });
  res.status(201).json({ exam, preguntas: picked.length, minutosSugeridos: suggestedMinutes(picked.length) });
}
