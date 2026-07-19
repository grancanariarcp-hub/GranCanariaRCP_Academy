import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { renderReconocimiento } from '../services/recognitionPdf.js';
import { componerCuerpo, horasDePractica, reconocerHoras, type Plantilla } from '../services/recognitions.js';
import { r2Configured, buildKey, uploadObject, getObjectBuffer } from '../services/r2.js';

/**
 * Certificados de reconocimiento: configuración (super admin), consulta del
 * interesado y verificación pública.
 */

function frontendBase(): string {
  return (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').replace(/\/$/, '');
}

const plantillaSchema = z.object({
  kind: z.enum(['desafio', 'horas']),
  title: z.string().min(2).max(200),
  bodyTemplate: z.string().min(10),
  frase: z.string().max(400).nullish(),
  certifica: z.string().max(200).nullish(),
  firmante1Nombre: z.string().max(160).nullish(),
  firmante1Cargo: z.string().max(160).nullish(),
  firmante2Nombre: z.string().max(160).nullish(),
  firmante2Cargo: z.string().max(160).nullish(),
  maxPosition: z.number().int().min(1).max(100).nullish(),
  challengeId: z.string().uuid().nullish(),
  thresholdHours: z.number().min(0.5).max(10000).nullish(),
  isActive: z.boolean().optional(),
});

/** GET /api/admin/recognition-templates */
export async function listTemplates(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT t.*, c.title AS challenge_title,
            (SELECT COUNT(*) FROM issued_recognitions i WHERE i.template_id = t.id)::int AS emitidos
       FROM recognition_templates t LEFT JOIN challenges c ON c.id = t.challenge_id
      ORDER BY t.kind, t.threshold_hours NULLS FIRST, t.created_at`,
  );
  res.json({ templates: rows });
}

/** POST /api/admin/recognition-templates */
export async function createTemplate(req: Request, res: Response): Promise<void> {
  const d = plantillaSchema.parse(req.body);
  if (d.kind === 'horas' && !d.thresholdHours) {
    throw badRequest('Indica a partir de cuántas horas se emite', 'FALTA_UMBRAL');
  }
  const { rows } = await query<{ id: string }>(
    `INSERT INTO recognition_templates
       (kind, title, body_template, frase, certifica, firmante1_nombre, firmante1_cargo,
        firmante2_nombre, firmante2_cargo, max_position, challenge_id, threshold_hours, is_active)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,COALESCE($13, TRUE))
     RETURNING id`,
    [
      d.kind, d.title, d.bodyTemplate, d.frase || null, d.certifica || null,
      d.firmante1Nombre || null, d.firmante1Cargo || null, d.firmante2Nombre || null, d.firmante2Cargo || null,
      d.maxPosition ?? null, d.challengeId || null, d.thresholdHours ?? null, d.isActive,
    ],
  );
  res.status(201).json({ id: rows[0].id });
}

/** PATCH /api/admin/recognition-templates/:id */
export async function updateTemplate(req: Request, res: Response): Promise<void> {
  const d = plantillaSchema.partial().parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title, body_template: d.bodyTemplate, frase: d.frase, certifica: d.certifica,
    firmante1_nombre: d.firmante1Nombre, firmante1_cargo: d.firmante1Cargo,
    firmante2_nombre: d.firmante2Nombre, firmante2_cargo: d.firmante2Cargo,
    max_position: d.maxPosition, challenge_id: d.challengeId, threshold_hours: d.thresholdHours,
    is_active: d.isActive,
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
    `UPDATE recognition_templates SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals,
  );
  if (rowCount === 0) throw notFound('Plantilla no encontrada');
  res.json({ ok: true });
}

