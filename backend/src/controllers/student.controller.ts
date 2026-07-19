import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound, HttpError } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { withImageUrls } from '../services/r2.js';
import { notify } from '../services/notify.js';
import { precioDe } from '../services/pricing.js';

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

// ---------------------------------------------------------------------------
// Fase D: matrícula y cursos del alumno
// ---------------------------------------------------------------------------

/** Cursos con matrícula abierta en los que el alumno AÚN no está matriculado. */
export async function listAvailableCourses(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.title, c.tema, c.subtema, c.modality, c.duration_hours, c.price_cents, c.publico_objetivo
     FROM courses c
     WHERE c.status = 'publicado' AND c.enrollment_open = TRUE
       AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.course_id = c.id AND e.student_id = $1)
     ORDER BY c.created_at DESC`,
    [req.auth!.sub],
  );
  res.json({ courses: rows });
}

/** Matricular al alumno actual. Curso gratis -> activo; de pago -> pendiente_pago. */
export async function enrollCourse(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  const course = await query<{
    status: string; enrollment_open: boolean; price_cents: number; title: string;
    early_bird_until: string | null; late_surcharge_pct: number | null;
  }>(
    `SELECT status, enrollment_open, price_cents, title, early_bird_until, late_surcharge_pct
       FROM courses WHERE id = $1`,
    [courseId],
  );
  if (course.rows.length === 0) throw notFound('Curso no encontrado');
  const c = course.rows[0];
  if (c.status !== 'publicado' || !c.enrollment_open) throw badRequest('La matrícula de este curso no está abierta', 'ENROLL_CLOSED');

  // El importe se congela aquí: si luego cambia el precio o vence el plazo de
  // matrícula anticipada, esta matrícula conserva lo que le correspondía.
  const precio = precioDe({
    priceCents: c.price_cents,
    earlyBirdUntil: c.early_bird_until,
    lateSurchargePct: c.late_surcharge_pct,
  });
  const status = precio.cents > 0 ? 'pendiente_pago' : 'activo';
  const { rows } = await query(
    `INSERT INTO enrollments (student_id, course_id, status, price_paid_cents)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (student_id, course_id) DO UPDATE SET status = enrollments.status
     RETURNING id, status, price_paid_cents`,
    [req.auth!.sub, courseId, status, precio.cents],
  );

  // Avisar al profesorado del curso del nuevo alumno.
  const [staff, st] = await Promise.all([
    query<{ user_id: string }>('SELECT user_id FROM course_staff WHERE course_id = $1', [courseId]),
    query<{ display_name: string }>('SELECT display_name FROM students WHERE id = $1', [req.auth!.sub]),
  ]);
  const alumno = st.rows[0]?.display_name ?? 'Un alumno';
  for (const s of staff.rows) {
    await notify({ id: s.user_id, type: 'user' }, 'Nueva matrícula',
      `${alumno} se matriculó en «${c.title}»`, `/admin/cursos/${courseId}`).catch(() => { /* no bloquear */ });
  }

  await audit({ actorId: req.auth!.sub, actorType: 'student', action: 'ENROLL', entity: 'course', entityId: courseId, ip: clientIp(req) });
  res.status(201).json({ enrollment: rows[0], paymentRequired: c.price_cents > 0 });
}

/** "Mis cursos": los cursos en los que está matriculado. */
export async function listMyCourses(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.title, c.tema, c.subtema, c.modality, e.status, e.enrolled_at
     FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1
     ORDER BY e.enrolled_at DESC`,
    [req.auth!.sub],
  );
  res.json({ courses: rows });
}

/** Contenido del curso para estudiar (solo si está matriculado). */
export async function getMyCourseContent(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  const enr = await query<{ status: string; price_paid_cents: number | null }>(
    'SELECT status, price_paid_cents FROM enrollments WHERE student_id = $1 AND course_id = $2',
    [req.auth!.sub, courseId],
  );
  if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');
  const matricula = enr.rows[0];

  // El contenido no se sirve hasta que la matrícula está pagada: si no, bastaba
  // con matricularse y entrar para acceder a todo el curso sin pasar por caja.
  if (matricula.status === 'pendiente_pago') {
    throw new HttpError(402, 'Debes completar el pago de la matrícula para acceder al curso', 'PAYMENT_REQUIRED');
  }

  const course = await query('SELECT id, title, tema, subtema, modality, objetivo_general FROM courses WHERE id = $1', [courseId]);
  if (course.rows.length === 0) throw notFound('Curso no encontrado');

  const modules = await query<{ id: string }>('SELECT id, title, sort_order FROM modules WHERE course_id = $1 ORDER BY sort_order', [courseId]);
  const activities = await query<{ id: string; module_id: string; image_key: string | null }>(
    `SELECT a.id, a.module_id, a.type, a.title, a.url, a.body, a.image_key, a.document_id, a.exam_id, d.title AS document_title
     FROM activities a LEFT JOIN documents d ON d.id = a.document_id
     WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)
     ORDER BY a.sort_order`,
    [courseId],
  );
  const acts = await withImageUrls(activities.rows);

  // Actividades ya completadas por este alumno (para la barra de avance).
  const done = await query<{ activity_id: string }>(
    `SELECT ac.activity_id FROM activity_completions ac
      WHERE ac.student_id = $1
        AND ac.activity_id IN (SELECT id FROM activities WHERE module_id IN (SELECT id FROM modules WHERE course_id = $2))`,
    [req.auth!.sub, courseId],
  );
  const doneSet = new Set(done.rows.map((d) => d.activity_id));
  const actsWithDone = acts.map((a) => ({ ...a, completed: doneSet.has(a.id) }));
  const mods = modules.rows.map((m) => ({ ...m, activities: actsWithDone.filter((a) => a.module_id === m.id) }));

  const total = acts.length;
  const completed = doneSet.size;

  const passed = await query(
    `SELECT 1 FROM exam_attempts a JOIN exams e ON e.id = a.exam_id JOIN modules m ON m.id = e.module_id
     WHERE m.course_id = $1 AND a.student_id = $2 AND a.passed = TRUE LIMIT 1`,
    [courseId, req.auth!.sub],
  );
  res.json({
    course: course.rows[0],
    modules: mods,
    certificateAvailable: passed.rows.length > 0,
    progress: { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 },
    matricula: { estado: matricula.status, importeCents: matricula.price_paid_cents ?? 0 },
  });
}

/** El alumno marca una actividad como completada (o la desmarca). */
export async function setActivityCompleted(req: Request, res: Response): Promise<void> {
  const { courseId, activityId } = req.params;
  const enr = await query('SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.auth!.sub, courseId]);
  if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');

  const act = await query(
    'SELECT 1 FROM activities WHERE id = $1 AND module_id IN (SELECT id FROM modules WHERE course_id = $2)',
    [activityId, courseId],
  );
  if (act.rows.length === 0) throw notFound('Actividad no encontrada');

  const completed = req.body?.completed !== false;
  if (completed) {
    await query(
      `INSERT INTO activity_completions (student_id, activity_id) VALUES ($1,$2)
       ON CONFLICT (student_id, activity_id) DO NOTHING`,
      [req.auth!.sub, activityId],
    );
  } else {
    await query('DELETE FROM activity_completions WHERE student_id = $1 AND activity_id = $2', [req.auth!.sub, activityId]);
  }
  res.json({ ok: true, completed });
}
