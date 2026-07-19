import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Bulk question import — from Excel (.xlsx) or JSON (.json).
 *   GET  /api/admin/questions/template?format=xlsx|json  -> download template/example
 *   POST /api/admin/questions/import                     -> upload a filled file
 * Each row/object may reference its source document by title + page, so the
 * questions come out already linked to the ERC/PNRCP page that explains them.
 */

const COLUMNS = [
  'nivel', 'publicos', 'tipo', 'dificultad', 'contexto_clinico', 'enunciado',
  'opcion_a', 'opcion_b', 'opcion_c', 'opcion_d', 'correcta', 'explicacion',
  'documento', 'pagina', 'flashcard', 'etiquetas', 'critica',
];

/** lowercase + strip accents, for tolerant matching. */
function norm(s: unknown): string {
  return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function splitList(s: unknown): string[] {
  if (Array.isArray(s)) return s.map((x) => String(x).trim()).filter(Boolean);
  return String(s ?? '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
}

// A format-agnostic parsed row (both Excel and JSON produce this shape).
interface ParsedRow {
  fila: number;
  nivel: string;
  publicos: string[];
  tipo: unknown;
  dificultad: unknown;
  contexto_clinico: string;
  enunciado: string;
  opciones: string[];
  correcta: unknown; // letter A-D or 1-based number
  explicacion: string;
  documento: string;
  pagina: unknown;
  flashcard: string;
  etiquetas: string[];
  critica: unknown;
}

const EXAMPLE_JSON = [
  {
    nivel: 'SVB',
    publicos: ['jovenes', 'adultos'],
    tipo: 'teorica',
    dificultad: 'facil',
    enunciado: '¿Cuál es la frecuencia recomendada de compresiones en el adulto?',
    opciones: ['60-80 por minuto', '100-120 por minuto', '140-160 por minuto'],
    correcta: 'B',
    explicacion: 'Las guías recomiendan 100-120 compresiones por minuto.',
    documento: 'Guía ERC 2025',
    pagina: 45,
    flashcard: 'Comprime a 100-120 por minuto.',
    etiquetas: ['compresiones', 'frecuencia'],
    critica: true,
  },
  {
    nivel: 'SVB',
    publicos: ['ninos'],
    tipo: 'caso_clinico',
    dificultad: 'facil',
    contexto_clinico: 'En el patio, un compañero se cae y no responde ni se mueve.',
    enunciado: '¿Qué es lo PRIMERO que debes hacer?',
    opciones: ['Ir a buscar agua', 'Pedir ayuda a un adulto y llamar al 112', 'Sacudirle fuerte'],
    correcta: 'B',
    explicacion: 'Lo primero es pedir ayuda a un adulto y activar el 112.',
    documento: 'Manual PNRCP',
    pagina: 12,
    flashcard: 'Si alguien no responde: pide ayuda y llama al 112.',
    etiquetas: ['reconocimiento', '112'],
    critica: false,
  },
];

// ---------------------------------------------------------------------------
// Template / example download
// ---------------------------------------------------------------------------
export function getTemplate(req: Request, res: Response): void {
  if (String(req.query.format) === 'json') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="ejemplo-preguntas-rcp.json"');
    res.send(JSON.stringify(EXAMPLE_JSON, null, 2));
    return;
  }

  const examples = EXAMPLE_JSON.map((q) => [
    q.nivel, q.publicos.join(', '), q.tipo, q.dificultad, (q as { contexto_clinico?: string }).contexto_clinico ?? '',
    q.enunciado, q.opciones[0] ?? '', q.opciones[1] ?? '', q.opciones[2] ?? '', q.opciones[3] ?? '',
    q.correcta, q.explicacion, q.documento, q.pagina, q.flashcard, q.etiquetas.join(', '), q.critica ? 'si' : 'no',
  ]);
  const help = [
    ['Columna', 'Valores válidos'],
    ['nivel', 'SVB, SVI o SVA'],
    ['publicos', 'uno o varios: ninos, jovenes, adultos'],
    ['tipo', 'teorica o caso_clinico'],
    ['dificultad', 'facil, media, dificil (o 1, 2, 3)'],
    ['contexto_clinico', 'solo para caso_clinico'],
    ['correcta', 'letra de la opción correcta: A, B, C o D'],
    ['documento', 'TÍTULO exacto de un documento ya subido en "Documentos"'],
    ['pagina', 'número de página'],
    ['critica', 'si / no'],
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([COLUMNS, ...examples]), 'Preguntas');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(help), 'Instrucciones');
  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-preguntas-rcp.xlsx"');
  res.send(buf);
}

