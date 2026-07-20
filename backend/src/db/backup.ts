import { mkdirSync, createWriteStream } from 'node:fs';
import { resolve } from 'node:path';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { pool, query } from '../config/database.js';

/**
 * Copia de seguridad de los datos sin depender de pg_dump (que no viene con
 * Node y no está instalado en Windows por defecto).
 *
 * El ESQUEMA vive en git (src/db/migrations), así que para restaurar basta con
 * crear la base, ejecutar `npm run db:migrate` y volcar este fichero. Por eso
 * aquí solo se guardan los DATOS, como sentencias INSERT en orden de
 * dependencias, envueltas en una transacción.
 *
 *   npm run db:backup                  -> ./backups/rcp-AAAA-MM-DD-HHmm.sql.gz
 *   npm run db:backup -- --dir "D:/copias"
 *
 * El fichero contiene datos personales: guárdalo cifrado o en una carpeta
 * privada, nunca dentro del repositorio (backups/ está en .gitignore).
 */

/** Orden de volcado: las tablas referenciadas van antes que quienes las apuntan. */
const ORDEN = [
  'taxonomies',
  'institutions', 'users', 'cv_items', 'classes', 'students',
  'question_banks', 'questions',
  'courses', 'course_staff', 'modules', 'documents', 'exams', 'exam_questions',
  'activities', 'course_images',
  'enrollments', 'activity_completions', 'exam_attempts',
  'challenges', 'challenge_attempts',
  'practice_sessions', 'practice_tests', 'learning_time',
  'course_surveys', 'survey_responses', 'survey_item_scores',
  'issued_certificates', 'notifications', 'forum_threads', 'forum_posts',
  'question_reports', 'consent_log', 'platform_settings',
  'answer_log', 'test_responses', 'audit_logs',
  'attendance_sessions', 'attendance_records',
  'acta_counters', 'course_actas',
  'recognition_templates', 'issued_recognitions',
  'receipt_counters', 'payments',
  'ope_convocatorias', 'ope_convocatoria_banks',
  'leads', 'anon_practice', 'sessions',
  '_migrations',
];

function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (Array.isArray(v) || (typeof v === 'object' && v !== null)) {
    // jsonb y text[] se reconstruyen desde su representación textual.
    return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  }
  return `'${String(v).replace(/'/g, "''")}'`;
}

async function tablasExistentes(): Promise<string[]> {
  const { rows } = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'`,
  );
  const presentes = new Set(rows.map((r) => r.table_name));
  const ordenadas = ORDEN.filter((t) => presentes.has(t));
  // Cualquier tabla nueva que aún no esté en ORDEN se vuelca al final.
  const resto = [...presentes].filter((t) => !ORDEN.includes(t)).sort();
  if (resto.length > 0) console.warn(`   (tablas fuera del orden previsto: ${resto.join(', ')})`);
  return [...ordenadas, ...resto];
}

async function main(): Promise<void> {
  const dirArg = process.argv.indexOf('--dir');
  const dir = resolve(dirArg > -1 ? process.argv[dirArg + 1] : 'backups');
  mkdirSync(dir, { recursive: true });

  const t = new Date();
  const sello = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}-${String(t.getHours()).padStart(2, '0')}${String(t.getMinutes()).padStart(2, '0')}`;
  const destino = resolve(dir, `rcp-${sello}.sql.gz`);

  const tablas = await tablasExistentes();
  console.log(`Copia de seguridad -> ${destino}`);

  let totalFilas = 0;
  async function* generar(): AsyncGenerator<string> {
    yield `-- Copia de datos de GranCanaria RCP Academy — ${t.toISOString()}\n`;
    yield '-- Restaurar: crear la base, `npm run db:migrate`, y volcar este fichero.\n';
    yield 'BEGIN;\nSET session_replication_role = replica;\n\n';

    for (const tabla of tablas) {
      const { rows } = await query<Record<string, unknown>>(`SELECT * FROM "${tabla}"`);
      if (rows.length === 0) {
        console.log(`  ${tabla}: vacía`);
        continue;
      }
      totalFilas += rows.length;
      console.log(`  ${tabla}: ${rows.length} filas`);
      const cols = Object.keys(rows[0]);
      yield `-- ${tabla} (${rows.length})\n`;
      const lista = cols.map((c) => `"${c}"`).join(', ');
      for (const fila of rows) {
        const vals = cols.map((c) => sqlLiteral(fila[c])).join(', ');
        yield `INSERT INTO "${tabla}" (${lista}) VALUES (${vals}) ON CONFLICT DO NOTHING;\n`;
      }
      yield '\n';
    }
    yield 'SET session_replication_role = DEFAULT;\nCOMMIT;\n';
  }

  await pipeline(Readable.from(generar()), createGzip(), createWriteStream(destino));
  console.log(`\nListo: ${totalFilas} filas en ${tablas.length} tablas.`);
  console.log('Contiene datos personales: guárdalo en lugar privado, nunca en el repositorio.');
}

main()
  .catch((e) => {
    console.error('La copia ha fallado:', e);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
