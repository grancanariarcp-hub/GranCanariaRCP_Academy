import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { forbidden, notFound } from '../utils/httpError.js';

/**
 * Cuadros de mando. Los periodos son de MES NATURAL:
 *   mesAnterior = mes completo anterior · mesActual = del día 1 a hoy ·
 *   anio = del 1 de enero a hoy.
 */
const PERIODS = `
  COUNT(*) FILTER (WHERE %C >= date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                     AND %C <  date_trunc('month', CURRENT_DATE))                    AS mes_anterior,
  COUNT(*) FILTER (WHERE %C >= date_trunc('month', CURRENT_DATE))                    AS mes_actual,
  COUNT(*) FILTER (WHERE %C >= date_trunc('year',  CURRENT_DATE))                    AS anio,
  COUNT(*)                                                                            AS total`;

const periodsOn = (col: string) => PERIODS.replaceAll('%C', col);

/** GET /api/admin/dashboard — visión global (super_admin). */
export async function adminDashboard(_req: Request, res: Response): Promise<void> {
  const [personas, matriculas, instituciones, profesores, cursos, desafios, bajas, actividad] = await Promise.all([
    // Personas registradas (para practicar y competir)
    query(`SELECT ${periodsOn('created_at')} FROM students WHERE deleted_at IS NULL`),
    // Matrículas en cursos
    query(`SELECT ${periodsOn('enrolled_at')} FROM enrollments`),
    // Instituciones
    query(`SELECT ${periodsOn('created_at')} FROM institutions`),
    // Profesores de la plataforma
    query(`SELECT ${periodsOn('created_at')} FROM users WHERE role = 'profesor' AND deleted_at IS NULL`),
    // Cursos: activos (publicados) y total histórico
    query<{ publicados: string; total: string; matricula_abierta: string }>(
      `SELECT COUNT(*) FILTER (WHERE status = 'publicado') AS publicados,
              COUNT(*) FILTER (WHERE status = 'publicado' AND enrollment_open) AS matricula_abierta,
              COUNT(*) AS total FROM courses`,
    ),
    // Desafíos activos
    query<{ activos: string; total: string }>(
      `SELECT COUNT(*) FILTER (WHERE is_active AND (ends_at IS NULL OR ends_at > NOW())) AS activos,
              COUNT(*) AS total FROM challenges`,
    ),
    // Bajas (cuentas borradas). Las cancelaciones de suscripción se sumarán aquí
    // cuando exista el módulo de pagos.
    query(`SELECT ${periodsOn('deleted_at')} FROM students WHERE deleted_at IS NOT NULL`),
    // Actividad formativa
    query<{ alumnos_con_curso: string; aprobados: string; horas: string }>(
      `SELECT (SELECT COUNT(DISTINCT student_id) FROM enrollments) AS alumnos_con_curso,
              (SELECT COUNT(DISTINCT student_id) FROM exam_attempts WHERE passed) AS aprobados,
              (SELECT COALESCE(ROUND(SUM(active_seconds)/3600.0), 0) FROM learning_time) AS horas`,
    ),
  ]);

  res.json({
    personasRegistradas: personas.rows[0],
    matriculas: matriculas.rows[0],
    instituciones: instituciones.rows[0],
    profesores: profesores.rows[0],
    bajas: bajas.rows[0],
    cursos: cursos.rows[0],
    desafios: desafios.rows[0],
    actividad: actividad.rows[0],
    // Pendiente del módulo de pagos: se rellenará solo cuando exista.
    suscriptores: null,
    facturacion: null,
  });
}

/** GET /api/courses/:id/dashboard — panel del director, solo de SU curso. */
export async function courseDashboard(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (req.auth!.role !== 'super_admin') {
    const staff = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [id, req.auth!.sub]);
    if (staff.rows.length === 0) throw forbidden('No formas parte de este curso');
  }
  const course = await query<{ title: string }>('SELECT title FROM courses WHERE id = $1', [id]);
  if (course.rows.length === 0) throw notFound('Curso no encontrado');

  const [alumnos, avance, tiempo, pendientes, examenes] = await Promise.all([
    query(`SELECT ${periodsOn('enrolled_at')} FROM enrollments WHERE course_id = $1`, [id]),
    // Avance medio del curso
    query<{ total_actividades: string; media_pct: string | null }>(
      `WITH t AS (SELECT COUNT(*) AS n FROM activities
                   WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1)),
            p AS (SELECT e.student_id,
                         (SELECT COUNT(*) FROM activity_completions ac
                           WHERE ac.student_id = e.student_id
                             AND ac.activity_id IN (SELECT id FROM activities WHERE module_id IN (SELECT id FROM modules WHERE course_id = $1))
                         ) AS hechas
                    FROM enrollments e WHERE e.course_id = $1)
       SELECT (SELECT n FROM t) AS total_actividades,
              ROUND(AVG(CASE WHEN (SELECT n FROM t) > 0 THEN 100.0 * p.hechas / (SELECT n FROM t) ELSE 0 END)) AS media_pct
         FROM p`,
      [id],
    ),
    query<{ horas: string; media_horas: string | null }>(
      `SELECT COALESCE(ROUND(SUM(active_seconds)/3600.0), 0) AS horas,
              ROUND(AVG(active_seconds)/3600.0, 1) AS media_horas
         FROM learning_time WHERE course_id = $1`,
      [id],
    ),
    // Alumnos pendientes de cada actividad (lo que pediste para el director)
    query<{ activity_id: string; title: string; type: string; pendientes: string }>(
      `SELECT a.id AS activity_id, a.title, a.type,
              (SELECT COUNT(*) FROM enrollments e
                WHERE e.course_id = $1
                  AND NOT EXISTS (SELECT 1 FROM activity_completions ac
                                   WHERE ac.activity_id = a.id AND ac.student_id = e.student_id)
              ) AS pendientes
         FROM activities a
        WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)
        ORDER BY pendientes DESC, a.sort_order
        LIMIT 20`,
      [id],
    ),
    query<{ aprobados: string; presentados: string }>(
      `SELECT COUNT(DISTINCT student_id) FILTER (WHERE passed) AS aprobados,
              COUNT(DISTINCT student_id) AS presentados
         FROM exam_attempts a
         JOIN exams e ON e.id = a.exam_id
         JOIN modules m ON m.id = e.module_id
        WHERE m.course_id = $1 AND a.submitted_at IS NOT NULL`,
      [id],
    ),
  ]);

  res.json({
    curso: course.rows[0].title,
    matriculas: alumnos.rows[0],
    avance: avance.rows[0],
    tiempo: tiempo.rows[0],
    pendientes: pendientes.rows,
    examenes: examenes.rows[0],
  });
}
