import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';

function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function toList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  return String(v ?? '').split(/[|;]/).map((x) => x.trim()).filter(Boolean);
}
function resolveCorrect(v: unknown, n: number): number | null {
  const s = String(v ?? '').trim().toUpperCase();
  const letter = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }[s as 'A'];
  if (letter !== undefined && letter < n) return letter;
  const num = parseInt(s, 10);
  if (Number.isInteger(num) && num >= 1 && num <= n) return num - 1;
  return null;
}

/**
 * Reglas de acceso a un banco:
 *  · super_admin: todo.
 *  · profesor: control total sobre LOS SUYOS; los públicos solo puede verlos y
 *    usarlos como fuente de preguntas (no editar, borrar ni descargar).
 */
async function assertBankOwner(req: Request, bankId: string): Promise<void> {
  if (req.auth!.role === 'super_admin') return;
  const { rows } = await query<{ created_by: string | null }>(
    'SELECT created_by FROM question_banks WHERE id = $1', [bankId],
  );
  if (rows.length === 0) throw notFound('Banco no encontrado');
  if (rows[0].created_by !== req.auth!.sub) {
    throw forbidden('Este banco no es tuyo. Puedes usarlo como fuente de preguntas, pero no modificarlo ni descargarlo.');
  }
}

// ---------------------------------------------------------------------------
// create / list banks
// ---------------------------------------------------------------------------
/**
 * Los bancos tienen dos "dimensiones" genéricas que se etiquetan distinto según
 * el tipo (así no hacen falta columnas nuevas por cada tipo):
 *   comunidad_autonoma  → OPE/MIR: comunidad autónoma · RCP: institución (ERC,
 *                          AHA, PNRCP, ILCOR, Cruz Roja, Otra) · Formativo: especialidad
 *   categoria_profesional → OPE/MIR: categoría profesional · RCP: población
 *                          objetivo (niños/jóvenes/adultos) · Formativo: tema
 * `official` y la configuración de simulacro solo aplican a OPE/MIR.
 * `anio` siempre es el año de publicación de la fuente usada.
 */
const createSchema = z.object({
  name: z.string().min(2).max(160),
  kind: z.enum(['rcp', 'ope', 'mir', 'formativo', 'otro']).default('ope'),
  comunidadAutonoma: z.string().max(120).nullable().optional(),
  anio: z.number().int().min(1990).max(2100).nullable().optional(),
  categoriaProfesional: z.string().max(160).nullable().optional(),
  official: z.boolean().optional().default(false),
  descripcion: z.string().nullable().optional(),
  simQuestions: z.number().int().min(1).max(300).nullable().optional(),
  simMinutes: z.number().int().min(1).max(600).nullable().optional(),
  simPassPct: z.number().int().min(0).max(100).nullable().optional(),
  visibility: z.enum(['privado', 'publico']).optional(),
});

export async function createBank(req: Request, res: Response): Promise<void> {
  const d = createSchema.parse(req.body);
  // Un profesor crea sus bancos en privado salvo que indique lo contrario.
  const visibility = d.visibility ?? (req.auth!.role === 'super_admin' ? 'publico' : 'privado');
  const { rows } = await query(
    `INSERT INTO question_banks (name, kind, comunidad_autonoma, anio, categoria_profesional, official, descripcion, sim_questions, sim_minutes, sim_pass_pct, created_by, visibility)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id, name, kind, comunidad_autonoma, anio, categoria_profesional, official, sim_questions, sim_minutes, sim_pass_pct, visibility`,
    [d.name, d.kind, d.comunidadAutonoma ?? null, d.anio ?? null, d.categoriaProfesional ?? null, d.official, d.descripcion ?? null,
      d.simQuestions ?? null, d.simMinutes ?? null, d.simPassPct ?? null, req.auth!.sub, visibility],
  );
  res.status(201).json({ bank: rows[0] });
}

/** Editar un banco. Solo se tocan los campos enviados (null = limpiar). */
export async function updateBank(req: Request, res: Response): Promise<void> {
  await assertBankOwner(req, req.params.id);
  const d = createSchema.partial().parse(req.body);
  const map: Record<string, unknown> = {
    name: d.name,
    kind: d.kind,
    comunidad_autonoma: d.comunidadAutonoma,
    anio: d.anio,
    categoria_profesional: d.categoriaProfesional,
    official: d.official,
    descripcion: d.descripcion,
    sim_questions: d.simQuestions,
    sim_minutes: d.simMinutes,
    sim_pass_pct: d.simPassPct,
  };
  const fields: string[] = [];
  const params: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) { params.push(val === '' ? null : val); fields.push(`${col} = $${params.length}`); }
  }
  if (fields.length === 0) throw badRequest('Nada que actualizar');
  params.push(req.params.id);
  const { rows } = await query(
    `UPDATE question_banks SET ${fields.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, kind, comunidad_autonoma, anio, categoria_profesional, official, descripcion, sim_questions, sim_minutes, sim_pass_pct`,
    params,
  );
  if (rows.length === 0) throw notFound('Banco no encontrado');
  res.json({ bank: rows[0] });
}

