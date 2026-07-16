import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool } from '../config/database.js';
import { seed } from './seed.js';

/**
 * Creates the schema (idempotent) and then runs the seed.
 * Run with: npm run db:setup   (add --reset to drop everything first)
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

const DROP_SQL = `
  DROP TABLE IF EXISTS audit_logs, test_responses, questions, students, users, institutions CASCADE;
`;

async function main() {
  const reset = process.argv.includes('--reset');
  try {
    if (reset) {
      console.log('[setup] --reset: dropping existing tables...');
      await pool.query(DROP_SQL);
    }

    const schemaPath = join(__dirname, 'schema.sql');
    const schema = await readFile(schemaPath, 'utf8');
    console.log('[setup] applying schema...');
    await pool.query(schema);
    console.log('[setup] schema ready.');

    await seed();

    console.log('[setup] done ✅');
  } catch (err) {
    console.error('[setup] failed ❌:', (err as Error).message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
