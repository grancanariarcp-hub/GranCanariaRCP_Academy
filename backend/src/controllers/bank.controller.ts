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
const createSchema = z.object({
  name: z.string().min(2).max(160),
  kind: z.enum(['rcp', 'ope', 'mir', 'otro']).default('ope'),
  comunidadAutonoma: z.string().max(120).optional(),
  anio: z.number().int().min(1990).max(2100).optional(),
  categoriaProfesional: z.string().max(160).optional(),
  official: z.boolean().optional().default(false),
  descripcion: z.string().optional(),
});

export async function createBank(req: Request, res: Response): Promise<void> {
  const d = createSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO question_banks (name, kind, comunidad_autonoma, anio, categoria_profesional, official, descripcion)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id, name, kind, comunidad_autonoma, anio, categoria_profesional, official`,
    [d.name, d.kind, d.comunidadAutonoma ?? null, d.anio ?? null, d.categoriaProfesional ?? null, d.official, d.descripcion ?? null],
  );
  res.status(201).json({ bank: rows[0] });
}

export async function listBanks(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT b.id, b.name, b.kind, b.comunidad_autonoma, b.anio, b.categoria_profesional, b.official, b.descripcion,
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
    await query(
      `INSERT INTO questions (bank_id, tema, category, text, options, correct_index, explanation, created_by)
       VALUES ($1,$2,NULL,$3,$4::jsonb,$5,$6,$7)`,
      [req.params.id, tema, text, JSON.stringify(options), ci, String(q.explicacion ?? q.explanation ?? '').trim() || null, req.auth!.sub],
    );
    created += 1;
  }
  res.json({ created, total: questions.length, errors });
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
