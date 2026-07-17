import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { r2Configured, buildKey, uploadObject, presignedGetUrl } from '../services/r2.js';
import { renderLegajo, type LegajoCourse } from '../services/legajoPdf.js';

const COURSE_FIELDS = 'c.title, c.starts_at, c.ends_at, c.duration_hours, c.acreditacion, c.cfc, c.publico_objetivo';

async function taughtCourses(userId: string): Promise<LegajoCourse[]> {
  const { rows } = await query<LegajoCourse>(
    `SELECT ${COURSE_FIELDS} FROM course_staff cs JOIN courses c ON c.id = cs.course_id
     WHERE cs.user_id = $1 ORDER BY c.created_at DESC`,
    [userId],
  );
  return rows;
}
async function receivedCourses(studentId: string): Promise<LegajoCourse[]> {
  const { rows } = await query<LegajoCourse>(
    `SELECT ${COURSE_FIELDS} FROM enrollments e JOIN courses c ON c.id = e.course_id
     WHERE e.student_id = $1 AND e.status IN ('activo', 'completado') ORDER BY e.enrolled_at DESC`,
    [studentId],
  );
  return rows;
}

// ---------------------------------------------------------------------------
// GET /api/profile
// ---------------------------------------------------------------------------
export async function getProfile(req: Request, res: Response): Promise<void> {
  const { sub, role } = req.auth!;
  if (role === 'student') {
    const u = await query('SELECT id, display_name AS name, email, age, is_minor, access_code FROM students WHERE id = $1', [sub]);
    res.json({ profile: { ...u.rows[0], role: 'student' }, taught: [], received: await receivedCourses(sub) });
    return;
  }
  const u = await query<{ photo_key: string | null }>('SELECT id, name, email, headline, role, photo_key FROM users WHERE id = $1', [sub]);
  const photoUrl = u.rows[0]?.photo_key && r2Configured() ? await presignedGetUrl(u.rows[0].photo_key, 3600) : null;
  res.json({ profile: { ...u.rows[0], photo_url: photoUrl }, taught: await taughtCourses(sub), received: [] });
}

// ---------------------------------------------------------------------------
// POST /api/profile/password
// ---------------------------------------------------------------------------
const changePwSchema = z.object({
  currentPassword: z.string().min(1, 'Indica tu contraseña actual'),
  newPassword: z.string().min(8, 'La nueva contraseña debe tener al menos 8 caracteres'),
});

export async function changePassword(req: Request, res: Response): Promise<void> {
  const { currentPassword, newPassword } = changePwSchema.parse(req.body);
  const { sub, role } = req.auth!;
  const table = role === 'student' ? 'students' : 'users';

  const cur = await query<{ password_hash: string | null }>(`SELECT password_hash FROM ${table} WHERE id = $1`, [sub]);
  const hash = cur.rows[0]?.password_hash;
  if (!hash || !(await verifyPassword(currentPassword, hash))) {
    throw badRequest('La contraseña actual no es correcta', 'BAD_CURRENT');
  }
  await query(`UPDATE ${table} SET password_hash = $1 WHERE id = $2`, [await hashPassword(newPassword), sub]);
  await audit({ actorId: sub, actorType: role, action: 'PASSWORD_CHANGE', ip: clientIp(req) });
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST /api/profile/photo  (staff: professors) — image to R2
// ---------------------------------------------------------------------------
export async function uploadProfilePhoto(req: Request, res: Response): Promise<void> {
  if (req.auth!.role === 'student') throw badRequest('No disponible', 'NOT_ALLOWED');
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');

  const key = buildKey(file.originalname, 'avatars');
  await uploadObject(key, file.buffer, file.mimetype);
  await query('UPDATE users SET photo_key = $1 WHERE id = $2', [key, req.auth!.sub]);
  res.json({ photo_url: await presignedGetUrl(key, 3600) });
}

// ---------------------------------------------------------------------------
// GET /api/profile/legajo  — generated on the fly, never stored
// ---------------------------------------------------------------------------
export async function generateLegajo(req: Request, res: Response): Promise<void> {
  const { sub, role } = req.auth!;
  let name = '';
  let email: string | null = null;
  let headline: string | null = null;
  let taught: LegajoCourse[] = [];
  let received: LegajoCourse[] = [];

  if (role === 'student') {
    const u = await query<{ name: string; email: string | null }>('SELECT display_name AS name, email FROM students WHERE id = $1', [sub]);
    name = u.rows[0]?.name ?? 'Alumno';
    email = u.rows[0]?.email ?? null;
    received = await receivedCourses(sub);
  } else {
    const u = await query<{ name: string; email: string; headline: string | null }>('SELECT name, email, headline FROM users WHERE id = $1', [sub]);
    name = u.rows[0]?.name ?? 'Docente';
    email = u.rows[0]?.email ?? null;
    headline = u.rows[0]?.headline ?? null;
    taught = await taughtCourses(sub);
  }

  const doc = new PDFDocument({ size: 'A4', autoFirstPage: false, bufferPages: true, margin: 60 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="legajo-grancanaria-rcp.pdf"');
  doc.pipe(res);
  renderLegajo(doc, { name, email, headline, taught, received });
  doc.end();

  await audit({ actorId: sub, actorType: role, action: 'LEGAJO_DOWNLOAD', ip: clientIp(req) });
}
