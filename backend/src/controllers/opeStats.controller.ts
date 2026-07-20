import type { Request, Response } from 'express';
import { query } from '../config/database.js';

/**
 * Estadística fina del opositor sobre un banco.
 *
 * Responde a las tres preguntas que se hace quien prepara una oposición:
 * ¿qué preguntas se me atragantan?, ¿en qué materias fallo más?, y ¿qué me
 * queda por ver? La última importa porque es fácil creer que se lleva el
 * temario entero cuando en realidad se repiten siempre las mismas preguntas.
 */

/** GET /api/practice/ope-banks/:id/questions — estadística pregunta a pregunta. */
export async function estadisticaPreguntas(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;
  const bankId = req.params.id;
  const soloFalladas = req.query.falladas === '1';

  const { rows } = await query(
    `SELECT q.id, q.orden, q.tema, LEFT(q.text, 140) AS text,
            -- Mi historial con esta pregunta
            COALESCE(mi.veces, 0)::int    AS veces,
            COALESCE(mi.aciertos, 0)::int AS aciertos,
            mi.ultima_correcta,
            mi.ultima_fecha,
            -- Cómo le va a toda la comunidad
            COALESCE(todos.veces, 0)::int AS veces_comunidad,
            CASE WHEN COALESCE(todos.veces, 0) >= 5
                 THEN ROUND(todos.aciertos::numeric / todos.veces * 100)::int
                 END AS acierto_comunidad_pct
       FROM questions q
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS veces,
                COUNT(*) FILTER (WHERE al.is_correct) AS aciertos,
                (ARRAY_AGG(al.is_correct  ORDER BY al.answered_at DESC))[1] AS ultima_correcta,
                MAX(al.answered_at) AS ultima_fecha
           FROM answer_log al WHERE al.question_id = q.id AND al.user_id = $2
       ) mi ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS veces, COUNT(*) FILTER (WHERE al.is_correct) AS aciertos
           FROM answer_log al WHERE al.question_id = q.id
       ) todos ON TRUE
      WHERE q.bank_id = $1 AND q.is_active
        ${soloFalladas ? 'AND mi.ultima_correcta = FALSE' : ''}
      ORDER BY q.orden NULLS LAST`,
    [bankId, uid],
  );

  res.json({
    preguntas: rows.map((q) => ({
      ...q,
      // Mi acierto en esta pregunta; null si nunca la he respondido.
      aciertoPct: q.veces > 0 ? Math.round((q.aciertos / q.veces) * 100) : null,
      falloPct: q.veces > 0 ? Math.round(((q.veces - q.aciertos) / q.veces) * 100) : null,
    })),
  });
}

/**
 * GET /api/practice/ope-banks/:id/materias — resumen por materia y aviso de
 * cobertura, con las preguntas que siguen sin responderse.
 */
