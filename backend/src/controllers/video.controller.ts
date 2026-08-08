import type { Request, Response } from 'express';
import { z } from 'zod';
import { AccessToken } from 'livekit-server-sdk';
import { query } from '../config/database.js';
import { env } from '../config/env.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';

/**
 * Videoconferencia dentro del campus (LiveKit).
 *
 * Cada actividad de tipo «videoconferencia» es una sala. El backend solo emite
 * el token de acceso (nunca expone el secreto) y guarda la asistencia; el vídeo
 * viaja por el SFU de LiveKit, no por aquí. Si LiveKit no está configurado, se
 * responde con un aviso claro y la app sigue funcionando.
 */

interface Acceso {
  courseId: string;
  camaraObligatoria: boolean;
  salaAbierta: boolean;
  esProfesor: boolean;
}

/** Resuelve el curso de la actividad y si esta persona puede entrar y con qué rol. */
async function accesoActividad(req: Request): Promise<Acceso> {
  const { rows } = await query<{ course_id: string; type: string; camara_obligatoria: boolean; sala_abierta: boolean }>(
    `SELECT m.course_id, a.type, a.camara_obligatoria, a.sala_abierta
       FROM activities a JOIN modules m ON m.id = a.module_id
      WHERE a.id = $1`,
    [req.params.activityId],
  );
  if (rows.length === 0) throw notFound('Actividad no encontrada');
  if (rows[0].type !== 'videoconferencia') throw badRequest('Esta actividad no es una videoconferencia', 'NO_ES_VIDEO');
  const courseId = rows[0].course_id;

  if (req.auth!.role === 'student') {
    const m = await query(
      "SELECT 1 FROM enrollments WHERE student_id = $1 AND course_id = $2 AND status <> 'pendiente_pago'",
      [req.auth!.sub, courseId],
    );
    if (m.rows.length === 0) throw forbidden('No estás matriculado en este curso');
    return { courseId, camaraObligatoria: rows[0].camara_obligatoria, salaAbierta: rows[0].sala_abierta, esProfesor: false };
  }

  // Staff: el super admin siempre; el resto, si forma parte del curso.
  if (req.auth!.role !== 'super_admin') {
    const s = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [courseId, req.auth!.sub]);
    if (s.rows.length === 0) throw forbidden('No formas parte de este curso');
  }
  return { courseId, camaraObligatoria: rows[0].camara_obligatoria, salaAbierta: rows[0].sala_abierta, esProfesor: true };
}

/**
 * GET /api/video/:activityId/sala — datos de la sala para el reproductor
 * (Jitsi en la fase 1). No necesita LiveKit; solo comprueba el acceso.
 */
export async function videoSala(req: Request, res: Response): Promise<void> {
  const acc = await accesoActividad(req);
  if (!acc.salaAbierta && !acc.esProfesor) throw forbidden('La sala está cerrada por el profesor');
  res.json({
    // Nombre de sala único y difícil de adivinar (incluye el id de la actividad).
    room: `grancanariarcp-${req.params.activityId}`,
    rol: acc.esProfesor ? 'profesor' : 'alumno',
    nombre: req.auth!.name || 'Participante',
    camaraObligatoria: acc.camaraObligatoria,
  });
}

/** POST /api/video/:activityId/token — token de acceso a la sala. */
export async function videoToken(req: Request, res: Response): Promise<void> {
  if (!env.livekit.configured) {
    res.status(503).json({ error: 'La videoconferencia todavía no está configurada en el servidor.', code: 'LIVEKIT_NOT_CONFIGURED' });
    return;
  }
  const acc = await accesoActividad(req);
  if (!acc.salaAbierta && !acc.esProfesor) throw forbidden('La sala está cerrada por el profesor');

  const room = `act-${req.params.activityId}`;
  const tipo = req.auth!.role === 'student' ? 'student' : 'user';
  const identity = `${tipo}:${req.auth!.sub}`;
  const nombre = req.auth!.name || 'Participante';
  const rol = acc.esProfesor ? 'profesor' : 'alumno';

  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity,
    name: nombre,
    metadata: JSON.stringify({ rol }),
  });
  at.addGrant({
    roomJoin: true,
    room,
    canPublish: true,
    canSubscribe: true,
    // El profesor puede moderar (silenciar/expulsar); el alumno no.
    roomAdmin: acc.esProfesor,
  });
  const token = await at.toJwt();

  res.json({
    token,
    url: env.livekit.url,
    room,
    rol,
    camaraObligatoria: acc.camaraObligatoria,
  });
}

const heartbeatSchema = z.object({ camaraOn: z.boolean().optional() });

/** POST /api/video/:activityId/heartbeat — marca presencia y acumula tiempo. */
export async function videoHeartbeat(req: Request, res: Response): Promise<void> {
  const acc = await accesoActividad(req);
  const { camaraOn } = heartbeatSchema.parse(req.body ?? {});
  const tipo = req.auth!.role === 'student' ? 'student' : 'user';
  const rol = acc.esProfesor ? 'profesor' : 'alumno';

  const { rows } = await query<{ segundos: number }>(
    `INSERT INTO video_attendance (activity_id, user_type, user_id, nombre, rol, camara_on)
       VALUES ($1,$2,$3,$4,$5,$6)
     ON CONFLICT (activity_id, user_type, user_id) DO UPDATE SET
       last_seen_at = NOW(),
       camara_on = EXCLUDED.camara_on,
       nombre = EXCLUDED.nombre,
       -- Suma el tiempo desde el último latido, con tope de 60s para que un
       -- cierre brusco no infle el total.
       segundos = video_attendance.segundos + LEAST(EXTRACT(EPOCH FROM (NOW() - video_attendance.last_seen_at))::int, 60)
     RETURNING segundos`,
    [req.params.activityId, tipo, req.auth!.sub, req.auth!.name || null, rol, camaraOn ?? false],
  );
  res.json({ ok: true, segundos: rows[0]?.segundos ?? 0 });
}

/** GET /api/video/:activityId/asistencia — quién está/estuvo (solo profesorado). */
export async function videoAsistencia(req: Request, res: Response): Promise<void> {
  const acc = await accesoActividad(req);
  if (!acc.esProfesor) throw forbidden('Solo el profesorado ve la asistencia');
  const { rows } = await query(
    `SELECT nombre, rol, camara_on, segundos, joined_at, last_seen_at,
            (last_seen_at > NOW() - INTERVAL '45 seconds') AS conectado
       FROM video_attendance WHERE activity_id = $1
      ORDER BY (rol = 'profesor') DESC, nombre`,
    [req.params.activityId],
  );
  res.json({ asistencia: rows });
}