/** Borra un banco y todas sus preguntas. */
export async function deleteBank(req: Request, res: Response): Promise<void> {
  await assertBankOwner(req, req.params.id);
  const bank = await query('SELECT 1 FROM question_banks WHERE id = $1', [req.params.id]);
  if (bank.rows.length === 0) throw notFound('Banco no encontrado');
  await query('DELETE FROM questions WHERE bank_id = $1', [req.params.id]);
  await query('DELETE FROM question_banks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}

/** Descarga las preguntas del banco en JSON (mismo formato que la importación). */
export async function exportBank(req: Request, res: Response): Promise<void> {
  // Los bancos públicos NO se descargan: solo se usan como fuente de preguntas.
  await assertBankOwner(req, req.params.id);
  const bank = await query<{ name: string }>('SELECT name FROM question_banks WHERE id = $1', [req.params.id]);
  if (bank.rows.length === 0) throw notFound('Banco no encontrado');

  const { rows } = await query<{ tema: string | null; text: string; options: string[]; correct_index: number; explanation: string | null }>(
    'SELECT tema, text, options, correct_index, explanation FROM questions WHERE bank_id = $1 ORDER BY created_at',
    [req.params.id],
  );
  const data = rows.map((q) => ({
    tema: q.tema ?? undefined,
    text: q.text,
    options: q.options,
    correcta: 'ABCDEF'[q.correct_index] ?? String(q.correct_index + 1),
    explicacion: q.explanation ?? undefined,
  }));
  const safe = bank.rows[0].name.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-') || 'banco';
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${safe}.json"`);
  res.send(JSON.stringify(data, null, 2));
}

/**
 * Listado de bancos con filtros.
 *
 * Con veinte bancos, elegir el de un examen a ojo es inviable. Los filtros se
 * resuelven en el servidor y no en el navegador, para que sigan sirviendo
 * cuando haya cientos.
 *
 * Las dos dimensiones libres del banco cambian de significado segun el tipo
 * (en RCP son institucion y poblacion objetivo; en OPE, comunidad y categoria)
 * pero se guardan en las mismas columnas: el filtro es el mismo y solo cambia
 * la etiqueta que ve quien lo usa.
 */
export async function listBanks(req: Request, res: Response): Promise<void> {
  const isSuper = !req.auth || req.auth.role === 'super_admin';
  const uid = req.auth?.sub ?? null;
  const f = req.query as Record<string, string | undefined>;

  const visibles = "($1::boolean OR b.visibility = 'publico' OR b.created_by = $2)";
  const conds = [visibles];
  const params: unknown[] = [isSuper, uid];

  if (f.kind) { params.push(f.kind); conds.push(`b.kind = $${params.length}`); }
  if (f.dim1) { params.push(f.dim1); conds.push(`b.comunidad_autonoma = $${params.length}`); }
  if (f.dim2) { params.push(f.dim2); conds.push(`b.categoria_profesional = $${params.length}`); }
  if (f.anio) { params.push(Number(f.anio)); conds.push(`b.anio = $${params.length}`); }
  if (f.visibility) { params.push(f.visibility); conds.push(`b.visibility = $${params.length}`); }
  if (f.official === '1') conds.push('b.official = TRUE');
  if (f.mine === '1' && uid) { params.push(uid); conds.push(`b.created_by = $${params.length}`); }
  if (f.q) {
    params.push(`%${f.q}%`);
    conds.push(`(b.name ILIKE $${params.length} OR b.descripcion ILIKE $${params.length})`);
  }
  // Con contenido: evita ofrecer bancos vacios al montar un examen.
  if (f.conPreguntas === '1') conds.push('EXISTS (SELECT 1 FROM questions q WHERE q.bank_id = b.id AND q.is_active)');

  const { rows } = await query(
    `SELECT b.id, b.name, b.kind, b.comunidad_autonoma, b.anio, b.categoria_profesional, b.official, b.descripcion,
            b.sim_questions, b.sim_minutes, b.sim_pass_pct, b.visibility, b.created_by,
            ($2::uuid IS NOT NULL AND b.created_by = $2) AS mine,
            (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id) AS questions
     FROM question_banks b
     WHERE ${conds.join(' AND ')}
     ORDER BY (b.created_by = $2) DESC NULLS LAST, (b.kind = 'rcp') DESC, b.created_at DESC`,
    params,
  );

  // Valores que existen de verdad, para no ofrecer filtros que no dan resultado.
  const facetas = await query<{ campo: string; valor: string; n: string }>(
    `SELECT 'kind' AS campo, b.kind AS valor, COUNT(*)::text AS n FROM question_banks b
      WHERE ${visibles} GROUP BY b.kind
     UNION ALL
     SELECT 'dim1', b.comunidad_autonoma, COUNT(*)::text FROM question_banks b
      WHERE ${visibles} AND b.comunidad_autonoma IS NOT NULL GROUP BY b.comunidad_autonoma
     UNION ALL
     SELECT 'dim2', b.categoria_profesional, COUNT(*)::text FROM question_banks b
      WHERE ${visibles} AND b.categoria_profesional IS NOT NULL GROUP BY b.categoria_profesional
     UNION ALL
     SELECT 'anio', b.anio::text, COUNT(*)::text FROM question_banks b
      WHERE ${visibles} AND b.anio IS NOT NULL GROUP BY b.anio
     ORDER BY 1, 2`,
    [isSuper, uid],
  );
  const agrupar = (campo: string) =>
    facetas.rows.filter((x) => x.campo === campo).map((x) => ({ valor: x.valor, n: Number(x.n) }));

  res.json({
    // canManage: puede editar, borrar y descargar (solo el dueno o el super admin)
    banks: rows.map((b) => ({ ...b, canManage: isSuper || b.mine === true })),
    total: rows.length,
    facetas: { kind: agrupar('kind'), dim1: agrupar('dim1'), dim2: agrupar('dim2'), anio: agrupar('anio') },
  });
}

/**
 * GET /api/banks/:id/questions — preguntas de un banco, con filtros.
 * Sirve tanto para revisar el banco como para escoger de que parte sale un
 * examen sin tener que abrirlo entero.
 */
export async function listBankQuestions(req: Request, res: Response): Promise<void> {
  const bankId = req.params.id;
  const f = req.query as Record<string, string | undefined>;

  const conds = ['q.bank_id = $1'];
  const params: unknown[] = [bankId];
  if (f.activas !== '0') conds.push('q.is_active = TRUE');
  if (f.tema) { params.push(f.tema); conds.push(`q.tema = $${params.length}`); }
  if (f.dificultad) { params.push(Number(f.dificultad)); conds.push(`q.difficulty = $${params.length}`); }
  if (f.qtype) { params.push(f.qtype); conds.push(`q.qtype = $${params.length}`); }
  if (f.audiencia) { params.push(f.audiencia); conds.push(`$${params.length} = ANY(q.audiences)`); }
  if (f.media === 'imagen') conds.push('q.image_key IS NOT NULL');
  else if (f.media === 'video') conds.push("q.video_url IS NOT NULL AND q.video_url <> ''");
  else if (f.media === 'sin') conds.push("q.image_key IS NULL AND (q.video_url IS NULL OR q.video_url = '')");
  if (f.criticas === '1') conds.push('q.is_critical = TRUE');
  if (f.q) { params.push(`%${f.q}%`); conds.push(`q.text ILIKE $${params.length}`); }

  const { rows } = await query(
    `SELECT q.id, q.orden, q.tema, q.difficulty, q.qtype, q.audiences, q.is_critical, q.is_active,
            LEFT(q.text, 180) AS text, (q.image_key IS NOT NULL) AS con_imagen,
            (q.video_url IS NOT NULL AND q.video_url <> '') AS con_video
       FROM questions q
      WHERE ${conds.join(' AND ')}
      ORDER BY q.orden NULLS LAST, q.created_at
      LIMIT 500`,
    params,
  );

  // Facetas del propio banco: solo se ofrecen valores que existen en el.
  const facetas = await query<{ campo: string; valor: string; n: string }>(
    `SELECT 'tema' AS campo, COALESCE(tema, '(sin materia)') AS valor, COUNT(*)::text AS n
       FROM questions WHERE bank_id = $1 AND is_active GROUP BY tema
     UNION ALL
     SELECT 'dificultad', difficulty::text, COUNT(*)::text FROM questions
      WHERE bank_id = $1 AND is_active AND difficulty IS NOT NULL GROUP BY difficulty
     UNION ALL
     SELECT 'qtype', qtype, COUNT(*)::text FROM questions
      WHERE bank_id = $1 AND is_active GROUP BY qtype
     UNION ALL
     SELECT 'audiencia', a, COUNT(*)::text FROM questions, UNNEST(audiences) a
      WHERE bank_id = $1 AND is_active GROUP BY a
     ORDER BY 1, 2`,
    [bankId],
  );
  const agrupar = (campo: string) =>
    facetas.rows.filter((x) => x.campo === campo).map((x) => ({ valor: x.valor, n: Number(x.n) }));

  res.json({
    questions: rows,
    total: rows.length,
    facetas: {
      tema: agrupar('tema'), dificultad: agrupar('dificultad'),
      qtype: agrupar('qtype'), audiencia: agrupar('audiencia'),
    },
  });
}

/** Temas de un banco con nº de preguntas (para elegir en la práctica). */
export async function getBankTemas(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT COALESCE(tema, '(sin tema)') AS tema, COUNT(*) AS questions
     FROM questions WHERE bank_id = $1 AND is_active = TRUE GROUP BY tema ORDER BY tema`,
    [req.params.id],
  );
  res.json({ temas: rows });
}

// ---------------------------------------------------------------------------
// super_admin: import questions (JSON) into a bank, with tema
// ---------------------------------------------------------------------------
export async function importBankQuestions(req: Request, res: Response): Promise<void> {
  await assertBankOwner(req, req.params.id);
  const bank = await query('SELECT 1 FROM question_banks WHERE id = $1', [req.params.id]);
  if (bank.rows.length === 0) throw notFound('Banco no encontrado');

  const { questions } = z.object({ questions: z.array(z.record(z.unknown())).min(1, 'Lista vacía') }).parse(req.body);
  const errors: Array<{ fila: number; errores: string[] }> = [];
  let created = 0;
  let duplicadas = 0;
  const seenInFile = new Set<string>();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const errs: string[] = [];
    const text = String(q.text ?? q.enunciado ?? '').trim();
    const options = toList(q.options ?? q.opciones);
    const tema = String(q.tema ?? '').trim() || null;
    if (text.length < 3) errs.push('enunciado vacío');
    if (options.length < 2) errs.push('faltan opciones (mínimo 2)');
    const ci = resolveCorrect(q.correcta ?? q.correct, options.length);
    if (ci === null) errs.push('correcta inválida (A/B/C/D o número)');

    if (errs.length > 0) { errors.push({ fila: i + 1, errores: errs }); continue; }

    // Duplicada dentro del propio fichero.
    const key = text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
    if (seenInFile.has(key)) { duplicadas += 1; continue; }
    seenInFile.add(key);

    // Duplicada respecto a lo que ya hay en el banco (misma pregunta ya subida).
    const dup = await query(
      `SELECT 1 FROM questions
        WHERE bank_id = $1 AND text_norm = md5(lower(regexp_replace($2, '[^[:alnum:]]+', '', 'g')))`,
      [req.params.id, text],
    );
    if (dup.rows.length > 0) { duplicadas += 1; continue; }

    await query(
      `INSERT INTO questions (bank_id, tema, category, text, options, correct_index, explanation, created_by, text_norm)
       VALUES ($1,$2,NULL,$3,$4::jsonb,$5,$6,$7, md5(lower(regexp_replace($3, '[^[:alnum:]]+', '', 'g'))))`,
      [req.params.id, tema, text, JSON.stringify(options), ci, String(q.explicacion ?? q.explanation ?? '').trim() || null, req.auth!.sub],
    );
    created += 1;
  }

  // Aviso claro si parece que se ha reimportado el mismo banco.
  const posibleReimport = duplicadas > 0 && created === 0;
  res.json({ created, duplicadas, total: questions.length, errors, posibleReimport });
}

// ---------------------------------------------------------------------------
// Banco de fallos GENERAL (las preguntas más falladas por todos)
// ---------------------------------------------------------------------------
export async function globalFailedStats(req: Request, res: Response): Promise<void> {
  const bankId = req.query.bankId as string | undefined;
  const { rows } = await query(
    `SELECT q.id, q.tema, q.category, LEFT(q.text, 90) AS text,
            COUNT(*) FILTER (WHERE NOT al.is_correct) AS fallos,
            COUNT(*) AS respuestas,
            ROUND(100.0 * COUNT(*) FILTER (WHERE NOT al.is_correct) / NULLIF(COUNT(*),0)) AS pct_fallo
     FROM answer_log al JOIN questions q ON q.id = al.question_id
     ${bankId ? 'WHERE al.bank_id = $1' : ''}
     GROUP BY q.id, q.tema, q.category, q.text
     HAVING COUNT(*) FILTER (WHERE NOT al.is_correct) > 0
     ORDER BY fallos DESC LIMIT 50`,
    bankId ? [bankId] : [],
  );
  res.json({ questions: rows });
}
