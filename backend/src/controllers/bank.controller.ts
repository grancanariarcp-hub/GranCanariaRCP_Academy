import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';

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

// ---------------------------------------------------------------------------
// super_admin: create / list banks
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
});

export async function createBank(req: Request, res: Response): Promise<void> {
  const d = createSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO question_banks (name, kind, comunidad_autonoma, anio, categoria_profesional, official, descripcion, sim_questions, sim_minutes, sim_pass_pct)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING id, name, kind, comunidad_autonoma, anio, categoria_profesional, official, sim_questions, sim_minutes, sim_pass_pct`,
    [d.name, d.kind, d.comunidadAutonoma ?? null, d.anio ?? null, d.categoriaProfesional ?? null, d.official, d.descripcion ?? null,
      d.simQuestions ?? null, d.simMinutes ?? null, d.simPassPct ?? null],
  );
  res.status(201).json({ bank: rows[0] });
}

/** Editar un banco. Solo se tocan los campos enviados (null = limpiar). */
export async function updateBank(req: Request, res: Response): Promise<void> {
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
  const bank = await query('SELECT 1 FROM question_banks WHERE id = $1', [req.params.id]);
  if (bank.rows.length === 0) throw notFound('Banco no encontrado');
  await query('DELETE FROM questions WHERE bank_id = $1', [req.params.id]);
  await query('DELETE FROM question_banks WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}

/** Descarga las preguntas del banco en JSON (mismo formato que la importación). */
export async function exportBank(req: Request, res: Response): Promise<void> {
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

export async function listBanks(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT b.id, b.name, b.kind, b.comunidad_autonoma, b.anio, b.categoria_profesional, b.official, b.descripcion,
            b.sim_questions, b.sim_minutes, b.sim_pass_pct,
            (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id) AS questions
     FROM question_banks b ORDER BY (b.kind = 'rcp') DESC, b.created_at DESC`,
  );
  res.json({ banks: rows });
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
