import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { r2Configured, buildKey, uploadObject, presignedGetUrl } from '../services/r2.js';

const metaSchema = z.object({
  title: z.string().min(2).max(200),
  kind: z.enum(['erc', 'pnrcp', 'otro']).default('otro'),
  pages: z.coerce.number().int().positive().optional(),
});

/**
 * POST /api/admin/documents  (multipart: file + title + kind)
 * Uploads a reference PDF to R2 and stores its metadata.
 */
export async function uploadDocument(req: Request, res: Response): Promise<void> {
  if (!r2Configured()) {
    throw badRequest('El almacén R2 no está configurado en el servidor', 'R2_NOT_CONFIGURED');
  }
  const file = req.file;
  if (!file) throw badRequest('Falta el archivo PDF', 'NO_FILE');
  if (file.mimetype !== 'application/pdf') {
    throw badRequest('El archivo debe ser un PDF', 'NOT_PDF');
  }

  const { title, kind, pages } = metaSchema.parse(req.body);

  const key = buildKey(file.originalname);
  await uploadObject(key, file.buffer, file.mimetype);

  const { rows } = await query(
    `INSERT INTO documents (title, kind, storage_key, content_type, size_bytes, pages, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id, title, kind, size_bytes, pages, created_at`,
    [title, kind, key, file.mimetype, file.size, pages ?? null, req.auth!.sub],
  );

  await audit({
    actorId: req.auth!.sub,
    actorType: req.auth!.role,
    action: 'DOCUMENT_UPLOAD',
    entity: 'document',
    entityId: rows[0].id,
    ip: clientIp(req),
    metadata: { title, kind, sizeBytes: file.size },
  });

  res.status(201).json({ document: rows[0] });
}

/** GET /api/admin/documents -> list reference documents. */
export async function listDocuments(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, title, kind, size_bytes, pages, (storage_key IS NOT NULL) AS has_file, created_at
     FROM documents WHERE is_active = TRUE
     ORDER BY created_at DESC`,
  );
  res.json({ documents: rows });
}

/**
 * GET /api/admin/documents/:id/url?page=N -> short-lived link to view the PDF.
 * The #page anchor makes the browser open the viewer at that page.
 */
export async function getDocumentUrl(req: Request, res: Response): Promise<void> {
  const { rows } = await query<{ storage_key: string | null }>(
    'SELECT storage_key FROM documents WHERE id = $1',
    [req.params.id],
  );
  if (rows.length === 0) throw notFound('Documento no encontrado');
  const key = rows[0].storage_key;
  if (!key) throw badRequest('Este documento aún no tiene un PDF subido', 'NO_FILE');

  const url = await presignedGetUrl(key, 600);
  const page = Number(req.query.page);
  res.json({ url: Number.isInteger(page) && page > 0 ? `${url}#page=${page}` : url });
}