export async function estadisticaMaterias(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;
  const bankId = req.params.id;

  const materias = await query(
    `SELECT COALESCE(q.tema, '(sin materia)') AS materia,
            COUNT(*)::int AS preguntas,
            COUNT(*) FILTER (WHERE mi.veces > 0)::int AS vistas,
            COALESCE(SUM(mi.veces), 0)::int AS respuestas,
            COALESCE(SUM(mi.aciertos), 0)::int AS aciertos
       FROM questions q
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS veces, COUNT(*) FILTER (WHERE al.is_correct) AS aciertos
           FROM answer_log al WHERE al.question_id = q.id AND al.user_id = $2
       ) mi ON TRUE
      WHERE q.bank_id = $1 AND q.is_active
      GROUP BY 1 ORDER BY 1`,
    [bankId, uid],
  );

  // Total de respuestas dadas por esta persona en el banco frente al tamaño del
  // banco: si ya respondió tantas veces como preguntas hay, matemáticamente
  // podría haberlas visto todas, y lo que siga sin ver es un punto ciego real.
  const cobertura = await query<{ total: string; respuestas: string; vistas: string }>(
    `SELECT (SELECT COUNT(*) FROM questions WHERE bank_id = $1 AND is_active)::text AS total,
            (SELECT COUNT(*) FROM answer_log WHERE bank_id = $1 AND user_id = $2)::text AS respuestas,
            (SELECT COUNT(DISTINCT question_id) FROM answer_log WHERE bank_id = $1 AND user_id = $2)::text AS vistas`,
    [bankId, uid],
  );
  const c = cobertura.rows[0];
  const total = Number(c.total);
  const respuestas = Number(c.respuestas);
  const vistas = Number(c.vistas);
  const puntoCiego = respuestas >= total && vistas < total;

  const sinVer = puntoCiego
    ? await query(
      `SELECT q.id, q.orden, q.tema, LEFT(q.text, 140) AS text
         FROM questions q
        WHERE q.bank_id = $1 AND q.is_active
          AND NOT EXISTS (SELECT 1 FROM answer_log al WHERE al.question_id = q.id AND al.user_id = $2)
        ORDER BY q.orden NULLS LAST LIMIT 100`,
      [bankId, uid],
    )
    : { rows: [] };

  res.json({
    materias: materias.rows.map((m) => ({
      ...m,
      coberturaPct: m.preguntas > 0 ? Math.round((m.vistas / m.preguntas) * 100) : 0,
      aciertoPct: m.respuestas > 0 ? Math.round((m.aciertos / m.respuestas) * 100) : null,
      falloPct: m.respuestas > 0 ? Math.round(((m.respuestas - m.aciertos) / m.respuestas) * 100) : null,
      pendientes: m.preguntas - m.vistas,
    })),
    cobertura: {
      total, vistas, respuestas,
      pendientes: total - vistas,
      coberturaPct: total > 0 ? Math.round((vistas / total) * 100) : 0,
      // Ya ha respondido lo suficiente como para haberlas visto todas.
      puntoCiego,
      mensaje: puntoCiego
        ? `Has dado ${respuestas} respuestas en un banco de ${total} preguntas, pero ${total - vistas} siguen sin salirte nunca. Genera un test con las preguntas que menos has visto.`
        : null,
    },
    sinVer: sinVer.rows,
  });
}

/**
 * GET /api/practice/community-stats?bankIds=... — cómo le va a la comunidad.
 * Sirve para que el opositor sepa si una pregunta se le atraganta solo a él.
 */
export async function estadisticaComunidad(req: Request, res: Response): Promise<void> {
  const bankIds = String(req.query.bankIds || '').split(',').filter(Boolean);
  if (bankIds.length === 0) {
    res.json({ materias: [], disponibles: 0 });
    return;
  }

  const materias = await query(
    `SELECT COALESCE(q.tema, '(sin materia)') AS materia,
            COUNT(al.id)::int AS respuestas,
            ROUND(COUNT(al.id) FILTER (WHERE al.is_correct)::numeric
                  / NULLIF(COUNT(al.id), 0) * 100)::int AS acierto_pct
       FROM questions q JOIN answer_log al ON al.question_id = q.id
      WHERE q.bank_id = ANY($1::uuid[])
      GROUP BY 1 HAVING COUNT(al.id) >= 5
      ORDER BY 3 ASC`,
    [bankIds],
  );

  const disponibles = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM (
       SELECT al.question_id FROM answer_log al
        JOIN questions q ON q.id = al.question_id
       WHERE q.bank_id = ANY($1::uuid[])
       GROUP BY al.question_id
      HAVING COUNT(*) >= 5
         AND COUNT(*) FILTER (WHERE NOT al.is_correct)::numeric / COUNT(*) > 0.4
     ) x`,
    [bankIds],
  );

  res.json({
    materias: materias.rows,
    // Cuántas preguntas alimentan hoy el banco de fallos de la comunidad.
    disponibles: Number(disponibles.rows[0].n),
  });
}
