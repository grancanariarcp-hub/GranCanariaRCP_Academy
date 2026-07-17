import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';

function areaCategories(area: string): string[] {
  if (area === 'mixto') return ['SVB', 'PA'];
  return [area];
}

// ---------------------------------------------------------------------------
// Public: list active challenges
// ---------------------------------------------------------------------------
export async function listChallenges(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.title, c.area, c.num_questions, c.time_limit_seconds, c.kind, c.starts_at, c.ends_at,
            (SELECT COUNT(DISTINCT participant_id) FROM challenge_attempts a WHERE a.challenge_id = c.id AND a.submitted_at IS NOT NULL) AS participants
     FROM challenges c
     WHERE c.is_active = TRUE
       AND (c.kind = 'permanente' OR (COALESCE(c.starts_at, NOW()) <= NOW() AND COALESCE(c.ends_at, NOW()) >= NOW()))
     ORDER BY (c.kind = 'permanente') DESC, c.created_at DESC`,
  );
  res.json({ challenges: rows });
}

// ---------------------------------------------------------------------------
// Public: challenge info + ranking
// ---------------------------------------------------------------------------
export async function getChallengeRanking(req: Request, res: Response): Promise<void> {
  const ch = await query('SELECT id, title, area, num_questions, time_limit_seconds, kind, starts_at, ends_at FROM challenges WHERE id = $1', [req.params.id]);
  if (ch.rows.length === 0) throw notFound('Desafío no encontrado');

  const { rows } = await query(
    `WITH best AS (
       SELECT DISTINCT ON (participant_id) participant_id, participant_name, correct, total, time_seconds, submitted_at
       FROM challenge_attempts
       WHERE challenge_id = $1 AND submitted_at IS NOT NULL
       ORDER BY participant_id, correct DESC, time_seconds ASC, submitted_at ASC
     )
     SELECT participant_name, correct, total, time_seconds,
            ROW_NUMBER() OVER (ORDER BY correct DESC, time_seconds ASC) AS position,
            GREATEST(0, EXTRACT(DAY FROM NOW() - submitted_at))::int AS days_in_position
     FROM best
     ORDER BY position
     LIMIT 200`,
    [req.params.id],
  );
  res.json({ challenge: ch.rows[0], ranking: rows });
}

// ---------------------------------------------------------------------------
// Participate: start (auth, any role)
// ---------------------------------------------------------------------------
export async function startChallenge(req: Request, res: Response): Promise<void> {
  const ch = await query<{ id: string; area: string; num_questions: number; time_limit_seconds: number; kind: string; starts_at: string | null; ends_at: string | null; is_active: boolean }>(
    'SELECT id, area, num_questions, time_limit_seconds, kind, starts_at, ends_at, is_active FROM challenges WHERE id = $1',
    [req.params.id],
  );
  if (ch.rows.length === 0) throw notFound('Desafío no encontrado');
  const c = ch.rows[0];
  if (!c.is_active) throw badRequest('Desafío no disponible', 'INACTIVE');
  if (c.kind === 'temporal') {
    const now = Date.now();
    if ((c.starts_at && new Date(c.starts_at).getTime() > now) || (c.ends_at && new Date(c.ends_at).getTime() < now)) {
      throw badRequest('El desafío no está activo ahora', 'OUT_OF_WINDOW');
    }
  }

  // Resolve participant identity.
  let name = req.auth!.name;
  let institutionId: string | null = req.auth!.institutionId;
  if (req.auth!.role === 'student') {
    const s = await query<{ display_name: string; institution_id: string | null }>('SELECT display_name, institution_id FROM students WHERE id = $1', [req.auth!.sub]);
    if (s.rows[0]) { name = s.rows[0].display_name; institutionId = s.rows[0].institution_id; }
  }

  const questions = await query('SELECT id, category, text, options FROM questions WHERE is_active = TRUE AND category = ANY($1) ORDER BY RANDOM() LIMIT $2', [areaCategories(c.area), c.num_questions]);
  if (questions.rows.length === 0) throw badRequest('Este desafío aún no tiene preguntas disponibles', 'NO_QUESTIONS');

  const att = await query<{ id: string }>(
    'INSERT INTO challenge_attempts (challenge_id, participant_id, participant_name, participant_role, institution_id) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [c.id, req.auth!.sub, name, req.auth!.role, institutionId],
  );
  res.status(201).json({ attemptId: att.rows[0].id, timeLimitSeconds: c.time_limit_seconds, questions: questions.rows });
}

// POST submit
export async function submitChallenge(req: Request, res: Response): Promise<void> {
  const att = await query<{ started_at: string; submitted_at: string | null; challenge_id: string }>(
    'SELECT started_at, submitted_at, challenge_id FROM challenge_attempts WHERE id = $1 AND participant_id = $2',
    [req.params.attemptId, req.auth!.sub],
  );
  if (att.rows.length === 0) throw notFound('Intento no encontrado');
  if (att.rows[0].submitted_at) throw badRequest('Ya enviado', 'ALREADY_SUBMITTED');

  const answers = z.record(z.union([z.number(), z.null()])).parse(req.body.answers ?? {});
  const ids = Object.keys(answers);
  let correct = 0;
  if (ids.length > 0) {
    const qs = await query<{ id: string; correct_index: number }>('SELECT id, correct_index FROM questions WHERE id = ANY($1)', [ids]);
    for (const q of qs.rows) if (answers[q.id] === q.correct_index) correct += 1;
  }
  const total = ids.length;
  const timeSeconds = Math.max(0, Math.round((Date.now() - new Date(att.rows[0].started_at).getTime()) / 1000));

  await query(
    'UPDATE challenge_attempts SET submitted_at = NOW(), correct = $1, total = $2, time_seconds = $3, answers = $4::jsonb WHERE id = $5',
    [correct, total, timeSeconds, JSON.stringify(answers), req.params.attemptId],
  );

  // Position of this participant's best attempt.
  const pos = await query<{ position: string; totalp: string }>(
    `WITH best AS (
       SELECT DISTINCT ON (participant_id) participant_id, correct, time_seconds
       FROM challenge_attempts WHERE challenge_id = $1 AND submitted_at IS NOT NULL
       ORDER BY participant_id, correct DESC, time_seconds ASC
     ), ranked AS (
       SELECT participant_id, ROW_NUMBER() OVER (ORDER BY correct DESC, time_seconds ASC) AS position FROM best
     )
     SELECT (SELECT position FROM ranked WHERE participant_id = $2) AS position,
            (SELECT COUNT(*) FROM ranked) AS totalp`,
    [att.rows[0].challenge_id, req.auth!.sub],
  );
  res.json({ correct, total, timeSeconds, position: Number(pos.rows[0]?.position ?? 0), totalParticipants: Number(pos.rows[0]?.totalp ?? 0) });
}

// ---------------------------------------------------------------------------
// super_admin: create / list challenges
// ---------------------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(3).max(200),
  area: z.enum(['SVB', 'PA', 'mixto']).default('SVB'),
  numQuestions: z.number().int().min(1).max(50).default(10),
  timeLimitSeconds: z.number().int().min(30).max(7200).default(300),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function createChallenge(req: Request, res: Response): Promise<void> {
  const d = createSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO challenges (title, area, num_questions, time_limit_seconds, kind, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,'temporal',$5,$6) RETURNING id, title, area, kind, starts_at, ends_at`,
    [d.title, d.area, d.numQuestions, d.timeLimitSeconds, d.startsAt || null, d.endsAt || null],
  );
  res.status(201).json({ challenge: rows[0] });
}

export async function listAllChallenges(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, area, num_questions, time_limit_seconds, kind, starts_at, ends_at, is_active,
            (SELECT COUNT(DISTINCT participant_id) FROM challenge_attempts a WHERE a.challenge_id = challenges.id AND a.submitted_at IS NOT NULL) AS participants
     FROM challenges ORDER BY (kind='permanente') DESC, created_at DESC`,
  );
  res.json({ challenges: rows });
}
