import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';

/**
 * Foro por curso. Accesible a cualquier usuario autenticado que forme parte del
 * curso: staff (super_admin / course_staff) o alumno matriculado (activo o
 * completado). El autor puede vivir en `users` o en `students`, así que se
 * guarda author_id + author_type + author_name (snapshot).
 */

function authorType(req: Request): 'user' | 'student' {
  return req.auth!.role === 'student' ? 'student' : 'user';
}

/** ¿El solicitante es staff del curso (puede moderar)? super_admin siempre. */
async function isCourseStaff(courseId: string, req: Request): Promise<boolean> {
  if (req.auth!.role === 'super_admin') return true;
  if (req.auth!.role === 'student') return false;
  const { rows } = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [courseId, req.auth!.sub]);
  return rows.length > 0;
}

/** Comprueba que el solicitante forma parte del curso; lanza 403/404 si no. */
async function assertForumAccess(courseId: string, req: Request): Promise<void> {
  const course = await query('SELECT 1 FROM courses WHERE id = $1', [courseId]);
  if (course.rows.length === 0) throw notFound('Curso no encontrado');

  if (req.auth!.role === 'student') {
    const enr = await query(
      "SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2 AND status IN ('activo','completado')",
      [courseId, req.auth!.sub],
    );
    if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');
    return;
  }
  if (!(await isCourseStaff(courseId, req))) throw forbidden('No formas parte de este curso');
}

// GET /api/forum/:courseId/threads
export async function listThreads(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  await assertForumAccess(courseId, req);
  const { rows } = await query(
    `SELECT t.id, t.title, t.author_name, t.closed, t.created_at, t.updated_at,
            (SELECT COUNT(*) FROM forum_posts p WHERE p.thread_id = t.id) AS posts
     FROM forum_threads t WHERE t.course_id = $1 ORDER BY t.updated_at DESC`,
    [courseId],
  );
  res.json({ threads: rows, canModerate: await isCourseStaff(courseId, req) });
}

// POST /api/forum/:courseId/threads  { title, body }
const createThreadSchema = z.object({ title: z.string().min(3).max(200), body: z.string().min(1).max(5000) });
export async function createThread(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  await assertForumAccess(courseId, req);
  const { title, body } = createThreadSchema.parse(req.body);
  const at = authorType(req);
  const name = req.auth!.name;

  const thread = await withTransaction(async (client) => {
    const t = await client.query(
      `INSERT INTO forum_threads (course_id, author_id, author_type, author_name, title)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [courseId, req.auth!.sub, at, name, title],
    );
    const threadId = t.rows[0].id;
    await client.query(
      `INSERT INTO forum_posts (thread_id, author_id, author_type, author_name, body)
       VALUES ($1,$2,$3,$4,$5)`,
      [threadId, req.auth!.sub, at, name, body],
    );
    return threadId;
  });
  res.status(201).json({ id: thread });
}

// GET /api/forum/:courseId/threads/:threadId
export async function getThread(req: Request, res: Response): Promise<void> {
  const { courseId, threadId } = req.params;
  await assertForumAccess(courseId, req);
  const t = await query(
    'SELECT id, title, author_name, closed, created_at FROM forum_threads WHERE id = $1 AND course_id = $2',
    [threadId, courseId],
  );
  if (t.rows.length === 0) throw notFound('Hilo no encontrado');
  const posts = await query(
    'SELECT id, author_id, author_type, author_name, body, created_at FROM forum_posts WHERE thread_id = $1 ORDER BY created_at ASC',
    [threadId],
  );
  res.json({
    thread: t.rows[0],
    posts: posts.rows,
    canModerate: await isCourseStaff(courseId, req),
    me: { id: req.auth!.sub, type: authorType(req) },
  });
}

// POST /api/forum/:courseId/threads/:threadId/posts  { body }
const replySchema = z.object({ body: z.string().min(1).max(5000) });
export async function createPost(req: Request, res: Response): Promise<void> {
  const { courseId, threadId } = req.params;
  await assertForumAccess(courseId, req);
  const { body } = replySchema.parse(req.body);

  const t = await query('SELECT closed FROM forum_threads WHERE id = $1 AND course_id = $2', [threadId, courseId]);
  if (t.rows.length === 0) throw notFound('Hilo no encontrado');
  if (t.rows[0].closed && !(await isCourseStaff(courseId, req))) throw badRequest('El hilo está cerrado', 'THREAD_CLOSED');

  await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO forum_posts (thread_id, author_id, author_type, author_name, body)
       VALUES ($1,$2,$3,$4,$5)`,
      [threadId, req.auth!.sub, authorType(req), req.auth!.name, body],
    );
    await client.query('UPDATE forum_threads SET updated_at = NOW() WHERE id = $1', [threadId]);
  });
  res.status(201).json({ ok: true });
}

// PATCH /api/forum/:courseId/threads/:threadId/close  { closed }  (solo staff)
export async function setThreadClosed(req: Request, res: Response): Promise<void> {
  const { courseId, threadId } = req.params;
  await assertForumAccess(courseId, req);
  if (!(await isCourseStaff(courseId, req))) throw forbidden('Solo el profesorado puede cerrar hilos');
  const closed = z.object({ closed: z.boolean() }).parse(req.body).closed;
  const r = await query('UPDATE forum_threads SET closed = $1 WHERE id = $2 AND course_id = $3 RETURNING id', [closed, threadId, courseId]);
  if (r.rows.length === 0) throw notFound('Hilo no encontrado');
  res.json({ ok: true, closed });
}

// DELETE /api/forum/:courseId/posts/:postId  (autor o staff)
export async function deletePost(req: Request, res: Response): Promise<void> {
  const { courseId, postId } = req.params;
  await assertForumAccess(courseId, req);
  const post = await query(
    `SELECT p.id, p.author_id, p.author_type, p.thread_id,
            (SELECT COUNT(*) FROM forum_posts p2 WHERE p2.thread_id = p.thread_id) AS total
     FROM forum_posts p JOIN forum_threads t ON t.id = p.thread_id
     WHERE p.id = $1 AND t.course_id = $2`,
    [postId, courseId],
  );
  if (post.rows.length === 0) throw notFound('Mensaje no encontrado');
  const p = post.rows[0];
  const mine = p.author_id === req.auth!.sub && p.author_type === authorType(req);
  if (!mine && !(await isCourseStaff(courseId, req))) throw forbidden('No puedes borrar este mensaje');

  // Si es el único mensaje del hilo, se borra el hilo entero (cascade).
  if (Number(p.total) <= 1) {
    await query('DELETE FROM forum_threads WHERE id = $1', [p.thread_id]);
    res.json({ ok: true, threadDeleted: true });
    return;
  }
  await query('DELETE FROM forum_posts WHERE id = $1', [postId]);
  res.json({ ok: true });
}
