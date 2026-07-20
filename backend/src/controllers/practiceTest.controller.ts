import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';

/**
 * Generador de tests y exámenes para oposiciones.
 *
 * El opositor elige de qué bancos salen las preguntas, con qué criterio, cuántas
 * quiere, si pone tiempo, si corrige sobre la marcha o al final, y si podrá
 * repetirlo barajado.
 *
 * REGLA INNEGOCIABLE: se baraja el orden de las PREGUNTAS, nunca el de las
 * OPCIONES dentro de cada pregunta. En las oposiciones que publican el pool, la
 * opción A de una pregunta debe seguir siendo la A en el examen, aunque la
 * pregunta cambie de posición. Alterarlo invalidaría el estudio del opositor.
 */

const generarSchema = z.object({
  bankIds: z.array(z.string().uuid()).min(1, 'Elige al menos un banco'),
  criterio: z.enum(['aleatorio', 'rango', 'tema']),
  rangoDesde: z.number().int().min(1).optional(),
  rangoHasta: z.number().int().min(1).optional(),
  temas: z.array(z.string().max(120)).optional(),
  count: z.number().int().min(1).max(300),
  minutos: z.number().int().min(1).max(600).nullish(),
  correccion: z.enum(['inmediata', 'final']).default('final'),
  barajarPreguntas: z.boolean().default(true),
  repiteDe: z.string().uuid().optional(),
});

/** POST /api/practice/tests — generar un test con la configuración elegida. */
export async function generarTest(req: Request, res: Response): Promise<void> {
  const d = generarSchema.parse(req.body);
  const uid = req.auth!.sub;

  if (d.criterio === 'rango') {
    if (!d.rangoDesde || !d.rangoHasta) throw badRequest('Indica el rango de preguntas', 'FALTA_RANGO');
    if (d.rangoHasta < d.rangoDesde) throw badRequest('El rango está invertido', 'RANGO_INVERTIDO');
  }
  if (d.criterio === 'tema' && (!d.temas || d.temas.length === 0)) {
    throw badRequest('Elige al menos una materia', 'FALTA_TEMA');
  }

  // Solo bancos que el opositor puede usar: públicos o creados por él.
  const permitidos = await query<{ id: string }>(
    `SELECT id FROM question_banks
      WHERE id = ANY($1::uuid[]) AND (visibility = 'publico' OR created_by = $2)`,
    [d.bankIds, uid],
  );
  if (permitidos.rows.length === 0) throw badRequest('No tienes acceso a esos bancos', 'BANCOS_NO_VALIDOS');
  const bankIds = permitidos.rows.map((b) => b.id);

  const conds = ['q.is_active = TRUE', 'q.bank_id = ANY($1::uuid[])'];
  const params: unknown[] = [bankIds];
  if (d.criterio === 'rango') {
    params.push(d.rangoDesde, d.rangoHasta);
    conds.push(`q.orden BETWEEN $${params.length - 1} AND $${params.length}`);
  } else if (d.criterio === 'tema') {
    params.push(d.temas);
    conds.push(`q.tema = ANY($${params.length}::text[])`);
  }

  // Con barajado se sortean; sin él, se respeta el número de orden del pool,
  // que es como el opositor estudia el documento oficial.
  const orden = d.barajarPreguntas ? 'RANDOM()' : 'q.bank_id, q.orden NULLS LAST';
  params.push(d.count);

  const { rows } = await query<{ id: string }>(
    `SELECT q.id FROM questions q
      WHERE ${conds.join(' AND ')}
      ORDER BY ${orden}
      LIMIT $${params.length}`,
    params,
  );
  if (rows.length === 0) throw badRequest('No hay preguntas que cumplan esos criterios', 'SIN_PREGUNTAS');

  const ids = rows.map((r) => r.id);
  const test = await query<{ id: string; started_at: string }>(
    `INSERT INTO practice_tests
       (user_id, bank_ids, criterio, rango_desde, rango_hasta, temas, question_ids, minutos, correccion, barajado, repite_de)
     VALUES ($1,$2::uuid[],$3,$4,$5,$6::text[],$7::uuid[],$8,$9,$10,$11)
     RETURNING id, started_at`,
    [
      uid, bankIds, d.criterio, d.rangoDesde ?? null, d.rangoHasta ?? null, d.temas ?? null,
      ids, d.minutos ?? null, d.correccion, d.barajarPreguntas, d.repiteDe ?? null,
    ],
  );

  res.status(201).json({
    testId: test.rows[0].id,
    startedAt: test.rows[0].started_at,
    config: {
      criterio: d.criterio, minutos: d.minutos ?? null, correccion: d.correccion,
      barajado: d.barajarPreguntas, solicitadas: d.count, servidas: ids.length,
    },
    // Aviso honesto: pidió más de las que existen con ese criterio.
    aviso: ids.length < d.count
      ? `Solo hay ${ids.length} preguntas que cumplan ese criterio; el test se ha generado con esas.`
      : null,
    questions: await preguntasServidas(ids),
  });
}

