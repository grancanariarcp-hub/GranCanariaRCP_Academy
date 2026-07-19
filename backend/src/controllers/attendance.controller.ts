import type { Request, Response } from 'express';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { assertEditor } from '../services/courseAuth.js';

/**
 * Asistencia presencial.
 *
 * El QR que proyecta el profesor NO contiene un identificador fijo: contiene un
 * token HMAC que caduca cada pocos segundos. Así una foto del QR reenviada por
 * mensajería deja de servir casi al instante, que es la vía habitual de fichar
 * sin estar en el aula.
 *
 * El alumno escanea una vez para la entrada y otra para la salida. La salida no
 * se acepta antes de la permanencia mínima de la jornada, para que entrada y
 * salida seguidas no puedan constar como asistencia completa.
 */

/** Token del QR: caduca al cambiar de franja. */
function qrToken(secret: string, sessionId: string, windowSeconds: number, offset = 0): string {
  const slot = Math.floor(Date.now() / 1000 / windowSeconds) + offset;
  return createHmac('sha256', secret).update(`${sessionId}.${slot}`).digest('hex').slice(0, 16);
}

/** Acepta la franja actual y la anterior: cubre el tiempo de escaneo. */
function tokenIsValid(token: string, secret: string, sessionId: string, windowSeconds: number): boolean {
  const buf = Buffer.from(token);
  for (const offset of [0, -1]) {
    const expected = Buffer.from(qrToken(secret, sessionId, windowSeconds, offset));
    if (buf.length === expected.length && timingSafeEqual(buf, expected)) return true;
  }
  return false;
}

interface SessionRow {
  id: string;
  course_id: string;
  title: string;
  session_date: string;
  min_minutes: number;
  qr_secret: string;
  qr_window_seconds: number;
  is_open: boolean;
}

// ---------------------------------------------------------------- profesorado

const createSchema = z.object({
  title: z.string().min(2).max(200),
  sessionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)'),
  activityId: z.string().uuid().nullish(),
  startsAt: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  endsAt: z.string().regex(/^\d{2}:\d{2}$/).nullish(),
  minMinutes: z.number().int().min(0).max(600).optional(),
  qrWindowSeconds: z.number().int().min(15).max(300).optional(),
});

