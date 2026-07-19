import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';
import { PRIVACY_VERSION } from '../services/consent.js';

/**
 * Avisos de apertura de matrícula.
 *
 * Sirve para no perder a quien llega interesado cuando el catálogo aún está
 * vacío, y de paso mide qué demanda real hay antes de producir cada curso.
 */

const suscribirSchema = z.object({
  email: z.string().email('Email no válido').max(200),
  interes: z.string().max(120).optional(),
  origen: z.string().max(60).optional(),
  aceptaPrivacidad: z.literal(true, {
    errorMap: () => ({ message: 'Debes aceptar la política de privacidad' }),
  }),
});

/** POST /api/public/leads — apuntarse al aviso de apertura. */
export async function subscribeLead(req: Request, res: Response): Promise<void> {
  const d = suscribirSchema.parse(req.body);

  // Repetir el alta no es un error para quien lo hace: se responde igual.
  await query(
    `INSERT INTO leads (email, interes, origen, privacy_version)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (email) DO UPDATE
       SET interes = COALESCE(EXCLUDED.interes, leads.interes),
           consent_at = NOW(),
           privacy_version = EXCLUDED.privacy_version`,
    [d.email.toLowerCase(), d.interes || null, d.origen || 'campus', PRIVACY_VERSION],
  );

  res.status(201).json({ ok: true, mensaje: 'Te avisaremos en cuanto abramos las matrículas.' });
}

/** DELETE /api/public/leads/:email — darse de baja del aviso. */
export async function unsubscribeLead(req: Request, res: Response): Promise<void> {
  const email = String(req.params.email || '').toLowerCase();
  if (!email.includes('@')) throw badRequest('Email no válido');
  await query('DELETE FROM leads WHERE email = $1', [email]);
  res.json({ ok: true });
}

/** GET /api/admin/leads — interesados, para el super admin. */
export async function listLeads(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, email, interes, origen, consent_at, notified_at
       FROM leads ORDER BY created_at DESC LIMIT 500`,
  );
  const totales = await query<{ total: string; mes: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) AS mes
       FROM leads`,
  );
  res.json({
    leads: rows,
    totales: { total: Number(totales.rows[0].total), esteMes: Number(totales.rows[0].mes) },
  });
}
