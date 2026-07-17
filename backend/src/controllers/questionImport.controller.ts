import type { Request, Response } from 'express';
import * as XLSX from 'xlsx';
import { query } from '../config/database.js';
import { badRequest } from '../utils/httpError.js';
import { audit } from '../services/audit.js';
import { clientIp } from '../utils/asyncHandler.js';

/**
 * Bulk question import from an Excel (.xlsx) template.
 *   GET  /api/admin/questions/template  -> download the template
 *   POST /api/admin/questions/import    -> upload a filled template
 * Each row references its source document by title + page, so questions
 * come out already linked to the ERC/PNRCP page that explains them.
 */

const COLUMNS = [
  'nivel',
  'publicos',
  'tipo',
  'dificultad',
  'contexto_clinico',
  'enunciado',
  'opcion_a',
  'opcion_b',
  'opcion_c',
  'opcion_d',
  'correcta',
  'explicacion',
  'documento',
  'pagina',
  'flashcard',
  'etiquetas',
  'critica',
];

/** lowercase + strip accents, for tolerant matching of values/headers. */
function norm(s: unknown): string {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function splitList(s: unknown): string[] {
  return String(s ?? '')
    .split(/[,;]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Template download
// ---------------------------------------------------------------------------
export function getTemplate(_req: Request, res: Response): void {
  const header = COLUMNS;
  const examples = [
    [
      'SVB',
      'jovenes, adultos',
      'teorica',
      'facil',
      '',
      '¿Cuál es la frecuencia recomendada de compresiones en el adulto?',
      '60-80 por minuto',
      '100-120 por minuto',
      '140-160 por minuto',
      '',
      'B',
      'Las guías recomiendan 100-120 compresiones por minuto.',
      'Guía ERC 2025',
      '45',
      'Comprime a 100-120 por minuto.',
      'compresiones, frecuencia',
      'si',
    ],
    [
      'SVB',
      'ninos',
      'caso_clinico',
      'facil',
      'En el patio, un compañero se cae y no responde ni se mueve.',
      '¿Qué es lo PRIMERO que debes hacer?',
      'Ir a buscar agua',
      'Pedir ayuda a un adulto y llamar al 112',
      'Sacudirle fuerte',
      'Irte a clase',
      'B',
      'Lo primero es pedir ayuda a un adulto y activar el 112.',
      'Manual PNRCP',
      '12',
      'Si alguien no responde: pide ayuda y llama al 112.',
      'reconocimiento, 112',
      'no',
    ],
  ];

  const help = [
    ['Columna', 'Valores válidos / formato'],
    ['nivel', 'SVB, SVI o SVA'],
    ['publicos', 'uno o varios separados por coma: ninos, jovenes, adultos'],
    ['tipo', 'teorica  o  caso_clinico'],
    ['dificultad', 'facil, media, dificil  (o 1, 2, 3)'],
    ['contexto_clinico', 'solo para caso_clinico: el escenario'],
    ['enunciado', 'la pregunta'],
    ['opcion_a..d', 'las opciones (mínimo 2; deja en blanco las que no uses)'],
    ['correcta', 'letra de la opción correcta: A, B, C o D'],
    ['explicacion', 'por qué es correcta (debriefing)'],
    ['documento', 'el TÍTULO exacto de un documento ya subido en "Documentos"'],
    ['pagina', 'número de página dentro de ese documento'],
    ['flashcard', 'frase clave para recordar (opcional)'],
    ['etiquetas', 'separadas por coma (opcional)'],
    ['critica', 'si / no'],
  ];

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([header, ...examples]);
  XLSX.utils.book_append_sheet(wb, ws, 'Preguntas');
  const wsHelp = XLSX.utils.aoa_to_sheet(help);
  XLSX.utils.book_append_sheet(wb, wsHelp, 'Instrucciones');

  const buf: Buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="plantilla-preguntas-rcp.xlsx"');
  res.send(buf);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
interface RowError {
  fila: number;
  errores: string[];
}

const LEVELS = new Set(['SVB', 'SVI', 'SVA']);
const AUDIENCE_MAP: Record<string, 'ninos' | 'jovenes' | 'adultos'> = {
  ninos: 'ninos',
  nino: 'ninos',
  jovenes: 'jovenes',
  joven: 'jovenes',
  adultos: 'adultos',
  adulto: 'adultos',
};
const DIFFICULTY_MAP: Record<string, number> = {
  facil: 1,
  media: 2,
  medio: 2,
  dificil: 3,
  '1': 1,
  '2': 2,
  '3': 3,
};

export async function importQuestions(req: Request, res: Response): Promise<void> {
  const file = req.file;
  if (!file) throw badRequest('Falta el archivo de la plantilla (.xlsx)', 'NO_FILE');

  let rows: Record<string, unknown>[];
  try {
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    // Normalise header keys so accents/casing/spaces don't matter.
    rows = raw.map((r) => {
      const o: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) o[norm(k).replace(/\s+/g, '_')] = v;
      return o;
    });
  } catch {
    throw badRequest('No pude leer el archivo. ¿Es un Excel (.xlsx) válido?', 'BAD_FILE');
  }

  // Preload documents to resolve references by title.
  const docsResult = await query<{ id: string; title: string }>('SELECT id, title FROM documents WHERE is_active = TRUE');
  const docByTitle = new Map(docsResult.rows.map((d) => [norm(d.title), d.id]));

  const errors: RowError[] = [];
  let created = 0;

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fila = i + 2; // +1 header, +1 to be 1-based like Excel
    const rowErrors: string[] = [];

    // Skip completely empty rows silently.
    const enunciado = String(r['enunciado'] ?? '').trim();
    const anyContent = Object.values(r).some((v) => String(v ?? '').trim() !== '');
    if (!anyContent) continue;

    const nivel = String(r['nivel'] ?? '').trim().toUpperCase();
    if (!LEVELS.has(nivel)) rowErrors.push(`nivel inválido ("${nivel}"): usa SVB, SVI o SVA`);

    const audiences = [...new Set(splitList(r['publicos']).map((a) => AUDIENCE_MAP[norm(a)]).filter(Boolean))];
    if (audiences.length === 0) rowErrors.push('publicos vacío: pon al menos ninos, jovenes o adultos');

    const qtype = norm(r['tipo']).includes('clinic') || norm(r['tipo']).includes('caso') ? 'caso_clinico' : 'teorica';
    const difficulty = DIFFICULTY_MAP[norm(r['dificultad'])] ?? 1;
    const clinicalContext = String(r['contexto_clinico'] ?? '').trim();
    if (qtype === 'caso_clinico' && !clinicalContext) rowErrors.push('caso_clinico sin contexto_clinico');

    if (enunciado.length < 5) rowErrors.push('enunciado vacío o demasiado corto');

    const options = ['opcion_a', 'opcion_b', 'opcion_c', 'opcion_d']
      .map((k) => String(r[k] ?? '').trim())
      .filter(Boolean);
    if (options.length < 2) rowErrors.push('faltan opciones (mínimo 2)');

    const letter = norm(r['correcta']).toUpperCase();
    const correctIndex = { A: 0, B: 1, C: 2, D: 3 }[letter as 'A' | 'B' | 'C' | 'D'];
    if (correctIndex === undefined) rowErrors.push('correcta debe ser A, B, C o D');
    else if (correctIndex >= options.length) rowErrors.push(`la opción correcta (${letter}) está vacía`);

    // Optional document reference.
    let refDocumentId: string | null = null;
    let refPage: number | null = null;
    const docTitle = String(r['documento'] ?? '').trim();
    if (docTitle) {
      const id = docByTitle.get(norm(docTitle));
      if (!id) rowErrors.push(`documento no encontrado: "${docTitle}" (súbelo antes en Documentos)`);
      else refDocumentId = id;
      const p = parseInt(String(r['pagina'] ?? ''), 10);
      if (Number.isInteger(p) && p > 0) refPage = p;
    }

    if (rowErrors.length > 0) {
      errors.push({ fila, errores: rowErrors });
      continue;
    }

    try {
      await query(
        `INSERT INTO questions
           (category, audiences, qtype, difficulty, text, clinical_context, options, correct_index,
            explanation, flashcard, tags, is_critical, ref_document_id, ref_page, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [
          nivel,
          audiences,
          qtype,
          difficulty,
          enunciado,
          qtype === 'caso_clinico' ? clinicalContext : null,
          JSON.stringify(options),
          correctIndex,
          String(r['explicacion'] ?? '').trim() || null,
          String(r['flashcard'] ?? '').trim() || null,
          splitList(r['etiquetas']),
          ['si', 'sí', 'x', 'true', '1'].includes(norm(r['critica'])),
          refDocumentId,
          refPage,
          req.auth!.sub,
        ],
      );
      created += 1;
    } catch (err) {
      errors.push({ fila, errores: [`error al guardar: ${(err as Error).message}`] });
    }
  }

  await audit({
    actorId: req.auth!.sub,
    actorType: req.auth!.role,
    action: 'QUESTIONS_IMPORT',
    entity: 'question',
    ip: clientIp(req),
    metadata: { created, errores: errors.length },
  });

  res.json({ created, total: created + errors.length, errors });
}
