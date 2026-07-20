import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, conflict, notFound } from '../utils/httpError.js';
import { hashPassword } from '../utils/crypto.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Cuentas de auditoría para la comisión de formación continuada.
 *
 * Las crea el super admin y entrega las credenciales. Se permiten varias
 * aunque la comisión pida unas compartidas: con una cuenta por persona la
 * auditoría dice QUIÉN miró qué y se puede revocar a uno sin dejar fuera al
 * resto. Con una sola cuenta compartida, el registro solo dice "alguien de la
 * comisión", que sirve de poco si luego hay discrepancias.
 */

const crearSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  notes: z.string().max(300).optional(),
  /** Caducidad opcional: el acceso de una comisión no debería ser eterno. */
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

/** GET /api/admin/auditores */
export async function listAuditores(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT u.id, u.name, u.email, u.status, u.notes, u.access_expires_at, u.last_login_at, u.created_at,
            (SELECT COUNT(*) FROM audit_logs a
              WHERE a.actor_id = u.id AND a.action = 'AUDITOR_VIEW')::int AS consultas
       FROM users u WHERE u.role = 'auditor' ORDER BY u.created_at DESC`,
  );
  res.json({ auditores: rows });
}

/** POST /api/admin/auditores */
export async function crearAuditor(req: Request, res: Response): Promise<void> {
  const d = crearSchema.parse(req.body);
  const email = d.email.toLowerCase();

  const existe = await query(
    'SELECT 1 FROM users WHERE email = $1 UNION SELECT 1 FROM students WHERE email = $1',
    [email],
  );
  if (existe.rows.length > 0) throw conflict('Ya existe una cuenta con ese email', 'EMAIL_TAKEN');

  const { rows } = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, name, role, status, notes, access_expires_at)
     VALUES ($1,$2,$3,'auditor','active',$4,$5) RETURNING id`,
    [email, await hashPassword(d.password), d.name, d.notes || null, d.expiresAt || null],
  );

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'AUDITOR_CREATED',
    entity: 'user', entityId: rows[0].id, ip: clientIp(req), metadata: { email, notes: d.notes ?? null },
  }).catch(() => { /* el alta no depende del registro */ });

  res.status(201).json({ id: rows[0].id });
}

const editarSchema = z.object({
  name: z.string().min(2).max(120).optional(),
  password: z.string().min(8).optional(),
  notes: z.string().max(300).nullish(),
  expiresAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  /** Bloquear o reactivar sin borrar: conserva su rastro de auditoría. */
  status: z.enum(['active', 'blocked']).optional(),
});

/** PATCH /api/admin/auditores/:id */
export async function editarAuditor(req: Request, res: Response): Promise<void> {
  const d = editarSchema.parse(req.body);
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (d.name !== undefined) { vals.push(d.name); sets.push(`name = $${vals.length}`); }
  if (d.notes !== undefined) { vals.push(d.notes || null); sets.push(`notes = $${vals.length}`); }
  if (d.expiresAt !== undefined) { vals.push(d.expiresAt || null); sets.push(`access_expires_at = $${vals.length}`); }
  if (d.status !== undefined) { vals.push(d.status); sets.push(`status = $${vals.length}`); }
  if (d.password) { vals.push(await hashPassword(d.password)); sets.push(`password_hash = $${vals.length}`); }
  if (sets.length === 0) throw badRequest('Nada que actualizar');

  vals.push(req.params.id);
  const { rowCount } = await query(
    `UPDATE users SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${vals.length} AND role = 'auditor'`,
    vals,
  );
  if (rowCount === 0) throw notFound('Auditor no encontrado');

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'AUDITOR_UPDATED',
    entity: 'user', entityId: req.params.id, ip: clientIp(req),
    // Nunca se registra la contraseña, solo que se cambió.
    metadata: { cambios: Object.keys(d).filter((k) => k !== 'password'), passwordCambiada: !!d.password },
  }).catch(() => { /* idem */ });

  res.json({ ok: true });
}

/** DELETE /api/admin/auditores/:id */
export async function borrarAuditor(req: Request, res: Response): Promise<void> {
  const { rowCount } = await query("DELETE FROM users WHERE id = $1 AND role = 'auditor'", [req.params.id]);
  if (rowCount === 0) throw notFound('Auditor no encontrado');
  res.json({ ok: true });
}

/** GET /api/admin/auditores/:id/actividad — qué ha consultado. */
export async function actividadAuditor(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT action, metadata, ip, created_at FROM audit_logs
      WHERE actor_id = $1 ORDER BY created_at DESC LIMIT 200`,
    [req.params.id],
  );
  const resumen = await query<{ dia: string; n: string }>(
    `SELECT to_char(created_at::date, 'YYYY-MM-DD') AS dia, COUNT(*)::text AS n
       FROM audit_logs WHERE actor_id = $1 AND created_at > NOW() - INTERVAL '30 days'
      GROUP BY 1 ORDER BY 1`,
    [req.params.id],
  );
  res.json({ actividad: rows, porDia: resumen.rows });
}
