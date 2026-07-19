import type { Request, Response } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { assertDirector, assertEditor } from '../services/courseAuth.js';
import { recopilarActa, type ActaSnapshot } from '../services/actaData.js';
import { renderActa } from '../services/actaPdf.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Acta del curso.
 *
 * Antes de cerrarla se puede previsualizar cuantas veces haga falta: ese
 * borrador se calcula en vivo y sale marcado como provisional.
 *
 * Al cerrarla, los datos se congelan en una instantánea con su huella SHA-256.
 * Consultar un acta cerrada NUNCA recalcula nada, de modo que el documento no
 * cambia aunque después se corrija una nota o se dé de baja un alumno. Corregir
 * un acta cerrada no la reescribe: genera una versión nueva del mismo número,
 * con el motivo declarado, para que la corrección quede trazada.
 */

function frontendBase(): string {
  return (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').replace(/\/$/, '');
}

/**
 * Serialización canónica: claves ordenadas en todos los niveles.
 *
 * Postgres almacena JSONB reordenando las claves, de modo que el objeto que se
 * lee de vuelta no es idéntico byte a byte al que se guardó. Sin canonizar, la
 * huella dejaba de cuadrar nada más cerrar el acta y toda acta parecía
 * manipulada.
 */
function canonico(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonico);
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.keys(v as Record<string, unknown>).sort()
        .map((k) => [k, canonico((v as Record<string, unknown>)[k])]),
    );
  }
  return v;
}

const huella = (snapshot: ActaSnapshot): string =>
  createHash('sha256').update(JSON.stringify(canonico(snapshot))).digest('hex');

/** GET /api/courses/:id/acta/preview.pdf — borrador, sin cerrar nada. */
export async function previewActa(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const snapshot = await recopilarActa(req.params.id);

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="acta-borrador.pdf"');
  doc.pipe(res);
  renderActa(doc, {
    snapshot,
    numero: 'PROVISIONAL',
    version: 1,
    hash: '—',
    closedAt: new Date().toISOString(),
    borrador: true,
  });
  doc.end();
}

/** Número correlativo por año: ACTA-2026-000007. */
async function siguienteNumero(anio: number): Promise<string> {
  const { rows } = await query<{ last_no: number }>(
    `INSERT INTO acta_counters (year, last_no) VALUES ($1, 1)
     ON CONFLICT (year) DO UPDATE SET last_no = acta_counters.last_no + 1
     RETURNING last_no`,
    [anio],
  );
  return `ACTA-${anio}-${String(rows[0].last_no).padStart(6, '0')}`;
}

const cerrarSchema = z.object({
  motivo: z.string().max(300).optional(),
});

/**
 * POST /api/courses/:id/acta — cerrar el acta.
 * Solo la dirección del curso: es quien responde de los datos consignados.
 */
export async function cerrarActa(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const courseId = req.params.id;
  const { motivo } = cerrarSchema.parse(req.body ?? {});

  const snapshot = await recopilarActa(courseId);
  if (snapshot.alumnos.length === 0) {
    throw badRequest('No se puede cerrar el acta de un curso sin alumnos matriculados', 'SIN_ALUMNOS');
  }

  // Si ya había acta, la nueva es una versión del MISMO número y exige motivo.
  const previa = await query<{ numero: string; version: number }>(
    'SELECT numero, version FROM course_actas WHERE course_id = $1 ORDER BY version DESC LIMIT 1',
    [courseId],
  );
  const esCorreccion = previa.rows.length > 0;
  if (esCorreccion && !motivo) {
    throw badRequest('Este curso ya tiene acta cerrada. Indica el motivo de la corrección.', 'MOTIVO_REQUERIDO');
  }

  const numero = esCorreccion ? previa.rows[0].numero : await siguienteNumero(new Date().getFullYear());
  const version = esCorreccion ? previa.rows[0].version + 1 : 1;
  const code = randomBytes(6).toString('hex');

  const { rows } = await query<{ id: string; closed_at: string }>(
    `INSERT INTO course_actas (course_id, numero, version, code, snapshot, hash, motivo, closed_by)
     VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8)
     RETURNING id, closed_at`,
    [courseId, numero, version, code, JSON.stringify(snapshot), huella(snapshot), motivo || null, req.auth!.sub],
  );

  await query('UPDATE courses SET acta_closed_at = NOW() WHERE id = $1', [courseId]);

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'ACTA_CLOSED',
    entity: 'course', entityId: courseId, ip: clientIp(req),
    metadata: { numero, version, alumnos: snapshot.alumnos.length, aptos: snapshot.resumen.aptos },
  }).catch(() => { /* el cierre no depende de la auditoría */ });

  res.status(201).json({
    acta: { id: rows[0].id, numero, version, code, closedAt: rows[0].closed_at },
    verifyUrl: `${frontendBase()}/acta/${code}`,
  });
}

