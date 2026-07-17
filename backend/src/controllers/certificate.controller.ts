import type { Request, Response } from 'express';
import PDFDocument from 'pdfkit';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { assertDirector } from '../services/courseAuth.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';
import { r2Configured, getObjectBuffer, buildKey, uploadObject } from '../services/r2.js';
import { renderCertificate, type CertData } from '../services/certificatePdf.js';

function fmt(d: string | Date | null): string {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('es-ES');
  } catch {
    return '';
  }
}

async function courseCertData(courseId: string, studentName: string): Promise<CertData> {
  const { rows } = await query<Record<string, string | null | number>>(
    `SELECT title, modality, duration_hours, starts_at, ends_at, cfc, certifica,
            firmante1_nombre, firmante1_cargo, firmante2_nombre, firmante2_cargo, cert_bg_key, cfc_image_key
     FROM courses WHERE id = $1`,
    [courseId],
  );
  if (rows.length === 0) throw notFound('Curso no encontrado');
  const c = rows[0];

  const start = c.starts_at as string | null;
  const end = c.ends_at as string | null;
  const dateRange = start && end ? `entre ${fmt(start)} y ${fmt(end)}` : start ? `desde ${fmt(start)}` : '';

  let bgBuffer: Buffer | undefined;
  let cfcImgBuffer: Buffer | undefined;
  if (r2Configured()) {
    if (c.cert_bg_key) bgBuffer = await getObjectBuffer(c.cert_bg_key as string).catch(() => undefined);
    if (c.cfc_image_key) cfcImgBuffer = await getObjectBuffer(c.cfc_image_key as string).catch(() => undefined);
  }

  return {
    certifica: (c.certifica as string) || 'Gran Canaria RCP',
    studentName,
    courseTitle: (c.title as string) || '',
    modality: (c.modality as string) || 'online',
    dateRange,
    hours: c.duration_hours != null ? String(c.duration_hours) : '—',
    cfc: c.cfc as string | null,
    firmante1: { nombre: c.firmante1_nombre as string | null, cargo: c.firmante1_cargo as string | null },
    firmante2: { nombre: c.firmante2_nombre as string | null, cargo: c.firmante2_cargo as string | null },
    issued: fmt(new Date()),
    bgBuffer,
    cfcImgBuffer,
  };
}

function streamCert(res: Response, data: CertData): void {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 0 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="certificado-grancanaria-rcp.pdf"');
  doc.pipe(res);
  renderCertificate(doc, data);
  doc.end();
}

// GET /api/courses/:id/certificate/preview — director/super_admin, textos genéricos
export async function previewCertificate(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  streamCert(res, await courseCertData(req.params.id, 'Nombre y Apellidos'));
}

// GET /api/student/courses/:courseId/certificate — solo si aprobó
export async function studentCertificate(req: Request, res: Response): Promise<void> {
  const courseId = req.params.courseId;
  const enr = await query('SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2', [req.auth!.sub, courseId]);
  if (enr.rows.length === 0) throw forbidden('No estás matriculado en este curso');

  const passed = await query(
    `SELECT 1 FROM exam_attempts a JOIN exams e ON e.id = a.exam_id JOIN modules m ON m.id = e.module_id
     WHERE m.course_id = $1 AND a.student_id = $2 AND a.passed = TRUE LIMIT 1`,
    [courseId, req.auth!.sub],
  );
  if (passed.rows.length === 0) throw badRequest('Aún no has aprobado el curso', 'NOT_PASSED');

  const st = await query<{ display_name: string }>('SELECT display_name FROM students WHERE id = $1', [req.auth!.sub]);
  streamCert(res, await courseCertData(courseId, st.rows[0]?.display_name ?? 'Alumno'));
  await audit({ actorId: req.auth!.sub, actorType: 'student', action: 'CERTIFICATE_DOWNLOAD', entity: 'course', entityId: courseId, ip: clientIp(req) });
}

// Subida de imagen de fondo / imagen CFC (director)
async function uploadCertImage(req: Request, res: Response, column: 'cert_bg_key' | 'cfc_image_key'): Promise<void> {
  await assertDirector(req);
  if (!r2Configured()) throw badRequest('El almacén de imágenes no está configurado', 'R2_NOT_CONFIGURED');
  const file = req.file;
  if (!file || !file.mimetype.startsWith('image/')) throw badRequest('Sube una imagen', 'NOT_IMAGE');
  const key = buildKey(file.originalname, 'certs');
  await uploadObject(key, file.buffer, file.mimetype);
  await query(`UPDATE courses SET ${column} = $1, updated_at = NOW() WHERE id = $2`, [key, req.params.id]);
  res.json({ ok: true });
}
export const uploadCertBackground = (req: Request, res: Response) => uploadCertImage(req, res, 'cert_bg_key');
export const uploadCfcImage = (req: Request, res: Response) => uploadCertImage(req, res, 'cfc_image_key');
