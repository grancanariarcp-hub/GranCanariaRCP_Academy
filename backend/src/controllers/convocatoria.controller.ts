import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';

/**
 * Convocatorias de oposición.
 *
 * Agrupan los bancos que el super admin asigna a UNA oposición concreta, para
 * que el opositor vea solo lo que le corresponde y no todo el catálogo.
 */

const convSchema = z.object({
  name: z.string().min(2).max(200),
  comunidad: z.string().max(120).nullish(),
  categoria: z.string().max(160).nullish(),
  anio: z.number().int().min(2000).max(2100).nullish(),
  descripcion: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
});

/** GET /api/admin/convocatorias */
export async function listConvocatorias(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.*,
            COALESCE(json_agg(json_build_object('id', b.id, 'name', b.name, 'preguntas',
              (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id AND q.is_active))
              ORDER BY cb.sort_order) FILTER (WHERE b.id IS NOT NULL), '[]') AS bancos
       FROM ope_convocatorias c
       LEFT JOIN ope_convocatoria_banks cb ON cb.convocatoria_id = c.id
       LEFT JOIN question_banks b ON b.id = cb.bank_id
      GROUP BY c.id ORDER BY c.anio DESC NULLS LAST, c.name`,
  );
  res.json({ convocatorias: rows });
}

/** POST /api/admin/convocatorias */
export async function createConvocatoria(req: Request, res: Response): Promise<void> {
  const d = convSchema.parse(req.body);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO ope_convocatorias (name, comunidad, categoria, anio, descripcion, is_active)
     VALUES ($1,$2,$3,$4,$5,COALESCE($6, TRUE)) RETURNING id`,
    [d.name, d.comunidad || null, d.categoria || null, d.anio ?? null, d.descripcion || null, d.isActive],
  );
  res.status(201).json({ id: rows[0].id });
}

/** PATCH /api/admin/convocatorias/:id */
export async function updateConvocatoria(req: Request, res: Response): Promise<void> {
  const d = convSchema.partial().parse(req.body);
  const map: Record<string, unknown> = {
    name: d.name, comunidad: d.comunidad, categoria: d.categoria,
    anio: d.anio, descripcion: d.descripcion, is_active: d.isActive,
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    vals.push(val === '' ? null : val);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) throw badRequest('Nada que actualizar');
  vals.push(req.params.id);
  const { rowCount } = await query(
    `UPDATE ope_convocatorias SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals,
  );
  if (rowCount === 0) throw notFound('Convocatoria no encontrada');
  res.json({ ok: true });
}

/** DELETE /api/admin/convocatorias/:id */
export async function deleteConvocatoria(req: Request, res: Response): Promise<void> {
  const { rowCount } = await query('DELETE FROM ope_convocatorias WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw notFound('Convocatoria no encontrada');
  res.json({ ok: true });
}

/** PUT /api/admin/convocatorias/:id/banks — fijar qué bancos la componen. */
export async function setConvocatoriaBanks(req: Request, res: Response): Promise<void> {
  const { bankIds } = z.object({ bankIds: z.array(z.string().uuid()) }).parse(req.body);
  await query('DELETE FROM ope_convocatoria_banks WHERE convocatoria_id = $1', [req.params.id]);
  for (const [i, bankId] of bankIds.entries()) {
    await query(
      `INSERT INTO ope_convocatoria_banks (convocatoria_id, bank_id, sort_order)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.params.id, bankId, i],
    );
  }
  res.json({ ok: true, bancos: bankIds.length });
}

/**
 * GET /api/practice/convocatorias — las que puede preparar el opositor,
 * con sus bancos y las materias de cada uno para poder configurar el test.
 */
export async function myConvocatorias(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.name, c.comunidad, c.categoria, c.anio, c.descripcion,
            COALESCE(json_agg(json_build_object(
              'id', b.id,
              'name', b.name,
              'preguntas', (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id AND q.is_active),
              'maxOrden',  (SELECT MAX(q.orden) FROM questions q WHERE q.bank_id = b.id AND q.is_active),
              'temas', (SELECT COALESCE(json_agg(DISTINCT t.tema), '[]')
                          FROM (SELECT tema FROM questions WHERE bank_id = b.id AND is_active AND tema IS NOT NULL) t),
              'vistas', (SELECT COUNT(DISTINCT al.question_id) FROM answer_log al
                          WHERE al.user_id = $1 AND al.bank_id = b.id),
              'simQuestions', b.sim_questions, 'simMinutes', b.sim_minutes, 'simPassPct', b.sim_pass_pct
            ) ORDER BY cb.sort_order) FILTER (WHERE b.id IS NOT NULL), '[]') AS bancos
       FROM ope_convocatorias c
       LEFT JOIN ope_convocatoria_banks cb ON cb.convocatoria_id = c.id
       LEFT JOIN question_banks b ON b.id = cb.bank_id AND b.visibility = 'publico'
      WHERE c.is_active
      GROUP BY c.id ORDER BY c.anio DESC NULLS LAST, c.name`,
    [req.auth!.sub],
  );
  res.json({ convocatorias: rows });
}
