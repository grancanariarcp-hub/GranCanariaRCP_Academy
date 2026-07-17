import type { Request, Response } from 'express';
import { randomBytes } from 'node:crypto';
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
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

/** URL pública de la ficha del curso (para el QR del certificado). */
function courseUrl(courseId: string): string {
  const base = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').replace(/\/$/, '');
  return `${base}/curso/${courseId}`;
}

async function courseCertData(courseId: string, studentName: string, qrUrlOverride?: string): Promise<CertData> {
  const { rows } = await query<Record<string, string | null | number>>(
    `SELECT title, modality, duration_hours, starts_at, ends_at, cfc, certifica, acreditacion,
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

  // QR: por defecto a la ficha del curso; para el certificado de un alumno, a su
  // versión digital verificable. Se genera en memoria; no se almacena.
  let qrBuffer: Buffer | undefined;
  const url = qrUrlOverride || courseUrl(courseId);
  if (url.startsWith('http')) {
    qrBuffer = await QRCode.toBuffer(url, { margin: 1, width: 240 }).catch(() => undefined);
  }

  return {
    certifica: (c.certifica as string) || 'Gran Canaria RCP',
    studentName,
    courseTitle: (c.title as string) || '',
    modality: (c.modality as string) || 'online',
    dateRange,
    hours: c.duration_hours != null ? String(c.duration_hours) : '—',
    cfc: c.cfc as string | null,
    acreditacion: c.acreditacion as string | null,
    firmante1: { nombre: c.firmante1_nombre as string | null, cargo: c.firmante1_cargo as string | null },
    firmante2: { nombre: c.firmante2_nombre as string | null, cargo: c.firmante2_cargo as string | null },
    issued: fmt(new Date()),
    bgBuffer,
    cfcImgBuffer,
    qrBuffer,
    qrCaption: 'Programa y verificación',
  };
}

/** URL pública de la versión digital del certificado (por su código). */
function certUrl(code: string): string {
  const base = (process.env.FRONTEND_URL || (process.env.CORS_ORIGIN || '').split(',')[0] || '').replace(/\/$/, '');
  return `${base}/certificado/${code}`;
}

/** Devuelve el código del certificado del alumno para el curso, creándolo si no existe. */
async function getOrCreateCertCode(studentId: string, courseId: string, studentName: string): Promise<string> {
  const existing = await query<{ code: string }>(
    'SELECT code FROM issued_certificates WHERE student_id = $1 AND course_id = $2',
    [studentId, courseId],
  );
  if (existing.rows.length > 0) return existing.rows[0].code;
  const code = randomBytes(6).toString('hex'); // 12 hex chars
  const ins = await query<{ code: string }>(
    `INSERT INTO issued_certificates (code, student_id, course_id, student_name)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (student_id, course_id) DO UPDATE SET student_name = EXCLUDED.student_name
     RETURNING code`,
    [code, studentId, courseId, studentName],
  );
  return ins.rows[0].code;
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
  const name = st.rows[0]?.display_name ?? 'Alumno';
  const code = await getOrCreateCertCode(req.auth!.sub, courseId, name);
  streamCert(res, await courseCertData(courseId, name, certUrl(code)));
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

// ---------------------------------------------------------------------------
// Verificación pública del certificado digital (por código, sin auth)
// ---------------------------------------------------------------------------
async function loadIssued(code: string): Promise<{ course_id: string; student_name: string; issued_at: string }> {
  const { rows } = await query<{ course_id: string; student_name: string; issued_at: string }>(
    'SELECT course_id, student_name, issued_at FROM issued_certificates WHERE code = $1',
    [code],
  );
  if (rows.length === 0) throw notFound('Certificado no encontrado');
  return rows[0];
}

// GET /api/public/certificates/:code — datos de la versión digital + programa
export async function getPublicCertificate(req: Request, res: Response): Promise<void> {
  const c = await loadIssued(req.params.code);
  const course = await query<Record<string, string | null | number>>(
    `SELECT id, title, modality, duration_hours, starts_at, ends_at, cfc, certifica, acreditacion,
            firmante1_nombre, firmante1_cargo, firmante2_nombre, firmante2_cargo
     FROM courses WHERE id = $1`,
    [c.course_id],
  );
  if (course.rows.length === 0) throw notFound('Curso no encontrado');
  const co = course.rows[0];
  const program = await query(
    `SELECT m.title,
            COALESCE(json_agg(json_build_object('type', a.type, 'title', a.title) ORDER BY a.sort_order)
                     FILTER (WHERE a.id IS NOT NULL), '[]') AS activities
     FROM modules m LEFT JOIN activities a ON a.module_id = m.id
     WHERE m.course_id = $1 GROUP BY m.id, m.title, m.sort_order ORDER BY m.sort_order`,
    [c.course_id],
  );
  const start = co.starts_at as string | null;
  const end = co.ends_at as string | null;
  res.json({
    certificate: {
      code: req.params.code,
      studentName: c.student_name,
      courseId: co.id,
      courseTitle: co.title,
      modality: co.modality,
      hours: co.duration_hours,
      dateRange: start && end ? `entre ${fmt(start)} y ${fmt(end)}` : start ? `desde ${fmt(start)}` : '',
      cfc: co.cfc,
      acreditacion: co.acreditacion,
      certifica: co.certifica || 'Gran Canaria RCP',
      firmante1: { nombre: co.firmante1_nombre, cargo: co.firmante1_cargo },
      firmante2: { nombre: co.firmante2_nombre, cargo: co.firmante2_cargo },
      issued: fmt(c.issued_at),
    },
    program: program.rows,
  });
}

// GET /api/public/certificates/:code/pdf — regenera el PDF (mismo diseño + QR)
export async function publicCertificatePdf(req: Request, res: Response): Promise<void> {
  const c = await loadIssued(req.params.code);
  streamCert(res, await courseCertData(c.course_id, c.student_name, certUrl(req.params.code)));
}