/** POST /api/courses/:id/attendance/sessions — crear jornada presencial. */
export async function createAttendanceSession(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = createSchema.parse(req.body);
  const { rows } = await query<{ id: string }>(
    `INSERT INTO attendance_sessions
       (course_id, activity_id, title, session_date, starts_at, ends_at, min_minutes, qr_window_seconds, qr_secret, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
    [
      req.params.id,
      d.activityId || null,
      d.title,
      d.sessionDate,
      d.startsAt || null,
      d.endsAt || null,
      d.minMinutes ?? 30,
      d.qrWindowSeconds ?? 45,
      randomBytes(24).toString('hex'),
      req.auth!.sub,
    ],
  );
  res.status(201).json({ id: rows[0].id });
}

/** GET /api/courses/:id/attendance/sessions — jornadas con su recuento. */
export async function listAttendanceSessions(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { rows } = await query(
    `SELECT s.id, s.title, s.session_date, s.starts_at, s.ends_at, s.min_minutes,
            s.qr_window_seconds, s.is_open, s.activity_id,
            COUNT(r.id) FILTER (WHERE r.check_in_at IS NOT NULL)::int  AS entradas,
            COUNT(r.id) FILTER (WHERE r.check_out_at IS NOT NULL)::int AS salidas
       FROM attendance_sessions s
       LEFT JOIN attendance_records r ON r.session_id = s.id
      WHERE s.course_id = $1
      GROUP BY s.id
      ORDER BY s.session_date DESC, s.starts_at NULLS LAST`,
    [req.params.id],
  );
  res.json({ sessions: rows });
}

const updateSchema = createSchema.partial().extend({ isOpen: z.boolean().optional() });

/** PATCH /api/courses/:id/attendance/sessions/:sessionId */
export async function updateAttendanceSession(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const d = updateSchema.parse(req.body);
  const map: Record<string, unknown> = {
    title: d.title,
    session_date: d.sessionDate,
    starts_at: d.startsAt,
    ends_at: d.endsAt,
    min_minutes: d.minMinutes,
    qr_window_seconds: d.qrWindowSeconds,
    is_open: d.isOpen,
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    vals.push(val);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) throw badRequest('Nada que actualizar');
  vals.push(req.params.sessionId, req.params.id);
  const { rowCount } = await query(
    `UPDATE attendance_sessions SET ${sets.join(', ')}
      WHERE id = $${vals.length - 1} AND course_id = $${vals.length}`,
    vals,
  );
  if (rowCount === 0) throw notFound('Jornada no encontrada');
  res.json({ ok: true });
}

/** DELETE /api/courses/:id/attendance/sessions/:sessionId */
export async function deleteAttendanceSession(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const { rowCount } = await query(
    'DELETE FROM attendance_sessions WHERE id = $1 AND course_id = $2',
    [req.params.sessionId, req.params.id],
  );
  if (rowCount === 0) throw notFound('Jornada no encontrada');
  res.json({ ok: true });
}

async function loadSession(sessionId: string, courseId?: string): Promise<SessionRow> {
  const { rows } = await query<SessionRow>(
    `SELECT id, course_id, title, session_date, min_minutes, qr_secret, qr_window_seconds, is_open
       FROM attendance_sessions WHERE id = $1`,
    [sessionId],
  );
  const s = rows[0];
  if (!s || (courseId && s.course_id !== courseId)) throw notFound('Jornada no encontrada');
  return s;
}

/**
 * GET /api/courses/:id/attendance/sessions/:sessionId/qr
 * Token vigente para pintar el QR. La pantalla del profesor lo repide sola.
 */
export async function attendanceQrToken(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const s = await loadSession(req.params.sessionId, req.params.id);
  if (!s.is_open) throw badRequest('La jornada está cerrada');
  const token = qrToken(s.qr_secret, s.id, s.qr_window_seconds);
  res.json({
    // Lo que se codifica en el QR; el alumno lo abre desde su perfil.
    payload: `${s.id}:${token}`,
    expiresInSeconds: s.qr_window_seconds - (Math.floor(Date.now() / 1000) % s.qr_window_seconds),
    windowSeconds: s.qr_window_seconds,
    title: s.title,
  });
}

/** GET /api/courses/:id/attendance/sessions/:sessionId/records — lista de clase. */
export async function listAttendanceRecords(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  await loadSession(req.params.sessionId, req.params.id);
  const { rows } = await query(
    `SELECT st.id AS student_id, st.display_name, st.apellidos, st.nombre, st.dni,
            r.check_in_at, r.check_out_at, r.in_method, r.out_method, r.incidencia
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       LEFT JOIN attendance_records r ON r.student_id = st.id AND r.session_id = $2
      WHERE e.course_id = $1
      ORDER BY COALESCE(st.apellidos, st.display_name), st.nombre NULLS FIRST`,
    [req.params.id, req.params.sessionId],
  );
  res.json({ records: rows });
}

const manualSchema = z.object({
  action: z.enum(['in', 'out', 'clear']),
  incidencia: z.string().max(200).nullish(),
});

/**
 * POST /api/courses/:id/attendance/sessions/:sessionId/records/:studentId
 * Registro manual del profesor: un clic por alumno.
 */
export async function markAttendanceManually(req: Request, res: Response): Promise<void> {
  await assertEditor(req);
  const s = await loadSession(req.params.sessionId, req.params.id);
  const d = manualSchema.parse(req.body);
  const studentId = req.params.studentId;

  const enrolled = await query(
    'SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2',
    [s.course_id, studentId],
  );
  if (enrolled.rowCount === 0) throw badRequest('El alumno no está matriculado en el curso');

  if (d.action === 'clear') {
    await query('DELETE FROM attendance_records WHERE session_id = $1 AND student_id = $2', [s.id, studentId]);
    res.json({ ok: true, estado: 'sin_registro' });
    return;
  }

  const col = d.action === 'in' ? 'check_in_at' : 'check_out_at';
  const methodCol = d.action === 'in' ? 'in_method' : 'out_method';
  await query(
    `INSERT INTO attendance_records (session_id, student_id, ${col}, ${methodCol}, marked_by, incidencia)
     VALUES ($1,$2,NOW(),'manual',$3,$4)
     ON CONFLICT (session_id, student_id) DO UPDATE
       SET ${col} = NOW(), ${methodCol} = 'manual', marked_by = $3,
           incidencia = COALESCE($4, attendance_records.incidencia)`,
    [s.id, studentId, req.auth!.sub, d.incidencia || null],
  );
  res.json({ ok: true, estado: d.action === 'in' ? 'entrada' : 'salida' });
}

// -------------------------------------------------------------------- alumnos

/** GET /api/student/attendance — jornadas presenciales de mis cursos. */
export async function myAttendance(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT s.id, s.title, s.session_date, s.starts_at, s.ends_at, s.is_open, s.min_minutes,
            c.id AS course_id, c.title AS course_title,
            r.check_in_at, r.check_out_at
       FROM attendance_sessions s
       JOIN courses c ON c.id = s.course_id
       JOIN enrollments e ON e.course_id = c.id AND e.student_id = $1
       LEFT JOIN attendance_records r ON r.session_id = s.id AND r.student_id = $1
      ORDER BY s.session_date DESC, s.starts_at NULLS LAST`,
    [req.auth!.sub],
  );
  res.json({ sessions: rows });
}

