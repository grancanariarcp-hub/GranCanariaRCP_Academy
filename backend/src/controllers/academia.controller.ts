import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { relacionConCurso } from '../services/courseAuth.js';
import { sendEmail, emailTemplate, emailConfigured } from '../services/email.js';

/**
 * Servicios extras: configuración (aún no se cobra). Un valor global de la
 * academia, que fija el super admin en su perfil, y un override por curso que
 * solo afecta a ese curso. Ver migración 082 y [[roadmap-curso-ope]] fase 7.
 */

// Campos de configuración, en el orden en que se guardan. money = céntimos.
const CAMPOS = [
  'coste_minimo_curso_cents', 'pct_matricula', 'gestion_cfc_cents',
  'memoria_incluida_mb', 'memoria_extra_bloque_mb', 'memoria_extra_cents',
  'ia_creditos_incluidos', 'ia_paquete_creditos', 'ia_paquete_cents',
] as const;

const settingsSchema = z.object({
  coste_minimo_curso_cents: z.number().int().min(0).max(10_000_00),
  pct_matricula: z.number().min(0).max(100),
  gestion_cfc_cents: z.number().int().min(0).max(10_000_00),
  memoria_incluida_mb: z.number().int().min(0).max(1_000_000),
  memoria_extra_bloque_mb: z.number().int().min(1).max(1_000_000),
  memoria_extra_cents: z.number().int().min(0).max(10_000_00),
  ia_creditos_incluidos: z.number().int().min(0).max(1_000_000),
  ia_paquete_creditos: z.number().int().min(1).max(1_000_000),
  ia_paquete_cents: z.number().int().min(0).max(10_000_00),
}).partial();

/**
 * POST /api/admin/email-test — envía un correo de prueba al propio super admin.
 *
 * Sirve para verificar que Resend está bien configurado sin molestar a ningún
 * alumno: el destinatario es siempre el email de quien pulsa el botón.
 */
export async function enviarCorreoPrueba(req: Request, res: Response): Promise<void> {
  if (!emailConfigured()) {
    res.json({ configurado: false, enviado: false, mensaje: 'Falta RESEND_API_KEY en el servidor.' });
    return;
  }
  const u = await query<{ email: string; name: string }>('SELECT email, name FROM users WHERE id = $1', [req.auth!.sub]);
  const to = u.rows[0]?.email;
  if (!to) { res.json({ configurado: true, enviado: false, mensaje: 'Tu cuenta no tiene email.' }); return; }
  const html = emailTemplate(
    'Correo de prueba ✅',
    'Si lees esto, el envío de correos de la academia funciona correctamente. Puedes ignorar este mensaje.',
    null,
  );
  const enviado = await sendEmail(to, 'Prueba de correo · GranCanaria RCP', html);
  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'EMAIL_TEST',
    entity: 'academy', entityId: null, ip: clientIp(req), metadata: { to, enviado },
  }).catch(() => { /* no bloquear */ });
  res.json({ configurado: true, enviado, to });
}

/** GET /api/admin/academia — configuración global (super admin). */
export async function getAcademySettings(_req: Request, res: Response): Promise<void> {
  const { rows } = await query('SELECT * FROM academy_settings WHERE id = TRUE');
  res.json({ settings: rows[0] ?? null });
}

/** PUT /api/admin/academia — actualizar la configuración global (super admin). */
export async function updateAcademySettings(req: Request, res: Response): Promise<void> {
  const d = settingsSchema.parse(req.body);
  const entradas = Object.entries(d).filter(([, v]) => v !== undefined);
  if (entradas.length === 0) throw badRequest('Nada que actualizar');
  const sets = entradas.map(([col], i) => `${col} = $${i + 1}`);
  const params = entradas.map(([, v]) => v);
  const { rows } = await query(
    `UPDATE academy_settings SET ${sets.join(', ')}, updated_at = NOW() WHERE id = TRUE RETURNING *`,
    params,
  );
  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'ACADEMY_SETTINGS_UPDATE',
    entity: 'academy', entityId: null, ip: clientIp(req), metadata: d,
  }).catch(() => { /* el registro no debe impedir guardar */ });
  res.json({ settings: rows[0] });
}

/**
 * GET /api/courses/:id/extras — valores efectivos de un curso: el global, el
 * override (si lo hay) y la mezcla. El profesorado del curso puede verlo (para
 * saber qué se cobra y qué va incluido); editarlo es cosa del super admin.
 */
export async function getCourseExtras(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'super_admin') {
    const rel = await relacionConCurso(req.params.id, req.auth!.sub);
    if (!rel.existe) throw notFound('Curso no encontrado');
    if (!rel.esCreador && rel.rolStaff === null) throw forbidden('No participas en este curso');
  }
  const global = (await query('SELECT * FROM academy_settings WHERE id = TRUE')).rows[0] ?? {};
  const override = (await query('SELECT * FROM course_extras WHERE course_id = $1', [req.params.id])).rows[0] ?? null;
  const efectivo: Record<string, unknown> = {};
  for (const c of CAMPOS) efectivo[c] = (override && override[c] != null) ? override[c] : global[c];
  res.json({ global, override, efectivo });
}

/**
 * PUT /api/courses/:id/extras — fijar el override de un curso (super admin).
 * Un campo a null vuelve a heredar el valor global.
 */
export async function updateCourseExtras(req: Request, res: Response): Promise<void> {
  if (req.auth!.role !== 'super_admin') throw forbidden('Solo el super admin ajusta los servicios extras de un curso');
  const curso = await query('SELECT 1 FROM courses WHERE id = $1', [req.params.id]);
  if (curso.rows.length === 0) throw notFound('Curso no encontrado');

  // Cada campo puede venir con un número (override) o null (heredar).
  const overrideSchema = z.object(Object.fromEntries(
    CAMPOS.map((c) => [c, z.number().min(0).nullable().optional()]),
  ));
  const d = overrideSchema.parse(req.body) as Record<string, number | null | undefined>;

  const cols = CAMPOS.filter((c) => d[c] !== undefined);
  if (cols.length === 0) throw badRequest('Nada que actualizar');
  const valores = cols.map((c) => d[c]);
  const placeholders = cols.map((_, i) => `$${i + 2}`);
  const updates = cols.map((c, i) => `${c} = $${i + 2}`);
  const { rows } = await query(
    `INSERT INTO course_extras (course_id, ${cols.join(', ')})
     VALUES ($1, ${placeholders.join(', ')})
     ON CONFLICT (course_id) DO UPDATE SET ${updates.join(', ')}, updated_at = NOW()
     RETURNING *`,
    [req.params.id, ...valores],
  );
  res.json({ override: rows[0] });
}
