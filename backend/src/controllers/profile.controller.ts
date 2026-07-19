import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { logConsent } from '../services/consent.js';
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
  // Al definir contraseña propia se levanta la obligación de cambiarla.
  await query(`UPDATE ${table} SET password_hash = $1, must_change_password = FALSE WHERE id = $2`,
    [await hashPassword(newPassword), sub]);
  await audit({ actorId: sub, actorType: role, action: 'PASSWORD_CHANGE', ip: clientIp(req) });
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// GET/POST /api/profile/consents — el usuario puede dar o RETIRAR su
// consentimiento en cualquier momento (art. 7.3 RGPD).
// ---------------------------------------------------------------------------
export async function getConsents(req: Request, res: Response): Promise<void> {
  const { sub, role } = req.auth!;
  const table = role === 'student' ? 'students' : 'users';
  const { rows } = await query(
    `SELECT ranking_consent, marketing_consent, accepted_terms_at, privacy_version FROM ${table} WHERE id = $1`,
    [sub],
  );
  res.json({ consents: rows[0] ?? null });
}

export async function updateConsents(req: Request, res: Response): Promise<void> {
  const d = z.object({ ranking: z.boolean().optional(), marketing: z.boolean().optional() }).parse(req.body);
  const { sub, role } = req.auth!;
  const table = role === 'student' ? 'students' : 'users';
  const type = role === 'student' ? 'student' : 'user';

  if (d.ranking !== undefined) {
    await query(`UPDATE ${table} SET ranking_consent = $1 WHERE id = $2`, [d.ranking, sub]);
    await logConsent(sub, type, 'ranking', d.ranking, clientIp(req));
  }
  if (d.marketing !== undefined) {
    await query(`UPDATE ${table} SET marketing_consent = $1 WHERE id = $2`, [d.marketing, sub]);
    await logConsent(sub, type, 'marketing', d.marketing, clientIp(req));
  }
  res.json({ ok: true });
}

// ---------------------------------------------------------------------------
// POST /api/profile/email — cambiar el correo de acceso (pide la contraseña)
// ---------------------------------------------------------------------------
const changeEmailSchema = z.object({
  currentPassword: z.string().min(1, 'Confirma tu contraseña'),
  newEmail: z.string().email('Email no válido'),
});

export async function changeEmail(req: Request, res: Response): Promise<void> {
  const { currentPassword, newEmail } = changeEmailSchema.parse(req.body);
  const { sub, role } = req.auth!;
  const table = role === 'student' ? 'students' : 'users';
  const email = newEmail.toLowerCase();

  const cur = await query<{ password_hash: string | null }>(`SELECT password_hash FROM ${table} WHERE id = $1`, [sub]);
  const hash = cur.rows[0]?.password_hash;
  if (!hash || !(await verifyPassword(currentPassword, hash))) {
    throw badRequest('La contraseña no es correcta', 'BAD_CURRENT');
  }

  const taken = await query(
    'SELECT 1 FROM users WHERE email = $1 AND id <> $2 UNION SELECT 1 FROM students WHERE email = $1 AND id <> $2',
    [email, sub],
  );
  if (taken.rows.length > 0) throw badRequest('Ese email ya está en uso', 'EMAIL_TAKEN');

  await query(`UPDATE ${table} SET email = $1 WHERE id = $2`, [email, sub]);
  await audit({ actorId: sub, actorType: role, action: 'EMAIL_CHANGE', ip: clientIp(req), metadata: { email } });
  res.json({ ok: true, email });
}