/**
 * GET /api/student/attendance/scan?payload=... — qué pasará al confirmar.
 * Alimenta la ventana de confirmación ("vas a registrar tu entrada, ¿confirmas?")
 * sin registrar nada todavía.
 */
export async function previewScan(req: Request, res: Response): Promise<void> {
  const { session, record } = await resolveScan(req, String(req.query.payload || ''));
  const accion = !record?.check_in_at ? 'entrada' : !record.check_out_at ? 'salida' : 'completa';
  let bloqueo: string | null = null;
  if (accion === 'salida') {
    const minutos = (Date.now() - new Date(record!.check_in_at!).getTime()) / 60000;
    if (minutos < session.min_minutes) {
      bloqueo = `Debes permanecer al menos ${session.min_minutes} minutos. Llevas ${Math.floor(minutos)}.`;
    }
  }
  res.json({
    accion,
    bloqueo,
    sesion: { id: session.id, title: session.title, fecha: session.session_date },
  });
}

/** POST /api/student/attendance/scan — registra entrada o salida. */
export async function scanAttendance(req: Request, res: Response): Promise<void> {
  const payload = z.object({ payload: z.string().min(10) }).parse(req.body).payload;
  const { session, record } = await resolveScan(req, payload);
  const studentId = req.auth!.sub;

  if (!record?.check_in_at) {
    await query(
      `INSERT INTO attendance_records (session_id, student_id, check_in_at, in_method)
       VALUES ($1,$2,NOW(),'qr')
       ON CONFLICT (session_id, student_id) DO UPDATE SET check_in_at = NOW(), in_method = 'qr'`,
      [session.id, studentId],
    );
    res.json({ ok: true, accion: 'entrada', mensaje: 'Entrada registrada' });
    return;
  }

  if (record.check_out_at) throw badRequest('Ya registraste entrada y salida en esta jornada', 'ALREADY_DONE');

  const minutos = (Date.now() - new Date(record.check_in_at).getTime()) / 60000;
  if (minutos < session.min_minutes) {
    throw badRequest(
      `Aún no puedes registrar la salida: se requieren ${session.min_minutes} minutos de permanencia.`,
      'TOO_EARLY',
    );
  }
  await query(
    `UPDATE attendance_records SET check_out_at = NOW(), out_method = 'qr'
      WHERE session_id = $1 AND student_id = $2`,
    [session.id, studentId],
  );
  res.json({ ok: true, accion: 'salida', mensaje: 'Salida registrada' });
}

/** Valida el QR y devuelve la jornada y el registro actual del alumno. */
async function resolveScan(
  req: Request,
  payload: string,
): Promise<{ session: SessionRow; record: { check_in_at: string | null; check_out_at: string | null } | null }> {
  const [sessionId, token] = payload.split(':');
  if (!sessionId || !token) throw badRequest('Código QR no válido', 'BAD_QR');

  const session = await loadSession(sessionId);
  if (!session.is_open) throw badRequest('La jornada está cerrada', 'CLOSED');
  if (!tokenIsValid(token, session.qr_secret, session.id, session.qr_window_seconds)) {
    throw badRequest('El código ha caducado. Vuelve a escanear el QR de la pantalla.', 'EXPIRED');
  }

  const enrolled = await query(
    'SELECT 1 FROM enrollments WHERE course_id = $1 AND student_id = $2',
    [session.course_id, req.auth!.sub],
  );
  if (enrolled.rowCount === 0) throw forbidden('No estás matriculado en este curso');

  const { rows } = await query<{ check_in_at: string | null; check_out_at: string | null }>(
    'SELECT check_in_at, check_out_at FROM attendance_records WHERE session_id = $1 AND student_id = $2',
    [session.id, req.auth!.sub],
  );
  return { session, record: rows[0] ?? null };
}
