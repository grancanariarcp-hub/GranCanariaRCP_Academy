import { randomBytes } from 'node:crypto';
import { query } from '../config/database.js';
import { notify } from '../services/notify.js';

/**
 * Emisión de certificados de reconocimiento.
 *
 * Dos motivos:
 *  - Ganar (o participar en) un desafío, según lo que configure el super admin.
 *  - Alcanzar un umbral de horas practicando.
 *
 * La emisión es idempotente: los índices únicos impiden que la misma persona
 * reciba dos veces el mismo reconocimiento aunque el disparador se ejecute más
 * de una vez, cosa que ocurre al recargar o reintentar.
 */

export interface Plantilla {
  id: string;
  kind: string;
  title: string;
  body_template: string;
  frase: string | null;
  certifica: string | null;
  firmante1_nombre: string | null;
  firmante1_cargo: string | null;
  firmante2_nombre: string | null;
  firmante2_cargo: string | null;
  bg_key: string | null;
  max_position: number | null;
  challenge_id: string | null;
  threshold_hours: number | null;
}

/** Sustituye los marcadores del cuerpo por los datos reales. */
export function componerCuerpo(plantilla: string, datos: Record<string, string | number | null>): string {
  return plantilla.replace(/\{(\w+)\}/g, (_, clave: string) => {
    const v = datos[clave];
    return v === null || v === undefined ? '' : String(v);
  });
}

/**
 * Horas dedicadas a practicar por una persona.
 *
 * Se suman las tres vías por las que se responden preguntas, porque el
 * identificador es único en todo el sistema y una misma persona puede haber
 * usado varias: práctica libre, intentos de examen y desafíos.
 */
export async function horasDePractica(subjectId: string): Promise<number> {
  const { rows } = await query<{ segundos: string }>(
    `SELECT (
       COALESCE((SELECT SUM(seconds)            FROM practice_sessions   WHERE user_id = $1), 0) +
       COALESCE((SELECT SUM(time_spent_seconds) FROM exam_attempts       WHERE student_id = $1), 0) +
       COALESCE((SELECT SUM(time_seconds)       FROM challenge_attempts  WHERE participant_id = $1), 0)
     )::text AS segundos`,
    [subjectId],
  );
  return Number(rows[0]?.segundos ?? 0) / 3600;
}

async function emitir(
  plantilla: Plantilla,
  datos: {
    subjectId: string; subjectType: string; subjectName: string;
    challengeId?: string | null; challengeTitle?: string | null; position?: number | null; hours?: number | null;
  },
): Promise<{ code: string } | null> {
  const code = randomBytes(6).toString('hex');
  // ON CONFLICT sobre los índices únicos: si ya lo tenía, no se duplica.
  const { rows } = await query<{ code: string }>(
    `INSERT INTO issued_recognitions
       (code, template_id, kind, subject_id, subject_type, subject_name, challenge_id, challenge_title, position, hours)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     ON CONFLICT DO NOTHING
     RETURNING code`,
    [
      code, plantilla.id, plantilla.kind,
      datos.subjectId, datos.subjectType, datos.subjectName,
      datos.challengeId ?? null, datos.challengeTitle ?? null,
      datos.position ?? null, datos.hours ?? null,
    ],
  );
  return rows[0] ?? null;
}

/**
 * Reconocimiento por un desafío recién completado.
 * Se llama tras enviar el intento; si no procede, no hace nada.
 */
export async function reconocerDesafio(datos: {
  subjectId: string; subjectType: string; subjectName: string;
  challengeId: string; challengeTitle: string; position: number;
}): Promise<void> {
  // Plantilla específica del desafío si existe; si no, la general.
  const { rows } = await query<Plantilla>(
    `SELECT * FROM recognition_templates
      WHERE kind = 'desafio' AND is_active
        AND (challenge_id = $1 OR challenge_id IS NULL)
      ORDER BY challenge_id NULLS LAST
      LIMIT 1`,
    [datos.challengeId],
  );
  const p = rows[0];
  if (!p) return;
  // max_position NULL = lo obtiene todo el que completa el desafío.
  if (p.max_position !== null && datos.position > p.max_position) return;

  const emitido = await emitir(p, datos);
  if (!emitido) return;

  await notify(
    { id: datos.subjectId, type: datos.subjectType === 'user' ? 'user' : 'student' },
    'Has recibido un certificado de reconocimiento',
    `Por tu participación en «${datos.challengeTitle}». Descárgalo desde tu perfil.`,
    '/student/perfil',
  ).catch(() => { /* el reconocimiento no depende del aviso */ });
}

/**
 * Reconocimiento por horas acumuladas.
 * Emite el umbral más alto que se haya alcanzado y aún no se tenga.
 */
export async function reconocerHoras(datos: {
  subjectId: string; subjectType: string; subjectName: string;
}): Promise<void> {
  const horas = await horasDePractica(datos.subjectId);
  if (horas <= 0) return;

  const { rows } = await query<Plantilla>(
    `SELECT * FROM recognition_templates
      WHERE kind = 'horas' AND is_active AND threshold_hours IS NOT NULL AND threshold_hours <= $1
      ORDER BY threshold_hours DESC`,
    [horas],
  );

  for (const p of rows) {
    const emitido = await emitir(p, { ...datos, hours: p.threshold_hours });
    if (emitido) {
      await notify(
        { id: datos.subjectId, type: datos.subjectType === 'user' ? 'user' : 'student' },
        'Has recibido un certificado de reconocimiento',
        `Por alcanzar ${p.threshold_hours} horas de práctica. Descárgalo desde tu perfil.`,
        '/student/perfil',
      ).catch(() => { /* idem */ });
      // Solo el umbral más alto alcanzado en esta comprobación.
      break;
    }
  }
}
