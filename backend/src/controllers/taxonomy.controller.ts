import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, conflict } from '../utils/httpError.js';

/**
 * Editable dropdowns (temas / subtemas / públicos objetivo).
 * Everyone on staff can read them; only super_admin edits.
 */
export async function listTaxonomies(_req: Request, res: Response): Promise<void> {
  const { rows } = await query<{ id: string; kind: string; label: string; sort_order: number }>(
    'SELECT id, kind, label, sort_order FROM taxonomies WHERE is_active = TRUE ORDER BY kind, sort_order, label',
  );
  res.json({
    temas: rows.filter((r) => r.kind === 'tema'),
    subtemas: rows.filter((r) => r.kind === 'subtema'),
    publicos: rows.filter((r) => r.kind === 'publico'),
  });
}

const createSchema = z.object({
  kind: z.enum(['tema', 'subtema', 'publico']),
  label: z.string().min(2).max(120),
  sortOrder: z.number().int().optional().default(0),
});

export async function createTaxonomy(req: Request, res: Response): Promise<void> {
  const { kind, label, sortOrder } = createSchema.parse(req.body);
  const existing = await query('SELECT 1 FROM taxonomies WHERE kind = $1 AND label = $2', [kind, label]);
  if (existing.rows.length > 0) throw conflict('Ya existe ese valor', 'TAXONOMY_EXISTS');
  const { rows } = await query(
    'INSERT INTO taxonomies (kind, label, sort_order) VALUES ($1, $2, $3) RETURNING id, kind, label, sort_order',
    [kind, label, sortOrder],
  );
  res.status(201).json({ taxonomy: rows[0] });
}

const updateSchema = z.object({
  label: z.string().min(2).max(120).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

export async function updateTaxonomy(req: Request, res: Response): Promise<void> {
  const data = updateSchema.parse(req.body);
  const fields: string[] = [];
  const params: unknown[] = [];
  if (data.label !== undefined) { params.push(data.label); fields.push(`label = $${params.length}`); }
  if (data.sortOrder !== undefined) { params.push(data.sortOrder); fields.push(`sort_order = $${params.length}`); }
  if (data.isActive !== undefined) { params.push(data.isActive); fields.push(`is_active = $${params.length}`); }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE taxonomies SET ${fields.join(', ')} WHERE id = $${params.length} RETURNING id, kind, label, sort_order, is_active`,
    params,
  );
  res.json({ taxonomy: rows[0] ?? null });
}
