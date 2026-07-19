import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { notFound } from '../utils/httpError.js';

/**
 * Preparación de oposiciones.
 *
 * Quien prepara una OPE no cursa un temario con módulos y certificado: repite
 * exámenes, mide su cobertura del temario y repasa sus fallos. Por eso tiene su
 * propio panel en lugar del de cursos, aunque por debajo use el mismo motor de
 * práctica.
 */

/** GET /api/practice/ope-banks — mis oposiciones, con mi avance en cada una. */
export async function myOpeBanks(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;

  const { rows } = await query(
    `SELECT b.id, b.name, b.comunidad_autonoma, b.categoria_profesional, b.anio, b.official,
            b.sim_questions, b.sim_minutes, b.sim_pass_pct,
            (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id AND q.is_active)::int AS preguntas,
            -- Cobertura: cuántas preguntas distintas ha visto ya esta persona.
            (SELECT COUNT(DISTINCT al.question_id) FROM answer_log al
              WHERE al.user_id = $1 AND al.bank_id = b.id)::int AS vistas,
            -- Aciertos sobre el ÚLTIMO intento de cada pregunta: es su nivel hoy.
            (SELECT COUNT(*) FROM (
               SELECT DISTINCT ON (al.question_id) al.is_correct
                 FROM answer_log al WHERE al.user_id = $1 AND al.bank_id = b.id
                ORDER BY al.question_id, al.answered_at DESC
             ) u WHERE u.is_correct)::int AS acertadas,
            (SELECT MAX(created_at) FROM practice_sessions ps
              WHERE ps.user_id = $1 AND ps.bank_id = b.id) AS ultima_sesion,
            (SELECT COUNT(*) FROM practice_sessions ps
              WHERE ps.user_id = $1 AND ps.bank_id = b.id AND ps.is_simulacro)::int AS simulacros
       FROM question_banks b
      WHERE b.kind IN ('ope', 'mir') AND b.visibility = 'publico'
      ORDER BY (SELECT MAX(created_at) FROM practice_sessions ps WHERE ps.user_id = $1 AND ps.bank_id = b.id) DESC NULLS LAST,
               b.anio DESC NULLS LAST, b.name`,
    [uid],
  );

  res.json({
    banks: rows.map((b) => {
      const preguntas = Number(b.preguntas);
      const vistas = Number(b.vistas);
      return {
        ...b,
        coberturaPct: preguntas > 0 ? Math.round((vistas / preguntas) * 100) : 0,
        pendientes: Math.max(0, preguntas - vistas),
        aciertoPct: vistas > 0 ? Math.round((Number(b.acertadas) / vistas) * 100) : null,
        // Un simulacro sin configurar no debe ofrecerse: cada OPE tiene lo suyo.
        simulacroListo: !!(b.sim_questions && b.sim_minutes),
      };
    }),
  });
}

/**
 * GET /api/practice/ope-banks/:id — detalle de una oposición.
 * Cobertura por tema y evolución de las últimas sesiones.
 */
export async function opeBankDetail(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;
  const bankId = req.params.id;

  const banco = await query(
    `SELECT id, name, comunidad_autonoma, categoria_profesional, anio,
            sim_questions, sim_minutes, sim_pass_pct
       FROM question_banks WHERE id = $1 AND kind IN ('ope','mir')`,
    [bankId],
  );
  if (banco.rows.length === 0) throw notFound('Oposición no encontrada');

  // Cobertura por tema: dónde tiene lagunas y dónde ya está fino.
  const porTema = await query(
    `SELECT COALESCE(q.tema, '(sin tema)') AS tema,
            COUNT(*)::int AS preguntas,
            COUNT(DISTINCT al.question_id)::int AS vistas,
            COUNT(*) FILTER (WHERE al.is_correct)::int AS aciertos
       FROM questions q
       LEFT JOIN LATERAL (
         SELECT DISTINCT ON (a.question_id) a.question_id, a.is_correct
           FROM answer_log a
          WHERE a.user_id = $2 AND a.question_id = q.id
          ORDER BY a.question_id, a.answered_at DESC
       ) al ON TRUE
      WHERE q.bank_id = $1 AND q.is_active
      GROUP BY 1 ORDER BY 1`,
    [bankId, uid],
  );

  // Fallos pendientes de repasar: el material de estudio más rentable.
  const fallos = await query<{ n: string }>(
    `WITH ultima AS (
       SELECT DISTINCT ON (al.question_id) al.question_id, al.is_correct
         FROM answer_log al WHERE al.user_id = $2 AND al.bank_id = $1
        ORDER BY al.question_id, al.answered_at DESC
     )
     SELECT COUNT(*)::text AS n FROM ultima WHERE NOT is_correct`,
    [bankId, uid],
  );

  // Evolución: últimas 15 sesiones, para ver si la nota sube.
  const sesiones = await query(
    `SELECT to_char(created_at, 'YYYY-MM-DD') AS fecha, total, correct, seconds, is_simulacro,
            ROUND(correct::numeric / NULLIF(total,0) * 100)::int AS pct
       FROM practice_sessions
      WHERE user_id = $2 AND bank_id = $1
      ORDER BY created_at DESC LIMIT 15`,
    [bankId, uid],
  );

  const b = banco.rows[0];
  res.json({
    banco: {
      ...b,
      simulacroListo: !!(b.sim_questions && b.sim_minutes),
    },
    porTema: porTema.rows.map((t) => ({
      ...t,
      coberturaPct: t.preguntas > 0 ? Math.round((t.vistas / t.preguntas) * 100) : 0,
      aciertoPct: t.vistas > 0 ? Math.round((t.aciertos / t.vistas) * 100) : null,
    })),
    fallosPendientes: Number(fallos.rows[0].n),
    sesiones: sesiones.rows.reverse(),
  });
}