// ---------------------------------------------------------------------------
// Parsing (Excel / JSON) -> ParsedRow[]
// ---------------------------------------------------------------------------
function parseExcel(buffer: Buffer): ParsedRow[] {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  return raw.map((r0, i) => {
    const r: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(r0)) r[norm(k).replace(/\s+/g, '_')] = v;
    return {
      fila: i + 2,
      nivel: String(r['nivel'] ?? ''),
      publicos: splitList(r['publicos']),
      tipo: r['tipo'],
      dificultad: r['dificultad'],
      contexto_clinico: String(r['contexto_clinico'] ?? ''),
      enunciado: String(r['enunciado'] ?? ''),
      opciones: ['opcion_a', 'opcion_b', 'opcion_c', 'opcion_d'].map((k) => String(r[k] ?? '').trim()).filter(Boolean),
      correcta: r['correcta'],
      explicacion: String(r['explicacion'] ?? ''),
      documento: String(r['documento'] ?? ''),
      pagina: r['pagina'],
      flashcard: String(r['flashcard'] ?? ''),
      etiquetas: splitList(r['etiquetas']),
      critica: r['critica'],
    };
  });
}

function parseJson(buffer: Buffer): ParsedRow[] {
  let data: unknown;
  try {
    data = JSON.parse(buffer.toString('utf8'));
  } catch {
    throw badRequest('El JSON no es válido (revisa comas y llaves)', 'BAD_JSON');
  }
  if (!Array.isArray(data)) throw badRequest('El JSON debe ser una lista [ ... ] de preguntas', 'JSON_NOT_ARRAY');
  return data.map((o0, i) => {
    const o = (o0 ?? {}) as Record<string, unknown>;
    return {
      fila: i + 1,
      nivel: String(o.nivel ?? ''),
      publicos: splitList(o.publicos),
      tipo: o.tipo,
      dificultad: o.dificultad,
      contexto_clinico: String(o.contexto_clinico ?? ''),
      enunciado: String(o.enunciado ?? ''),
      opciones: splitList(o.opciones),
      correcta: o.correcta,
      explicacion: String(o.explicacion ?? ''),
      documento: String(o.documento ?? ''),
      pagina: o.pagina,
      flashcard: String(o.flashcard ?? ''),
      etiquetas: splitList(o.etiquetas),
      critica: o.critica,
    };
  });
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
const LEVELS = new Set(['SVB', 'SVI', 'SVA']);
const AUDIENCE_MAP: Record<string, 'ninos' | 'jovenes' | 'adultos'> = {
  ninos: 'ninos', nino: 'ninos', jovenes: 'jovenes', joven: 'jovenes', adultos: 'adultos', adulto: 'adultos',
};
const DIFFICULTY_MAP: Record<string, number> = { facil: 1, media: 2, medio: 2, dificil: 3, '1': 1, '2': 2, '3': 3 };

function resolveCorrectIndex(correcta: unknown, optionCount: number): number | null {
  const s = norm(correcta).toUpperCase();
  const asLetter = { A: 0, B: 1, C: 2, D: 3, E: 4, F: 5 }[s as 'A'];
  if (asLetter !== undefined) return asLetter;
  const asNum = parseInt(s, 10); // 1-based number
  if (Number.isInteger(asNum) && asNum >= 1 && asNum <= optionCount) return asNum - 1;
  return null;
}

export async function importQuestions(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw badRequest('Falta el archivo (.xlsx o .json)', 'NO_FILE');

  // Toda importación va a un banco concreto: así no quedan preguntas huérfanas.
  const bankId = String(req.body?.bankId ?? '').trim();
  if (!bankId) throw badRequest('Elige el banco de destino antes de importar', 'NO_BANK');
  const bank = await query('SELECT 1 FROM question_banks WHERE id = $1', [bankId]);
  if (bank.rows.length === 0) throw badRequest('Banco no encontrado', 'BAD_BANK');

  const isJson = /\.json$/i.test(file.originalname) || file.mimetype === 'application/json';
  const rows = isJson ? parseJson(file.buffer) : parseExcel(file.buffer);

  const docsResult = await query<{ id: string; title: string }>('SELECT id, title FROM documents WHERE is_active = TRUE');
  const docByTitle = new Map(docsResult.rows.map((d) => [norm(d.title), d.id]));

  const errors: Array<{ fila: number; errores: string[] }> = [];
  let created = 0;
  let duplicadas = 0;

  for (const row of rows) {
    const rowErrors: string[] = [];

    // Skip fully empty rows.
    if (!row.enunciado.trim() && row.opciones.length === 0 && !row.nivel.trim()) continue;

    const nivel = row.nivel.trim().toUpperCase();
    if (!LEVELS.has(nivel)) rowErrors.push(`nivel inválido ("${nivel}"): usa SVB, SVI o SVA`);

    const audiences = [...new Set(row.publicos.map((a) => AUDIENCE_MAP[norm(a)]).filter(Boolean))];
    if (audiences.length === 0) rowErrors.push('publicos vacío: pon ninos, jovenes y/o adultos');

    const qtype = norm(row.tipo).includes('clinic') || norm(row.tipo).includes('caso') ? 'caso_clinico' : 'teorica';
    const difficulty = DIFFICULTY_MAP[norm(row.dificultad)] ?? 1;
    if (qtype === 'caso_clinico' && !row.contexto_clinico.trim()) rowErrors.push('caso_clinico sin contexto_clinico');
    if (row.enunciado.trim().length < 5) rowErrors.push('enunciado vacío o muy corto');
    if (row.opciones.length < 2) rowErrors.push('faltan opciones (mínimo 2)');

    const correctIndex = resolveCorrectIndex(row.correcta, row.opciones.length);
    if (correctIndex === null) rowErrors.push('correcta debe ser A, B, C, D (o un número de opción)');
    else if (correctIndex >= row.opciones.length) rowErrors.push('la opción correcta señalada está vacía');

    let refDocumentId: string | null = null;
    let refPage: number | null = null;
    if (row.documento.trim()) {
      const id = docByTitle.get(norm(row.documento));
      if (!id) rowErrors.push(`documento no encontrado: "${row.documento}" (súbelo antes en Documentos)`);
      else refDocumentId = id;
      const p = parseInt(String(row.pagina ?? ''), 10);
      if (Number.isInteger(p) && p > 0) refPage = p;
    }

    if (rowErrors.length > 0) {
      errors.push({ fila: row.fila, errores: rowErrors });
      continue;
    }

    // No duplicar preguntas ya existentes en el mismo banco.
    const dup = await query(
      `SELECT 1 FROM questions
        WHERE bank_id = $1 AND text_norm = md5(lower(regexp_replace($2, '[^[:alnum:]]+', '', 'g')))`,
      [bankId, row.enunciado.trim()],
    );
    if (dup.rows.length > 0) { duplicadas += 1; continue; }

    try {
      await query(
        `INSERT INTO questions
           (category, audiences, qtype, difficulty, text, clinical_context, options, correct_index,
            explanation, flashcard, tags, is_critical, ref_document_id, ref_page, created_by, bank_id, text_norm)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15,$16,
                 md5(lower(regexp_replace($5, '[^[:alnum:]]+', '', 'g'))))`,
        [
          nivel, audiences, qtype, difficulty, row.enunciado.trim(),
          qtype === 'caso_clinico' ? row.contexto_clinico.trim() : null,
          JSON.stringify(row.opciones), correctIndex,
          row.explicacion.trim() || null, row.flashcard.trim() || null, row.etiquetas,
          ['si', 'sí', 'x', 'true', '1', 'verdadero'].includes(norm(row.critica)),
          refDocumentId, refPage, req.auth!.sub, bankId,
        ],
      );
      created += 1;
    } catch (err) {
      errors.push({ fila: row.fila, errores: [`error al guardar: ${(err as Error).message}`] });
    }
  }

  await audit({
    actorId: req.auth!.sub, actorType: req.auth!.role, action: 'QUESTIONS_IMPORT',
    entity: 'question', ip: clientIp(req), metadata: { created, errores: errors.length, formato: isJson ? 'json' : 'xlsx' },
  });

  res.json({
    created,
    duplicadas,
    total: created + duplicadas + errors.length,
    errors,
    posibleReimport: duplicadas > 0 && created === 0,
  });
}
