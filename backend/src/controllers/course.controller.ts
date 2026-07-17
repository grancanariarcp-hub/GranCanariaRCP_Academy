import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { forbidden, notFound } from '../utils/httpError.js';
import { withImageUrls, presignKeys } from '../services/r2.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Courses. super_admin sees/manages all; a profesor sees/manages the courses
 * where they are staff (director or instructor). The creator becomes director.
 */

const createSchema = z.object({
  title: z.string().min(3).max(200),
  tema: z.string().max(120).optional(),
  subtema: z.string().max(120).optional(),
  durationHours: z.number().positive().max(1000).optional(),
  modality: z.enum(['online', 'mixto', 'presencial']).default('online'),
  objetivoGeneral: z.string().optional(),
  objetivosEspecificos: z.string().optional(),
  publicoObjetivo: z.array(z.string()).optional().default([]),
  priceCents: z.number().int().min(0).optional().default(0),
  resumen: z.string().optional(),
  acreditacion: z.string().max(200).optional(),
  cfc: z.string().max(120).optional(),
});

export async function createCourse(req: Request, res: Response): Promise<void> {
  const data = createSchema.parse(req.body);
  const userId = req.auth!.sub;

  const course = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO courses
         (title, tema, subtema, duration_hours, modality, objetivo_general,
          objetivos_especificos, publico_objetivo, price_cents, resumen, acreditacion, cfc, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING id, title, tema, subtema, status, created_at`,
      [
        data.title, data.tema ?? null, data.subtema ?? null, data.durationHours ?? null,
        data.modality, data.objetivoGeneral ?? null, data.objetivosEspecificos ?? null,
        data.publicoObjetivo, data.priceCents, data.resumen ?? null, data.acreditacion ?? null, data.cfc ?? null, userId,
      ],
    );
    const created = rows[0];

    // Creator becomes director of the course.
    await client.query(
      `INSERT INTO course_staff (course_id, user_id, role) VALUES ($1, $2, 'director')`,
      [created.id, userId],
    );

    // Auto-generate a welcome + first module.
    await client.query(
      `INSERT INTO modules (course_id, title, sort_order) VALUES ($1, 'Bienvenida', 0), ($1, 'Módulo 1', 1)`,
      [created.id],
    );

    return created;
  });

  await audit({
    actorId: userId, actorType: req.auth!.role, action: 'COURSE_CREATE',
    entity: 'course', entityId: course.id, ip: clientIp(req), metadata: { title: data.title },
  });

  res.status(201).json({ course });
}

/** Public: courses with open enrollment (for the login / discovery page). */
export async function listOpenCourses(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, tema, subtema, modality, duration_hours, price_cents, publico_objetivo, resumen, thumbnail_key
     FROM courses WHERE status = 'publicado' AND enrollment_open = TRUE
     ORDER BY created_at DESC`,
  );
  res.json({ courses: await presignKeys(rows, 'thumbnail_key', 'thumbnail_url') });
}

/** Public: full info of one published course (for its landing page). */
export async function getPublicCourse(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, tema, subtema, modality, duration_hours, price_cents,
            publico_objetivo, objetivo_general, objetivos_especificos, resumen, acreditacion, cfc,
            thumbnail_key, enrollment_open
     FROM courses WHERE id = $1 AND status = 'publicado'`,
    [req.params.id],
  );
  if (rows.length === 0) throw notFound('Curso no encontrado');
  const staff = await query(
    `SELECT u.id, u.name, u.headline, cs.role FROM course_staff cs JOIN users u ON u.id = cs.user_id WHERE cs.course_id = $1`,
    [req.params.id],
  );
  const [course] = await presignKeys(rows, 'thumbnail_key', 'thumbnail_url');
  res.json({ course, staff: staff.rows });
}

export async function listCourses(req: Request, res: Response): Promise<void> {
  const isSuper = req.auth!.role === 'super_admin';
  const { rows } = isSuper
    ? await query(
        `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
                c.price_cents, c.created_at,
                (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules
         FROM courses c ORDER BY c.created_at DESC`,
      )
    : await query(
        `SELECT c.id, c.title, c.tema, c.subtema, c.status, c.enrollment_open, c.modality,
                c.price_cents, c.created_at,
                (SELECT COUNT(*) FROM modules m WHERE m.course_id = c.id) AS modules,
                cs.role AS my_role
         FROM courses c
         JOIN course_staff cs ON cs.course_id = c.id AND cs.user_id = $1
         ORDER BY c.created_at DESC`,
        [req.auth!.sub],
      );
  res.json({ courses: rows });
}

async function assertCanAccess(courseId: string, req: Request): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  const { rows } = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [
    courseId, req.auth!.sub,
  ]);
  if (rows.length === 0) throw forbidden('No formas parte de este curso');
}

export async function getCourse(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const course = await query('SELECT * FROM courses WHERE id = $1', [id]);
  if (course.rows.length === 0) throw notFound('Curso no encontrado');
  await assertCanAccess(id, req);

  const [modules, staff, activities] = await Promise.all([
    query<{ id: string }>('SELECT id, title, sort_order, is_mandatory, starts_at, ends_at FROM modules WHERE course_id = $1 ORDER BY sort_order', [id]),
    query(
      `SELECT u.id, u.name, u.email, cs.role
       FROM course_staff cs JOIN users u ON u.id = cs.user_id
       WHERE cs.course_id = $1`,
      [id],
    ),
    query<{ module_id: string; image_key: string | null }>(
      `SELECT a.id, a.module_id, a.type, a.title, a.url, a.body, a.image_key, a.is_mandatory, a.document_id, a.exam_id, d.title AS document_title
       FROM activities a
       LEFT JOIN documents d ON d.id = a.document_id
       WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)
       ORDER BY a.sort_order`,
      [id],
    ),
  ]);

  const acts = await withImageUrls(activities.rows);
  const modulesWithActivities = modules.rows.map((m) => ({
    ...m,
    activities: acts.filter((a) => a.module_id === m.id),
  }));

  const [courseWithThumb] = await presignKeys(course.rows, 'thumbnail_key', 'thumbnail_url');
  res.json({ course: courseWithThumb, modules: modulesWithActivities, staff: staff.rows });
}
