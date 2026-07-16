import type { Request, Response } from 'express';
import { query } from '../config/database.js';

/**
 * Basic student dashboard payload: their profile summary + progress.
 * Assumes requireAuth + requireRole('student') have run.
 */
export async function getStudentDashboard(req: Request, res: Response): Promise<void> {
  const studentId = req.auth!.sub;

  const [profile, progress, perCategory] = await Promise.all([
    query(
      `SELECT s.id, s.display_name, s.is_minor, s.access_code, i.name AS institution_name
       FROM students s JOIN institutions i ON i.id = s.institution_id
       WHERE s.id = $1`,
      [studentId],
    ),
    query<{ total: string; correct: string }>(
      `SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE is_correct) AS correct
       FROM test_responses WHERE student_id = $1`,
      [studentId],
    ),
    query(
      `SELECT q.category,
              COUNT(*) AS answered,
              COUNT(*) FILTER (WHERE tr.is_correct) AS correct
       FROM test_responses tr
       JOIN questions q ON q.id = tr.question_id
       WHERE tr.student_id = $1
       GROUP BY q.category`,
      [studentId],
    ),
  ]);

  const total = Number(progress.rows[0].total);
  const correct = Number(progress.rows[0].correct);

  res.json({
    profile: profile.rows[0] ?? null,
    progress: {
      answered: total,
      correct,
      scorePct: total > 0 ? Math.round((correct / total) * 100) : null,
    },
    byCategory: perCategory.rows,
  });
}
