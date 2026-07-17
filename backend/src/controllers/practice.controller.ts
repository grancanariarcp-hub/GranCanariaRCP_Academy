import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';

/**
 * Generic practice engine over a question bank (RCP now; OPE and others later).
 * Every answered question is written to answer_log, which powers per-user stats:
 * failed pool, times answered, remaining questions, daily progress and accuracy.
 */

const startSchema = z.object({
  mode: z.enum(['aleatorio', 'tema', 'fallos']).default('aleatorio'),
  category: z.string().optional(),
  count: z.number().int().min(1).max(50).default(10),
});

export async function startPractice(req: Request, res: Response): Promise<void> {
  const { mode, category, count } = startSchema.parse(req.body);
  const uid = req.auth!.sub;

  let sql: string;
  let params: unknown[];
  if (mode === 'fallos') {
    sql = `
      WITH latest AS (
        SELECT DISTINCT ON (question_id) question_id, is_correct
        FROM answer_log WHERE user_id = $1 ORDER BY question_id, answered_at DESC
      )
      SELECT q.id, q.category, q.text, q.options
      FROM questions q JOIN latest l ON l.question_id = q.id AND l.is_correct = FALSE
      WHERE q.is_active = TRUE
      ORDER BY RANDOM() LIMIT $2`;
    params = [uid, count];
  } else if (mode === 'tema' && category) {
    sql = 'SELECT id, category, text, options FROM questions WHERE is_active = TRUE AND category = $1 ORDER BY RANDOM() LIMIT $2';
    params = [category, count];
  } else {
    sql = 'SELECT id, category, text, options FROM questions WHERE is_active = TRUE ORDER BY RANDOM() LIMIT $1';
    params = [count];
  }
  const { rows } = await query(sql, params);
  if (rows.length === 0) {
    throw badRequest(mode === 'fallos' ? 'No tienes preguntas falladas (¡bien!)' : 'No hay preguntas disponibles con ese criterio', 'NO_QUESTIONS');
  }
  res.json({ questions: rows });
}

const submitSchema = z.object({ answers: z.record(z.union([z.number(), z.null()])) });

export async function submitPractice(req: Request, res: Response): Promise<void> {
  const { answers } = submitSchema.parse(req.body);
  const uid = req.auth!.sub;
  const ids = Object.keys(answers);
  if (ids.length === 0) throw badRequest('Sin respuestas', 'EMPTY');

  const qs = await query<{ id: string; category: string; correct_index: number; explanation: string | null; ref_page: number | null; bank_id: string | null; document_title: string | null }>(
    `SELECT q.id, q.category, q.correct_index, q.explanation, q.ref_page, q.bank_id, d.title AS document_title
     FROM questions q LEFT JOIN documents d ON d.id = q.ref_document_id
     WHERE q.id = ANY($1)`,
    [ids],
  );

  let correct = 0;
  const feedback = qs.rows.map((q) => {
    const mine = answers[q.id];
    const ok = mine === q.correct_index;
    if (ok) correct += 1;
    return { id: q.id, correct_index: q.correct_index, your: mine, is_correct: ok, explanation: q.explanation, document_title: q.document_title, ref_page: q.ref_page };
  });

  // Write to the stats engine.
  for (const q of qs.rows) {
    await query(
      'INSERT INTO answer_log (user_id, question_id, bank_id, category, is_correct, source) VALUES ($1,$2,$3,$4,$5,$6)',
      [uid, q.id, q.bank_id, q.category, answers[q.id] === q.correct_index, 'practica'],
    );
  }

  res.json({ correct, total: qs.rows.length, feedback });
}

// GET /api/practice/stats
export async function getPracticeStats(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;

  const [failed, totals, daily, bankTotal] = await Promise.all([
    query<{ category: string; count: string }>(
      `WITH latest AS (
         SELECT DISTINCT ON (question_id) question_id, category, is_correct
         FROM answer_log WHERE user_id = $1 ORDER BY question_id, answered_at DESC
       )
       SELECT category, COUNT(*) FROM latest WHERE is_correct = FALSE GROUP BY category ORDER BY COUNT(*) DESC`,
      [uid],
    ),
    query<{ total: string; distinctq: string; correct: string }>(
      `SELECT COUNT(*) AS total, COUNT(DISTINCT question_id) AS distinctq,
              COUNT(*) FILTER (WHERE is_correct) AS correct FROM answer_log WHERE user_id = $1`,
      [uid],
    ),
    query<{ day: string; answered: string; correct: string }>(
      `SELECT to_char(answered_at::date, 'YYYY-MM-DD') AS day, COUNT(*) AS answered,
              COUNT(*) FILTER (WHERE is_correct) AS correct
       FROM answer_log WHERE user_id = $1 AND answered_at > NOW() - INTERVAL '30 days'
       GROUP BY answered_at::date ORDER BY answered_at::date`,
      [uid],
    ),
    query<{ count: string }>('SELECT COUNT(*) FROM questions WHERE is_active = TRUE'),
  ]);

  const total = Number(totals.rows[0].total);
  const distinctq = Number(totals.rows[0].distinctq);
  const correct = Number(totals.rows[0].correct);
  const bank = Number(bankTotal.rows[0].count);

  res.json({
    failedByCategory: failed.rows.map((r) => ({ category: r.category, count: Number(r.count) })),
    totalAnswered: total,
    distinctAnswered: distinctq,
    remaining: Math.max(0, bank - distinctq),
    accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    daily: daily.rows.map((r) => ({ day: r.day, answered: Number(r.answered), correct: Number(r.correct) })),
  });
}