/** Preguntas en el orden servido, SIN la respuesta correcta. */
async function preguntasServidas(ids: string[]) {
  const { rows } = await query<{ id: string; text: string; options: string[]; tema: string | null; orden: number | null }>(
    // Las OPCIONES salen tal cual están guardadas: nunca se reordenan.
    `SELECT q.id, q.text, q.options, q.tema, q.orden, b.name AS banco
       FROM questions q LEFT JOIN question_banks b ON b.id = q.bank_id
      WHERE q.id = ANY($1::uuid[])`,
    [ids],
  );
  const porId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => porId.get(id)).filter(Boolean);
}

async function cargarTest(testId: string, uid: string) {
  const { rows } = await query<{
    id: string; question_ids: string[]; correccion: string; submitted_at: string | null;
    minutos: number | null; started_at: string; bank_ids: string[]; criterio: string;
    rango_desde: number | null; rango_hasta: number | null; temas: string[] | null; barajado: boolean;
  }>(
    'SELECT * FROM practice_tests WHERE id = $1 AND user_id = $2',
    [testId, uid],
  );
  if (rows.length === 0) throw notFound('Test no encontrado');
  return rows[0];
}

/**
 * GET /api/practice/tests/:id/answer/:questionId — corrección de una pregunta.
 * Solo si el test se configuró con corrección inmediata.
 */
export async function respuestaInmediata(req: Request, res: Response): Promise<void> {
  const t = await cargarTest(req.params.id, req.auth!.sub);
  if (t.correccion !== 'inmediata') throw badRequest('Este test se corrige al final', 'CORRECCION_FINAL');
  if (!t.question_ids.includes(req.params.questionId)) throw notFound('Esa pregunta no está en el test');

  const { rows } = await query<{
    correct_index: number; explanation: string | null; ref_page: number | null; document_title: string | null;
  }>(
    `SELECT q.correct_index, q.explanation, q.ref_page, d.title AS document_title
       FROM questions q LEFT JOIN documents d ON d.id = q.ref_document_id
      WHERE q.id = $1`,
    [req.params.questionId],
  );
  const q = rows[0];
  if (!q) throw notFound('Pregunta no encontrada');

  res.json({
    correcta: q.correct_index,
    explicacion: q.explanation,
    // Referencia al documento oficial: es la "hoja de respuestas" que pedía.
    fuente: q.document_title ? { documento: q.document_title, pagina: q.ref_page } : null,
  });
}

const enviarSchema = z.object({
  answers: z.record(z.union([z.number().int(), z.null()])),
  seconds: z.number().int().min(0).max(86400).optional(),
});

