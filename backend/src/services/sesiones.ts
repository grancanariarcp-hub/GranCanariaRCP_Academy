import { createHash } from 'node:crypto';
import type { Request } from 'express';
import { query } from '../config/database.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Control de sesiones simultáneas.
 *
 * Objetivo: que compartir credenciales resulte incómodo sin molestar a quien
 * las usa de forma legítima. Se permiten DOS sesiones a la vez —móvil y
 * ordenador, que es el uso normal— y al abrir una tercera se cierra la más
 * antigua avisando del motivo.
 *
 * Deliberadamente NO se bloquea la cuenta ni se exige verificar dispositivos:
 * una medida agresiva castiga antes al cliente honrado que al que comparte, y
 * en un producto que se vende por suscripción eso sale caro.
 */

/** Sesiones vivas por persona. Dos cubren el uso normal. */
const MAX_SESIONES = 2;

const resumen = (v: string): string => createHash('sha256').update(v).digest('hex');

/** Etiqueta legible para que el titular reconozca sus propias sesiones. */
function etiquetaDispositivo(ua: string): string {
  const s = ua.toLowerCase();
  const so = /iphone|ipad|ios/.test(s) ? 'iPhone/iPad'
    : /android/.test(s) ? 'Android'
      : /windows/.test(s) ? 'Windows'
        : /mac os|macintosh/.test(s) ? 'Mac'
          : /linux/.test(s) ? 'Linux' : 'Dispositivo';
  const nav = /edg\//.test(s) ? 'Edge'
    : /chrome|crios/.test(s) ? 'Chrome'
      : /firefox|fxios/.test(s) ? 'Firefox'
        : /safari/.test(s) ? 'Safari' : '';
  return nav ? `${so} · ${nav}` : so;
}

export interface SesionAbierta {
  id: string;
  cerradas: number;
}

/**
 * Abre una sesión y cierra las sobrantes.
 * Devuelve cuántas se cerraron, para poder avisar al titular.
 */
export async function abrirSesion(
  req: Request,
  subjectId: string,
  subjectType: 'student' | 'user',
): Promise<SesionAbierta> {
  const ua = String(req.headers['user-agent'] || '');
  const ip = clientIp(req) ?? '';

  // Reutiliza la sesión del mismo dispositivo en vez de acumular una nueva en
  // cada acceso: si no, cerrar y volver a entrar dejaría fuera al otro equipo.
  const uaHash = resumen(ua);
  const existente = await query<{ id: string }>(
    `UPDATE sessions SET last_seen_at = NOW(), ip_hash = $3
      WHERE subject_id = $1 AND ua_hash = $2 AND revoked_at IS NULL
      RETURNING id`,
    [subjectId, uaHash, ip ? resumen(ip) : null],
  );
  if (existente.rows[0]) return { id: existente.rows[0].id, cerradas: 0 };

  const nueva = await query<{ id: string }>(
    `INSERT INTO sessions (subject_id, subject_type, ip_hash, ua_hash, dispositivo)
     VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [subjectId, subjectType, ip ? resumen(ip) : null, uaHash, etiquetaDispositivo(ua)],
  );

  // Cierra las más antiguas si se supera el tope.
  const sobrantes = await query<{ id: string }>(
    `UPDATE sessions SET revoked_at = NOW(), revoked_reason = 'limite_dispositivos'
      WHERE id IN (
        SELECT id FROM sessions
         WHERE subject_id = $1 AND revoked_at IS NULL
         ORDER BY last_seen_at DESC
         OFFSET $2
      ) RETURNING id`,
    [subjectId, MAX_SESIONES],
  );

  return { id: nueva.rows[0].id, cerradas: sobrantes.rowCount ?? 0 };
}

/** ¿Sigue viva esta sesión? Se comprueba en cada petición autenticada. */
export async function sesionViva(sessionId: string): Promise<boolean> {
  const { rows } = await query<{ id: string }>(
    `UPDATE sessions SET last_seen_at = NOW()
      WHERE id = $1 AND revoked_at IS NULL RETURNING id`,
    [sessionId],
  );
  return rows.length > 0;
}

/** Sesiones abiertas de una persona, para que las vea y pueda cerrarlas. */
export async function misSesiones(subjectId: string) {
  const { rows } = await query(
    `SELECT id, dispositivo, created_at, last_seen_at
       FROM sessions WHERE subject_id = $1 AND revoked_at IS NULL
      ORDER BY last_seen_at DESC`,
    [subjectId],
  );
  return rows;
}

export async function cerrarSesion(sessionId: string, subjectId: string, motivo = 'manual'): Promise<boolean> {
  const { rowCount } = await query(
    `UPDATE sessions SET revoked_at = NOW(), revoked_reason = $3
      WHERE id = $1 AND subject_id = $2 AND revoked_at IS NULL`,
    [sessionId, subjectId, motivo],
  );
  return (rowCount ?? 0) > 0;
}

/**
 * Señal de uso compartido: muchas conexiones distintas en poco tiempo.
 * No bloquea nada; solo marca la cuenta para que se revise. Bloquear en
 * automático por una heurística acabaría echando a clientes legítimos que
 * estudian desde el hospital, casa y la biblioteca.
 */
export async function señalesDeReparto(dias = 7) {
  const { rows } = await query(
    `SELECT s.subject_id, s.subject_type,
            COUNT(DISTINCT s.ip_hash)::int AS conexiones,
            COUNT(DISTINCT s.ua_hash)::int AS dispositivos,
            COUNT(*)::int AS sesiones,
            MAX(s.last_seen_at) AS ultima,
            COALESCE(st.display_name, u.name) AS nombre,
            COALESCE(st.email, u.email) AS email
       FROM sessions s
       LEFT JOIN students st ON st.id = s.subject_id
       LEFT JOIN users u     ON u.id  = s.subject_id
      WHERE s.created_at > NOW() - ($1 || ' days')::interval
      GROUP BY s.subject_id, s.subject_type, st.display_name, u.name, st.email, u.email
     HAVING COUNT(DISTINCT s.ua_hash) >= 4 OR COUNT(DISTINCT s.ip_hash) >= 8
      ORDER BY COUNT(DISTINCT s.ua_hash) DESC, COUNT(DISTINCT s.ip_hash) DESC
      LIMIT 100`,
    [String(dias)],
  );
  return rows;
}