/** DELETE /api/admin/recognition-templates/:id */
export async function deleteTemplate(req: Request, res: Response): Promise<void> {
  const { rowCount } = await query('DELETE FROM recognition_templates WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw notFound('Plantilla no encontrada');
  res.json({ ok: true });
}

/** POST /api/admin/recognition-templates/:id/background — imagen de fondo. */
export async function uploadTemplateBackground(req: Request, res: Response): Promise<void> {
  if (!r2Configured()) throw badRequest('El almacén no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file) throw badRequest('Falta el archivo', 'NO_FILE');
  const key = buildKey(file.originalname, 'certs');
  await uploadObject(key, file.buffer, file.mimetype);
  await query('UPDATE recognition_templates SET bg_key = $1 WHERE id = $2', [key, req.params.id]);
  res.json({ ok: true });
}

/** GET /api/admin/recognition-templates/:id/preview.pdf */
export async function previewTemplate(req: Request, res: Response): Promise<void> {
  const { rows } = await query<Plantilla>('SELECT * FROM recognition_templates WHERE id = $1', [req.params.id]);
  const p = rows[0];
  if (!p) throw notFound('Plantilla no encontrada');

  await enviarPdf(res, p, {
    nombre: 'Nombre y Apellidos',
    cuerpo: componerCuerpo(p.body_template, {
      nombre: 'Nombre y Apellidos',
      desafio: 'Desafío de ejemplo',
      puesto: p.kind === 'desafio' ? '1.º' : '',
      horas: p.threshold_hours ?? 25,
      fecha: new Date().toLocaleDateString('es-ES'),
    }),
    codigo: 'EJEMPLO',
    emitido: new Date().toLocaleDateString('es-ES'),
  }, false);
}

// ------------------------------------------------------------------ interesado

/** GET /api/profile/recognitions — mis reconocimientos. */
export async function myRecognitions(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT id, code, kind, challenge_title, position, hours, issued_at
       FROM issued_recognitions WHERE subject_id = $1 ORDER BY issued_at DESC`,
    [req.auth!.sub],
  );
  // Además, cuántas horas lleva: da sentido al próximo hito.
  const horas = await horasDePractica(req.auth!.sub);
  const proximo = await query<{ threshold_hours: string; title: string }>(
    `SELECT threshold_hours, title FROM recognition_templates
      WHERE kind = 'horas' AND is_active AND threshold_hours > $1
      ORDER BY threshold_hours LIMIT 1`,
    [horas],
  );
  res.json({
    recognitions: rows,
    horasAcumuladas: Math.round(horas * 10) / 10,
    proximoHito: proximo.rows[0]
      ? { horas: Number(proximo.rows[0].threshold_hours), titulo: proximo.rows[0].title }
      : null,
  });
}

/**
 * POST /api/profile/recognitions/check — comprobar si toca alguno por horas.
 * Se invoca al abrir el perfil: así el hito llega sin depender de un proceso
 * programado.
 */
export async function checkRecognitions(req: Request, res: Response): Promise<void> {
  await reconocerHoras({
    subjectId: req.auth!.sub,
    subjectType: req.auth!.role === 'student' ? 'student' : 'user',
    subjectName: req.auth!.name || 'Participante',
  });
  res.json({ ok: true });
}

// --------------------------------------------------------------------- público

async function cargarEmitido(code: string) {
  const { rows } = await query<{
    code: string; kind: string; subject_name: string; challenge_title: string | null;
    position: number | null; hours: string | null; issued_at: string; template_id: string | null;
  }>(
    'SELECT * FROM issued_recognitions WHERE code = $1',
    [code],
  );
  if (rows.length === 0) throw notFound('Reconocimiento no encontrado');
  return rows[0];
}

/** GET /api/public/recognitions/:code — verificación. */
export async function verifyRecognition(req: Request, res: Response): Promise<void> {
  const r = await cargarEmitido(req.params.code);
  res.json({
    valido: true,
    reconocimiento: {
      titular: r.subject_name,
      motivo: r.kind === 'desafio'
        ? `Participación en «${r.challenge_title}»${r.position ? `, ${r.position}.º puesto` : ''}`
        : `${Number(r.hours)} horas de práctica`,
      emitidoEl: r.issued_at,
      // Se dice explícitamente para que nadie lo tome por formación oficial.
      acreditado: false,
    },
  });
}

/** GET /api/public/recognitions/:code/pdf */
export async function recognitionPdf(req: Request, res: Response): Promise<void> {
  const r = await cargarEmitido(req.params.code);
  const t = await query<Plantilla>('SELECT * FROM recognition_templates WHERE id = $1', [r.template_id]);
  const p = t.rows[0];
  if (!p) throw notFound('La plantilla de este reconocimiento ya no existe');

  await enviarPdf(res, p, {
    nombre: r.subject_name,
    cuerpo: componerCuerpo(p.body_template, {
      nombre: r.subject_name,
      desafio: r.challenge_title ?? '',
      puesto: r.position ? `${r.position}.º` : '',
      horas: r.hours ? Number(r.hours) : '',
      fecha: new Date(r.issued_at).toLocaleDateString('es-ES'),
    }),
    codigo: r.code,
    emitido: new Date(r.issued_at).toLocaleDateString('es-ES'),
  }, true);
}

async function enviarPdf(
  res: Response,
  p: Plantilla,
  datos: { nombre: string; cuerpo: string; codigo: string; emitido: string },
  conQr: boolean,
): Promise<void> {
  const bgBuffer = p.bg_key && r2Configured()
    ? await getObjectBuffer(p.bg_key).catch(() => undefined)
    : undefined;

  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="reconocimiento-${datos.codigo}.pdf"`);
  doc.pipe(res);
  renderReconocimiento(doc, {
    certifica: p.certifica || 'Gran Canaria RCP',
    titulo: p.title,
    nombre: datos.nombre,
    cuerpo: datos.cuerpo,
    frase: p.frase,
    emitido: datos.emitido,
    codigo: datos.codigo,
    firmante1: p.firmante1_nombre ? { nombre: p.firmante1_nombre, cargo: p.firmante1_cargo || '' } : null,
    firmante2: p.firmante2_nombre ? { nombre: p.firmante2_nombre, cargo: p.firmante2_cargo || '' } : null,
    bgBuffer,
    qrBuffer: conQr
      ? await QRCode.toBuffer(`${frontendBase()}/reconocimiento/${datos.codigo}`, { margin: 1, width: 240 })
      : undefined,
  });
  doc.end();
}