// ---------------------------------------------------------------------------
// DELETE /api/profile — baja de la cuenta (derecho de supresión, RGPD).
// Anonimiza los datos personales pero conserva la fila para no romper
// resultados, certificados emitidos ni estadísticas históricas.
// ---------------------------------------------------------------------------
export async function deleteMyAccount(req: Request, res: Response): Promise<void> {
  const { currentPassword, reason } = z.object({
    currentPassword: z.string().min(1, 'Confirma tu contraseña'),
    reason: z.string().max(200).optional(),
  }).parse(req.body);
  const { sub, role } = req.auth!;
  const table = role === 'student' ? 'students' : 'users';
  const nameCol = role === 'student' ? 'display_name' : 'name';

  const cur = await query<{ password_hash: string | null }>(`SELECT password_hash FROM ${table} WHERE id = $1`, [sub]);
  const hash = cur.rows[0]?.password_hash;
  if (!hash || !(await verifyPassword(currentPassword, hash))) {
    throw badRequest('La contraseña no es correcta', 'BAD_CURRENT');
  }

  await query(
    `UPDATE ${table}
        SET ${nameCol} = 'Usuario dado de baja', email = NULL, password_hash = NULL,
            is_active = FALSE, deleted_at = NOW(), deletion_reason = $1
      WHERE id = $2`,
    [reason ?? null, sub],
  );
  await audit({ actorId: sub, actorType: role, action: 'ACCOUNT_DELETE', ip: clientIp(req), metadata: { reason } });
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

// ---------------------------------------------------------------------------
// CV del profesor (ítems por categoría) — visible a los alumnos
// ---------------------------------------------------------------------------
const CV_CATEGORIES = ['formacion', 'investigacion', 'publicaciones', 'reconocimientos', 'experiencia'] as const;
type CvCategory = (typeof CV_CATEGORIES)[number];

function groupCv(rows: Array<{ id?: string; category: string; text: string }>): Record<CvCategory, Array<{ id?: string; text: string }>> {
  const g = {} as Record<CvCategory, Array<{ id?: string; text: string }>>;
  for (const c of CV_CATEGORIES) g[c] = [];
  for (const r of rows) if ((CV_CATEGORIES as readonly string[]).includes(r.category)) g[r.category as CvCategory].push({ id: r.id, text: r.text });
  return g;
}

export async function getCv(req: Request, res: Response): Promise<void> {
  if (req.auth!.role === 'student') throw badRequest('No disponible', 'NOT_ALLOWED');
  const { rows } = await query<{ id: string; category: string; text: string }>(
    'SELECT id, category, text FROM cv_items WHERE user_id = $1 ORDER BY category, sort_order, created_at',
    [req.auth!.sub],
  );
  res.json({ cv: groupCv(rows) });
}

const cvItemSchema = z.object({
  category: z.enum(CV_CATEGORIES),
  text: z.string().min(2).max(500),
});

export async function addCvItem(req: Request, res: Response): Promise<void> {
  if (req.auth!.role === 'student') throw badRequest('No disponible', 'NOT_ALLOWED');
  const { category, text } = cvItemSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO cv_items (user_id, category, text, sort_order)
     VALUES ($1, $2::varchar, $3, COALESCE((SELECT MAX(sort_order) + 1 FROM cv_items WHERE user_id = $1 AND category = $2::varchar), 0))
     RETURNING id, category, text`,
    [req.auth!.sub, category, text],
  );
  res.status(201).json({ item: rows[0] });
}

export async function deleteCvItem(req: Request, res: Response): Promise<void> {
  await query('DELETE FROM cv_items WHERE id = $1 AND user_id = $2', [req.params.itemId, req.auth!.sub]);
  res.json({ ok: true });
}

/** Public: a professor's CV (for students). */
/**
 * GET /api/public/professors — profesorado con perfil publicado.
 *
 * La formación sanitaria se vende con confianza: ver quién enseña, con nombre,
 * cargo y currículum consultable, pesa más que cualquier argumento. Solo salen
 * quienes tienen titular relleno, para no mostrar fichas a medias.
 */
export async function listPublicProfessors(_req: Request, res: Response): Promise<void> {
  // Solo el profesorado con curso VIVO: publicado y aún no terminado, esté la
  // matrícula abierta o no. Al cerrarse el curso deja de aparecer solo, sin que
  // nadie tenga que acordarse de retirarlo.
  const { rows } = await query<{ id: string; name: string; headline: string | null; photo_key: string | null; cursos: string }>(
    `SELECT u.id, u.name, u.headline, u.photo_key, COUNT(DISTINCT c.id)::text AS cursos
       FROM users u
       JOIN course_staff cs ON cs.user_id = u.id
       JOIN courses c ON c.id = cs.course_id
      WHERE u.role = 'profesor' AND u.status = 'active'
        AND c.status = 'publicado'
        AND (c.ends_at IS NULL OR c.ends_at >= CURRENT_DATE)
      GROUP BY u.id
      ORDER BY MIN(c.starts_at) NULLS LAST, u.name
      LIMIT 12`,
  );
  const profesores = await Promise.all(rows.map(async (u) => ({
    id: u.id,
    name: u.name,
    headline: u.headline,
    cursos: Number(u.cursos),
    photo_url: u.photo_key && r2Configured() ? await presignedGetUrl(u.photo_key, 3600) : null,
  })));
  res.json({ profesores });
}

export async function getProfessorCv(req: Request, res: Response): Promise<void> {
  const u = await query<{ name: string; headline: string | null; photo_key: string | null }>(
    "SELECT name, headline, photo_key FROM users WHERE id = $1 AND role = 'profesor'",
    [req.params.id],
  );
  if (u.rows.length === 0) throw notFound('Profesor no encontrado');
  const photoUrl = u.rows[0].photo_key && r2Configured() ? await presignedGetUrl(u.rows[0].photo_key, 3600) : null;
  const items = await query<{ category: string; text: string }>(
    'SELECT category, text FROM cv_items WHERE user_id = $1 ORDER BY category, sort_order, created_at',
    [req.params.id],
  );
  res.json({ professor: { name: u.rows[0].name, headline: u.rows[0].headline, photo_url: photoUrl }, cv: groupCv(items.rows) });
}