/** GET /api/courses/:id/actas — histórico de actas del curso. */
export async function listActas(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { rows } = await query(
    `SELECT a.id, a.numero, a.version, a.code, a.hash, a.motivo, a.closed_at, u.name AS cerrada_por,
            (a.snapshot -> 'resumen') AS resumen
       FROM course_actas a LEFT JOIN users u ON u.id = a.closed_by
      WHERE a.course_id = $1
      ORDER BY a.version DESC`,
    [req.params.id],
  );
  res.json({ actas: rows });
}

async function cargarActa(code: string) {
  const { rows } = await query<{
    id: string; numero: string; version: number; code: string; snapshot: ActaSnapshot; hash: string; closed_at: string;
  }>(
    'SELECT id, numero, version, code, snapshot, hash, closed_at FROM course_actas WHERE code = $1',
    [code],
  );
  if (rows.length === 0) throw notFound('Acta no encontrada');
  return rows[0];
}

/** GET /api/courses/:id/actas/:code.pdf — descargar un acta cerrada. */
export async function actaPdf(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const a = await cargarActa(req.params.code);
  await enviarActa(res, a);
}

/** GET /api/public/actas/:code — verificación pública, sin datos personales. */
export async function verificarActa(req: Request, res: Response): Promise<void> {
  const a = await cargarActa(req.params.code);
  // La huella se recalcula sobre lo guardado: si alguien tocase la fila, deja
  // de cuadrar y la verificación lo delata.
  const intacta = huella(a.snapshot) === a.hash;
  res.json({
    valida: intacta,
    acta: {
      numero: a.numero,
      version: a.version,
      cerradaEl: a.closed_at,
      curso: a.snapshot.curso.titulo,
      periodo: a.snapshot.curso.periodo,
      modalidad: a.snapshot.curso.modalidad,
      horas: a.snapshot.curso.horas,
      acreditacion: a.snapshot.curso.acreditacion,
      cfc: a.snapshot.curso.cfc,
      director: a.snapshot.director,
      // Cifras agregadas: nunca la relación nominal de alumnos.
      matriculados: a.snapshot.resumen.matriculados,
      aptos: a.snapshot.resumen.aptos,
      hash: a.hash,
    },
  });
}

/** Emite el PDF de un acta ya cerrada, con su QR de verificación. */
async function enviarActa(
  res: Response,
  a: { numero: string; version: number; code: string; snapshot: ActaSnapshot; hash: string; closed_at: string },
): Promise<void> {
  // El QR lleva el código corto, no el número: el número es público y
  // predecible, el código no.
  const verifyUrl = `${frontendBase()}/acta/${a.code}`;
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${a.numero}${a.version > 1 ? `-v${a.version}` : ''}.pdf"`);
  doc.pipe(res);
  renderActa(doc, {
    snapshot: a.snapshot,
    numero: a.numero,
    version: a.version,
    hash: a.hash,
    closedAt: a.closed_at,
    verifyUrl,
    qrBuffer: await QRCode.toBuffer(verifyUrl, { margin: 1, width: 260 }),
  });
  doc.end();
}