/** POST /api/practice/tests/:id/submit — corregir el test completo. */
export async function enviarTest(req: Request, res: Response): Promise<void> {
  const uid = req.auth!.sub;
  const t = await cargarTest(req.params.id, uid);
  if (t.submitted_at) throw badRequest('Este test ya fue corregido', 'YA_ENVIADO');
  const d = enviarSchema.parse(req.body);

  const { rows } = await query<{
    id: string; correct_index: number; explanation: string | null; text: string; options: string[];
    ref_page: number | null; document_title: string | null; bank_id: string; tema: string | null; orden: number | null;
  }>(
    `SELECT q.id, q.correct_index, q.explanation, q.text, q.options, q.ref_page, q.bank_id, q.tema, q.orden,
            d.title AS document_title
       FROM questions q LEFT JOIN documents d ON d.id = q.ref_document_id
      WHERE q.id = ANY($1::uuid[])`,
    [t.question_ids],
  );
  const porId = new Map(rows.map((r) => [r.id, r]));

  let correct = 0;
  const revision = t.question_ids.map((id, i) => {
    const q = porId.get(id);
    if (!q) return null;
    const marcada = d.answers[id] ?? null;
    const acierto = marcada !== null && marcada === q.correct_index;
    if (acierto) correct++;
    return {
      n: i + 1,
      id,
      numeroEnBanco: q.orden,
      tema: q.tema,
      text: q.text,
      options: q.options,
      marcada,
      correcta: q.correct_index,
      acierto,
      explicacion: q.explanation,
      fuente: q.document_title ? { documento: q.document_title, pagina: q.ref_page } : null,
    };
  }).filter(Boolean);

  await query(
    `UPDATE practice_tests SET submitted_at = NOW(), correct = $2, total = $3, seconds = $4 WHERE id = $1`,
    [t.id, correct, t.question_ids.length, d.seconds ?? 0],
  );

  // Alimenta las estadísticas y la cobertura del temario, como cualquier tanda.
  for (const q of rows) {
    const marcada = d.answers[q.id] ?? null;
    await query(
      `INSERT INTO answer_log (user_id, question_id, bank_id, category, is_correct, source)
       VALUES ($1,$2,$3,$4,$5,'practica')`,
      [uid, q.id, q.bank_id, q.tema, marcada !== null && marcada === q.correct_index],
    );
  }
  await query(
    `INSERT INTO practice_sessions (user_id, bank_id, total, correct, seconds, is_simulacro)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [uid, t.bank_ids[0] ?? null, t.question_ids.length, correct, d.seconds ?? 0, !!t.minutos],
  );

  const pct = Math.round((correct / t.question_ids.length) * 100);
  res.json({ correct, total: t.question_ids.length, pct, revision });
}

/**
 * POST /api/practice/tests/:id/repeat — repetir un test anterior.
 * Reutiliza su configuración exacta y baraja las preguntas, que es para lo que
 * sirve repetir: comprobar si se sabe la materia, no si se recuerda el orden.
 */
export async function repetirTest(req: Request, res: Response): Promise<void> {
  const t = await cargarTest(req.params.id, req.auth!.sub);
  req.body = {
    bankIds: t.bank_ids,
    criterio: t.criterio,
    rangoDesde: t.rango_desde ?? undefined,
    rangoHasta: t.rango_hasta ?? undefined,
    temas: t.temas ?? undefined,
    count: t.question_ids.length,
    minutos: t.minutos,
    correccion: t.correccion,
    barajarPreguntas: true,
    repiteDe: t.id,
  };
  await generarTest(req, res);
}

/** GET /api/practice/tests — mis tests, para repetirlos o revisarlos. */
export async function misTests(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT t.id, t.criterio, t.rango_desde, t.rango_hasta, t.temas, t.minutos, t.correccion, t.barajado,
            array_length(t.question_ids, 1) AS preguntas, t.correct, t.total, t.seconds,
            t.started_at, t.submitted_at, t.repite_de,
            (SELECT string_agg(b.name, ', ' ORDER BY b.name)
               FROM question_banks b WHERE b.id = ANY(t.bank_ids)) AS bancos
       FROM practice_tests t WHERE t.user_id = $1 ORDER BY t.started_at DESC LIMIT 30`,
    [req.auth!.sub],
  );
  res.json({ tests: rows });
}
