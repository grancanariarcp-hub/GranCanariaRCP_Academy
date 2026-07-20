import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { r2Configured, buildKey, uploadObject, presignedGetUrl, presignKeys } from '../services/r2.js';
import { reconocerDesafio, reconocerHoras } from '../services/recognitions.js';

function areaCategories(area: string): string[] {
  if (area === 'mixto') return ['SVB', 'PA'];
  return [area];
}

// ---------------------------------------------------------------------------
// Public: list active challenges
// ---------------------------------------------------------------------------
export async function listChallenges(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.title, c.area, c.audience, c.num_questions, c.seconds_per_question, c.time_limit_seconds, c.kind, c.thumbnail_key, c.starts_at, c.ends_at,
            (SELECT COUNT(DISTINCT participant_id) FROM challenge_attempts a WHERE a.challenge_id = c.id AND a.submitted_at IS NOT NULL) AS participants
     FROM challenges c
     WHERE c.is_active = TRUE
       AND (c.kind = 'permanente' OR (COALESCE(c.starts_at, NOW()) <= NOW() AND COALESCE(c.ends_at, NOW()) >= NOW()))
     ORDER BY (c.kind = 'permanente') DESC, c.created_at DESC`,
  );
  res.json({ challenges: await presignKeys(rows, 'thumbnail_key', 'thumbnail_url') });
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
     SELECT CASE WHEN COALESCE(s.ranking_consent, FALSE) THEN b.participant_name ELSE 'Usuario anónimo' END AS participant_name,
            b.correct, b.total, b.time_seconds,
            ROW_NUMBER() OVER (ORDER BY b.correct DESC, b.time_seconds ASC) AS position,
            GREATEST(0, EXTRACT(DAY FROM NOW() - b.submitted_at))::int AS days_in_position
     FROM best b
     LEFT JOIN students s ON s.id = b.participant_id
     ORDER BY position
     LIMIT 200`,
    [req.params.id],
  );
  res.json({ challenge: ch.rows[0], ranking: rows });
}

// ---------------------------------------------------------------------------
// Public: ranking de instituciones (global, sobre todos los desafíos)
// ---------------------------------------------------------------------------
export async function getInstitutionRanking(_req: Request, res: Response): Promise<void> {
  // Mejor intento por participante y desafío, agregado por institución.
  const { rows } = await query(
    `WITH best AS (
       SELECT DISTINCT ON (a.challenge_id, a.participant_id)
              a.institution_id, a.participant_id, a.correct, a.total
       FROM challenge_attempts a
       WHERE a.submitted_at IS NOT NULL AND a.institution_id IS NOT NULL
       ORDER BY a.challenge_id, a.participant_id, a.correct DESC, a.time_seconds ASC
     )
     SELECT i.id, i.name,
            COUNT(DISTINCT b.participant_id) AS participants,
            COUNT(*) AS attempts,
            SUM(b.correct) AS total_correct,
            ROUND(100.0 * SUM(b.correct) / NULLIF(SUM(b.total), 0)) AS accuracy_pct,
            ROW_NUMBER() OVER (ORDER BY ROUND(100.0 * SUM(b.correct) / NULLIF(SUM(b.total), 0)) DESC NULLS LAST,
                                        COUNT(DISTINCT b.participant_id) DESC) AS position
     FROM best b JOIN institutions i ON i.id = b.institution_id
     GROUP BY i.id, i.name
     HAVING COUNT(*) > 0
     ORDER BY position
     LIMIT 100`,
  );
  res.json({ ranking: rows });
}

// ---------------------------------------------------------------------------
// Public: ranking individual global (mejores personas en todos los desafíos)
// ---------------------------------------------------------------------------
export async function getIndividualRanking(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `WITH best AS (
       SELECT DISTINCT ON (a.challenge_id, a.participant_id)
              a.participant_id, a.participant_name, a.institution_id, a.correct, a.total, a.time_seconds
       FROM challenge_attempts a
       WHERE a.submitted_at IS NOT NULL
       ORDER BY a.challenge_id, a.participant_id, a.correct DESC, a.time_seconds ASC
     )
     SELECT CASE WHEN COALESCE(MAX(s.ranking_consent::int), 0) = 1
                 THEN MAX(b.participant_name) ELSE 'Usuario anónimo' END AS name,
            i.name AS institution,
            COUNT(*) AS challenges, SUM(b.correct) AS points,
            ROUND(100.0 * SUM(b.correct) / NULLIF(SUM(b.total), 0)) AS accuracy_pct,
            ROW_NUMBER() OVER (ORDER BY SUM(b.correct) DESC, SUM(b.time_seconds) ASC) AS position
     FROM best b
     LEFT JOIN institutions i ON i.id = b.institution_id
     LEFT JOIN students s ON s.id = b.participant_id
     GROUP BY b.participant_id, i.name
     ORDER BY position
     LIMIT 100`,
  );
  res.json({ ranking: rows });
}

