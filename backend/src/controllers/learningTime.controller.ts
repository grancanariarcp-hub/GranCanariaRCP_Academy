import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';

/**
 * Latido de tiempo de estudio. El navegador lo envía cada ~60 s mientras la
 * pestaña está abierta, indicando si el alumno está ACTIVO (pestaña visible +
 * interacción reciente). Sumamos por alumno, curso y día.
 *
 * Limitación honesta: mide interacción, no comprensión. Pero descarta el caso
 * de "dejé la pestaña abierta y me fui", que es el error de medida importante.
 */
const beatSchema = z.object({
  courseId: z.string().uuid().optional(),
  seconds: z.number().int().min(1).max(300),
  active: z.boolean(),
});

export async function heartbeat(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'student') { res.json({ ok: true }); return; }
  const { courseId, seconds, active } = beatSchema.parse(req.body);
  const studentId = req.auth!.sub;

  const upd = await query(
    `UPDATE learning_time
        SET active_seconds  = active_seconds  + $1,
            session_seconds = session_seconds + $2
      WHERE student_id = $3 AND day = CURRENT_DATE
        AND course_id IS NOT DISTINCT FROM $4
      RETURNING id`,
    [active ? seconds : 0, seconds, studentId, courseId ?? null],
  );
  if (upd.rows.length === 0) {
    await query(
      `INSERT INTO learning_time (student_id, course_id, day, active_seconds, session_seconds)
       VALUES ($1,$2,CURRENT_DATE,$3,$4)`,
      [studentId, courseId ?? null, active ? seconds : 0, seconds],
    );
  }
  res.json({ ok: true });
}

/** Tiempo del alumno actual: total y por día (últimos 30 días). */
export async function myLearningTime(req: Request, res: Response): Promise<void> {
  const studentId = req.auth!.sub;
  const courseId = (req.query.courseId as string) || null;

  const [tot, daily] = await Promise.all([
    query<{ active: string; session: string }>(
      `SELECT COALESCE(SUM(active_seconds),0) AS active, COALESCE(SUM(session_seconds),0) AS session
         FROM learning_time WHERE student_id = $1 AND ($2::uuid IS NULL OR course_id = $2)`,
      [studentId, courseId],
    ),
    query<{ day: string; active: string }>(
      `SELECT to_char(day,'YYYY-MM-DD') AS day, SUM(active_seconds) AS active
         FROM learning_time
        WHERE student_id = $1 AND ($2::uuid IS NULL OR course_id = $2)
          AND day > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY day ORDER BY day`,
      [studentId, courseId],
    ),
  ]);

  const activeSec = Number(tot.rows[0].active);
  const sessionSec = Number(tot.rows[0].session);
  res.json({
    activeHours: Math.round((activeSec / 3600) * 10) / 10,
    sessionHours: Math.round((sessionSec / 3600) * 10) / 10,
    focusPct: sessionSec > 0 ? Math.round((activeSec / sessionSec) * 100) : null,
    daily: daily.rows.map((d) => ({ day: d.day, hours: Math.round((Number(d.active) / 3600) * 100) / 100 })),
  });
}
