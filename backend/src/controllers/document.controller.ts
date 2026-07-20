import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { r2Configured, buildKey, uploadObject, presignedGetUrl, deleteObject } from '../services/r2.js';

/**
 * Espacio consumido y disponible por el autor. El super admin no tiene tope
 * real: administra la plataforma.
 */
export async function cuotaDe(userId: string): Promise<{ usadoBytes: number; limiteMb: number; documentos: number }> {
  const { rows } = await query<{ usado: string; docs: string; limite: number }>(
    `SELECT COALESCE(SUM(d.size_bytes), 0) AS usado,
            COUNT(d.id)                    AS docs,
            (SELECT storage_quota_mb FROM users WHERE id = $1) AS limite
       FROM documents d
      WHERE d.uploaded_by = $1 AND d.is_active = TRUE`,
    [userId],
  );
  return {
    usadoBytes: Number(rows[0]?.usado ?? 0),
    documentos: Number(rows[0]?.docs ?? 0),
    limiteMb: Number(rows[0]?.limite ?? 500),
  };
}

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

  // La franja gratuita se comprueba ANTES de subir: si no, se pagaría el
  // almacenamiento de un fichero que luego hay que rechazar.
  const cuota = await cuotaDe(req.auth!.sub);
  const limiteBytes = cuota.limiteMb * 1024 * 1024;
  if (cuota.usadoBytes + file.size > limiteBytes) {
    const libresMb = Math.max(0, (limiteBytes - cuota.usadoBytes) / (1024 * 1024));
    throw badRequest(
      `Has agotado tu espacio (${cuota.limiteMb} MB). Te quedan ${libresMb.toFixed(1)} MB libres y este archivo ocupa ` +
      `${(file.size / (1024 * 1024)).toFixed(1)} MB. Borra algún documento o solicita ampliación.`,
      'QUOTA_EXCEEDED',
    );
  }

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
export async function listDocuments(req: Request, res: Response): Promise<void> {
  const esSuper = req.auth!.role === 'super_admin';
  // El profesorado ve SUS documentos y los que publica la plataforma; no los
  // de otros profesores, que son material propio de sus cursos.
  const { rows } = await query(
    esSuper
      ? `SELECT d.id, d.title, d.kind, d.size_bytes, d.pages, (d.storage_key IS NOT NULL) AS has_file,
                d.created_at, d.uploaded_by, TRUE AS mio
           FROM documents d WHERE d.is_active = TRUE ORDER BY d.created_at DESC`
      : `SELECT d.id, d.title, d.kind, d.size_bytes, d.pages, (d.storage_key IS NOT NULL) AS has_file,
                d.created_at, d.uploaded_by, (d.uploaded_by = $1) AS mio
           FROM documents d
           LEFT JOIN users u ON u.id = d.uploaded_by
          WHERE d.is_active = TRUE AND (d.uploaded_by = $1 OR u.role = 'super_admin')
          ORDER BY d.created_at DESC`,
    esSuper ? [] : [req.auth!.sub],
  );
  const cuota = await cuotaDe(req.auth!.sub);
  res.json({
    documents: rows,
    cuota: {
      usadoBytes: cuota.usadoBytes,
      limiteMb: cuota.limiteMb,
      ilimitada: esSuper,
      pct: esSuper ? 0 : Math.min(100, Math.round((cuota.usadoBytes / (cuota.limiteMb * 1024 * 1024)) * 100)),
    },
  });
}

/** DELETE /api/documents/:id — borrar un documento propio para liberar espacio. */
export async function deleteDocument(req: Request, res: Response): Promise<void> {
  const esSuper = req.auth!.role === 'super_admin';
  const { rows } = await query<{ uploaded_by: string | null; storage_key: string | null }>(
    'SELECT uploaded_by, storage_key FROM documents WHERE id = $1 AND is_active = TRUE',
    [req.params.id],
  );
  if (rows.length === 0) throw notFound('Documento no encontrado');
  if (!esSuper && rows[0].uploaded_by !== req.auth!.sub) {
    throw badRequest('Solo puedes borrar los documentos que has subido tú', 'NOT_OWNER');
  }
  const usado = await query('SELECT 1 FROM activities WHERE document_id = $1 LIMIT 1', [req.params.id]);
  if (usado.rows.length > 0) {
    throw badRequest('Este documento se usa en una actividad de un curso; quítalo de ahí primero', 'IN_USE');
  }

  // Se marca inactivo y se libera el objeto de R2: el espacio debe recuperarse
  // de verdad, no solo en la lista.
  await query('UPDATE documents SET is_active = FALSE WHERE id = $1', [req.params.id]);
  if (rows[0].storage_key) await deleteObject(rows[0].storage_key).catch(() => { /* ya borrado */ });
  res.json({ ok: true });
}

/**
 * GET /api/admin/documents/:id/url?page=N -> short-lived link to view the PDF.
 * The #page anchor makes the browser open the viewer at that page.
 */
export async function getDocumentUrl(req: Request, res: Response): Promise<void> {
  // Esta ruta ES la frontera de acceso al almacén: devuelve un enlace firmado
  // con el que cualquiera puede descargar el fichero durante diez minutos. Las
  // claves del almacén no se pueden adivinar, así que quien controle quién
  // recibe el enlace controla quién lee el documento. Se listaban ya con la
  // regla correcta y se borraban con la regla correcta, pero aquí no había
  // ninguna: con el identificador bastaba para descargar el material privado
  // de otro profesor.
  const esSuper = req.auth!.role === 'super_admin' || req.auth!.role === 'auditor';
  const { rows } = await query<{ storage_key: string | null }>(
    esSuper
      ? 'SELECT d.storage_key FROM documents d WHERE d.id = $1'
      : `SELECT d.storage_key FROM documents d
           LEFT JOIN users u ON u.id = d.uploaded_by
          WHERE d.id = $1 AND (d.uploaded_by = $2 OR u.role = 'super_admin')`,
    esSuper ? [req.params.id] : [req.params.id, req.auth!.sub],
  );
  if (rows.length === 0) throw notFound('Documento no encontrado');
  const key = rows[0].storage_key;
  if (!key) throw badRequest('Este documento aún no tiene un PDF subido', 'NO_FILE');

  const url = await presignedGetUrl(key, 600);
  const page = Number(req.query.page);
  res.json({ url: Number.isInteger(page) && page > 0 ? `${url}#page=${page}` : url });
}