// ---------------------------------------------------------------------------
// Participate: start (auth, any role)
// ---------------------------------------------------------------------------
export async function startChallenge(req: Request, res: Response): Promise<void> {
  const ch = await query<{ id: string; area: string; num_questions: number; time_limit_seconds: number; kind: string; starts_at: string | null; ends_at: string | null; is_active: boolean }>(
    'SELECT id, area, num_questions, time_limit_seconds, kind, starts_at, ends_at, is_active, one_attempt_only, bank_ids FROM challenges WHERE id = $1',
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

  // Un solo intento por persona: el ranking mide conocimiento, no insistencia.
  if ((c as { one_attempt_only?: boolean }).one_attempt_only !== false) {
    const ya = await query(
      'SELECT 1 FROM challenge_attempts WHERE challenge_id = $1 AND participant_id = $2 AND submitted_at IS NOT NULL',
      [c.id, req.auth!.sub],
    );
    if (ya.rows.length > 0) {
      throw badRequest('Ya has participado en este desafío. Puedes seguir entrenando en la práctica libre.', 'ALREADY_PLAYED');
    }
  }

  // Las preguntas salen de los bancos configurados; si no hay, del área.
  const banks = (c as { bank_ids?: string[] }).bank_ids ?? [];
  const questions = banks.length > 0
    ? await query('SELECT id, category, text, options FROM questions WHERE is_active = TRUE AND bank_id = ANY($1) ORDER BY RANDOM() LIMIT $2', [banks, c.num_questions])
    : await query('SELECT id, category, text, options FROM questions WHERE is_active = TRUE AND category = ANY($1) ORDER BY RANDOM() LIMIT $2', [areaCategories(c.area), c.num_questions]);
  if (questions.rows.length === 0) throw badRequest('Este desafío aún no tiene preguntas disponibles', 'NO_QUESTIONS');

  // Se guarda QUÉ preguntas le han tocado: es lo que permite corregir sobre
  // ellas y no sobre lo que el navegador diga después.
  const att = await query<{ id: string }>(
    `INSERT INTO challenge_attempts
       (challenge_id, participant_id, participant_name, participant_role, institution_id, served_questions)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING id`,
    [c.id, req.auth!.sub, name, req.auth!.role, institutionId, JSON.stringify(questions.rows.map((q) => q.id))],
  );
  res.status(201).json({ attemptId: att.rows[0].id, timeLimitSeconds: c.time_limit_seconds, questions: questions.rows });
}

// POST submit
export async function submitChallenge(req: Request, res: Response): Promise<void> {
  const att = await query<{ started_at: string; submitted_at: string | null; challenge_id: string; served_questions: string[] | null }>(
    'SELECT started_at, submitted_at, challenge_id, served_questions FROM challenge_attempts WHERE id = $1 AND participant_id = $2',
    [req.params.attemptId, req.auth!.sub],
  );
  if (att.rows.length === 0) throw notFound('Intento no encontrado');
  if (att.rows[0].submitted_at) throw badRequest('Ya enviado', 'ALREADY_SUBMITTED');

  const answers = z.record(z.union([z.number(), z.null()])).parse(req.body.answers ?? {});
  // Se corrige sobre las preguntas SERVIDAS, no sobre las que devuelva el
  // navegador. Antes el total era «cuántas me has mandado», así que enviar solo
  // las acertadas daba un 100 % y falseaba el ranking público.
  const servidas = att.rows[0].served_questions ?? Object.keys(answers);
  let correct = 0;
  if (servidas.length > 0) {
    const qs = await query<{ id: string; correct_index: number }>(
      'SELECT id, correct_index FROM questions WHERE id = ANY($1)', [servidas]);
    for (const q of qs.rows) if (answers[q.id] === q.correct_index) correct += 1;
  }
  const total = servidas.length;
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
  const position = Number(pos.rows[0]?.position ?? 0);

  // Reconocimientos: por el desafío y, de paso, por las horas acumuladas. No
  // deben poder tumbar la respuesta del intento, así que se ignoran sus fallos.
  const ch = await query<{ title: string }>('SELECT title FROM challenges WHERE id = $1', [att.rows[0].challenge_id]);
  const quien = {
    subjectId: req.auth!.sub,
    subjectType: req.auth!.role === 'student' ? 'student' : 'user',
    subjectName: req.auth!.name || 'Participante',
  };
  if (position > 0) {
    await reconocerDesafio({
      ...quien,
      challengeId: att.rows[0].challenge_id,
      challengeTitle: ch.rows[0]?.title ?? 'Desafío',
      position,
    }).catch(() => { /* no bloquear el resultado del desafío */ });
  }
  await reconocerHoras(quien).catch(() => { /* idem */ });

  res.json({ correct, total, timeSeconds, position, totalParticipants: Number(pos.rows[0]?.totalp ?? 0) });
}

// ---------------------------------------------------------------------------
// super_admin: create / list challenges
// ---------------------------------------------------------------------------
const createSchema = z.object({
  title: z.string().min(3).max(200),
  area: z.enum(['SVB', 'PA', 'mixto']).default('SVB'),
  audience: z.enum(['ninos', 'jovenes', 'adultos', 'todos']).default('todos'),
  numQuestions: z.number().int().min(3).max(50).default(10),
  secondsPerQuestion: z.number().int().min(5).max(120).default(30),
  kind: z.enum(['permanente', 'temporal']).default('temporal'),
  oneAttemptOnly: z.boolean().optional().default(true),
  bankIds: z.array(z.string().uuid()).optional().default([]),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
});

export async function createChallenge(req: Request, res: Response): Promise<void> {
  const d = createSchema.parse(req.body);
  // El tiempo total sale del ritmo: segundos por pregunta × nº de preguntas.
  const total = d.numQuestions * d.secondsPerQuestion;
  const { rows } = await query(
    `INSERT INTO challenges (title, area, audience, num_questions, seconds_per_question, time_limit_seconds,
                             kind, one_attempt_only, bank_ids, starts_at, ends_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     RETURNING id, title, area, audience, num_questions, seconds_per_question, time_limit_seconds, kind, one_attempt_only, starts_at, ends_at`,
    [d.title, d.area, d.audience, d.numQuestions, d.secondsPerQuestion, total, d.kind,
     d.oneAttemptOnly, d.bankIds, d.startsAt || null, d.endsAt || null],
  );
  res.status(201).json({ challenge: rows[0] });
}

/** Editar un desafío (super_admin). */
export async function updateChallenge(req: Request, res: Response): Promise<void> {
  const d = createSchema.partial().parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title, area: d.area, audience: d.audience, num_questions: d.numQuestions,
    seconds_per_question: d.secondsPerQuestion, kind: d.kind, one_attempt_only: d.oneAttemptOnly,
    bank_ids: d.bankIds, starts_at: d.startsAt, ends_at: d.endsAt,
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val === '' ? null : val); fields.push(`${col} = $${params.length}`); }
  }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE challenges SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, num_questions, seconds_per_question`,
    params,
  );
  if (rows.length === 0) throw notFound('Desafío no encontrado');
  // Recalcular el tiempo total tras el cambio.
  await query('UPDATE challenges SET time_limit_seconds = num_questions * seconds_per_question WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}

export async function deleteChallenge(req: Request, res: Response): Promise<void> {
  const r = await query('DELETE FROM challenges WHERE id = $1 RETURNING id', [req.params.id]);
  if (r.rows.length === 0) throw notFound('Desafío no encontrado');
  res.json({ ok: true });
}

/** Exporta el ranking del desafío (JSON descargable). */
export async function exportChallenge(req: Request, res: Response): Promise<void> {
  const c = await query<{ title: string }>('SELECT title FROM challenges WHERE id = $1', [req.params.id]);
  if (c.rows.length === 0) throw notFound('Desafío no encontrado');
  const { rows } = await query(
    `SELECT DISTINCT ON (participant_id) participant_name, correct, total, time_seconds, submitted_at
       FROM challenge_attempts WHERE challenge_id = $1 AND submitted_at IS NOT NULL
      ORDER BY participant_id, correct DESC, time_seconds ASC`,
    [req.params.id],
  );
  const data = rows
    .sort((a, b) => Number(b.correct) - Number(a.correct) || Number(a.time_seconds) - Number(b.time_seconds))
    .map((r, i) => ({ puesto: i + 1, participante: r.participant_name, aciertos: r.correct, total: r.total, segundos: r.time_seconds, fecha: r.submitted_at }));
  const safe = c.rows[0].title.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'desafio';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="ranking-${safe}.json"`);
  res.send(JSON.stringify(data, null, 2));
}

export async function listAllChallenges(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, area, audience, num_questions, seconds_per_question, time_limit_seconds, kind, one_attempt_only, bank_ids, thumbnail_key, starts_at, ends_at, is_active,
            (SELECT COUNT(DISTINCT participant_id) FROM challenge_attempts a WHERE a.challenge_id = challenges.id AND a.submitted_at IS NOT NULL) AS participants
     FROM challenges ORDER BY (kind='permanente') DESC, created_at DESC`,
  );
  res.json({ challenges: await presignKeys(rows, 'thumbnail_key', 'thumbnail_url') });
}

/** Miniatura del desafío (multipart). Se ve en la portada y en el listado. */
export async function uploadChallengeThumbnail(req: Request, res: Response): Promise<void> {
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');

  const key = buildKey(file.originalname, 'challenges');
  await uploadObject(key, file.buffer, file.mimetype);
  const { rows } = await query('UPDATE challenges SET thumbnail_key = $1 WHERE id = $2 RETURNING id', [key, req.params.id]);
  if (rows.length === 0) throw notFound('Desafío no encontrado');
  res.json({ ok: true, thumbnail_url: await presignedGetUrl(key, 3600) });
}
