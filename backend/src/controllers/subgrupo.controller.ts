import type { Request, Response } from 'express';
import { z } from 'zod';
import { assertEditor } from '../services/courseAuth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import * as subgrupos from '../services/subgrupos.js';
import { badRequest } from '../utils/httpError.js';

/** GET /api/courses/:id/subgrupos — subgrupos del curso y colores disponibles. */
export const listarSubgrupos = asyncHandler(async (req: Request, res: Response) => {
  await assertEditor(req);
  res.json({
    subgrupos: await subgrupos.listar(req.params.id),
    roster: await subgrupos.roster(req.params.id),
    colores: subgrupos.COLORES,
  });
});

const autoSchema = z.object({
  numSubgrupos: z.number().int().min(1).max(8).optional(),
  porSubgrupo: z.number().int().min(1).max(200).optional(),
  usarColores: z.boolean().optional().default(true),
}).refine((d) => d.numSubgrupos || d.porSubgrupo, {
  message: 'Indica cuántos subgrupos o cuántas personas por subgrupo',
});

/** POST /api/courses/:id/subgrupos/auto — reparto aleatorio equilibrado. */
export const repartirSubgrupos = asyncHandler(async (req: Request, res: Response) => {
  await assertEditor(req);
  const d = autoSchema.parse(req.body);
  try {
    res.json({ subgrupos: await subgrupos.repartirAutomatico(req.params.id, d) });
  } catch (e) {
    throw badRequest(e instanceof Error ? e.message : 'No se pudo repartir', 'REPARTO_FALLIDO');
  }
});

/** POST /api/courses/:id/subgrupos — crear un subgrupo vacío (reparto manual). */
export const crearSubgrupo = asyncHandler(async (req: Request, res: Response) => {
  await assertEditor(req);
  const d = z.object({
    nombre: z.string().min(1).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish(),
  }).parse(req.body);
  res.json({ subgrupo: await subgrupos.crear(req.params.id, d.nombre, d.color ?? null) });
});

/** PATCH /api/courses/:id/subgrupos/asignar — asignar un alumno a un subgrupo. */
export const asignarAlumno = asyncHandler(async (req: Request, res: Response) => {
  await assertEditor(req);
  const d = z.object({
    enrollmentId: z.string().uuid(),
    subgroupId: z.string().uuid().nullable(),
  }).parse(req.body);
  await subgrupos.asignar(req.params.id, d.enrollmentId, d.subgroupId);
  res.json({ ok: true });
});

/** DELETE /api/courses/:id/subgrupos/:subgroupId */
export const eliminarSubgrupo = asyncHandler(async (req: Request, res: Response) => {
  await assertEditor(req);
  await subgrupos.eliminar(req.params.id, req.params.subgroupId);
  res.json({ ok: true });
});
