import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';

/**
 * Grupos de WhatsApp. El enlace es una INVITACIÓN: unirse es voluntario y el
 * teléfono queda en WhatsApp, nunca en la plataforma. Solo registramos si el
 * alumno ha marcado que ya se unió, para dejar de recordárselo.
 */

const GLOBAL_KEY = 'whatsapp_url';

/** super_admin: leer/guardar el enlace del grupo general. */
export async function getGlobalWhatsapp(_req: Request, res: Response): Promise<void> {
  const { rows } = await query<{ value: string | null }>('SELECT value FROM platform_settings WHERE key = $1', [GLOBAL_KEY]);
  res.json({ url: rows[0]?.value ?? null });
}

export async function setGlobalWhatsapp(req: Request, res: Response): Promise<void> {
  const { url } = z.object({ url: z.string().url('Enlace no válido').or(z.literal('')) }).parse(req.body);
  await query(
    `INSERT INTO platform_settings (key, value, updated_at) VALUES ($1,$2,NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [GLOBAL_KEY, url || null],
  );
  res.json({ ok: true, url: url || null });
}

/**
 * Alumno: grupos a los que aún no se ha unido (el general y los de sus cursos).
 * El frontend lo muestra como aviso emergente al entrar.
 */
export async function myPendingGroups(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'student') { res.json({ groups: [] }); return; }
  const studentId = req.auth!.sub;

  const [global, me, courses] = await Promise.all([
    query<{ value: string | null }>('SELECT value FROM platform_settings WHERE key = $1', [GLOBAL_KEY]),
    query<{ whatsapp_joined_at: string | null }>('SELECT whatsapp_joined_at FROM students WHERE id = $1', [studentId]),
    query<{ course_id: string; title: string; whatsapp_url: string }>(
      `SELECT c.id AS course_id, c.title, c.whatsapp_url
       FROM enrollments e JOIN courses c ON c.id = e.course_id
       WHERE e.student_id = $1 AND e.status IN ('activo','completado')
         AND c.whatsapp_url IS NOT NULL AND c.whatsapp_url <> ''
         AND e.whatsapp_joined_at IS NULL`,
      [studentId],
    ),
  ]);

  const groups: Array<{ scope: 'global' | 'curso'; courseId: string | null; title: string; url: string }> = [];
  const globalUrl = global.rows[0]?.value;
  if (globalUrl && !me.rows[0]?.whatsapp_joined_at) {
    groups.push({ scope: 'global', courseId: null, title: 'Comunidad Gran Canaria RCP', url: globalUrl });
  }
  for (const c of courses.rows) {
    groups.push({ scope: 'curso', courseId: c.course_id, title: c.title, url: c.whatsapp_url });
  }
  res.json({ groups });
}

/** Alumno: marca que ya se unió (o que no quiere que se lo recuerden más). */
export async function markJoined(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'student') throw badRequest('Solo alumnos', 'NOT_STUDENT');
  const { courseId } = z.object({ courseId: z.string().uuid().optional() }).parse(req.body);
  if (courseId) {
    await query('UPDATE enrollments SET whatsapp_joined_at = NOW() WHERE student_id = $1 AND course_id = $2',
      [req.auth!.sub, courseId]);
  } else {
    await query('UPDATE students SET whatsapp_joined_at = NOW() WHERE id = $1', [req.auth!.sub]);
  }
  res.json({ ok: true });
}
