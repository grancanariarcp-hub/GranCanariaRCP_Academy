import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pool, query } from '../config/database.js';

/**
 * Minimal forward-only migration runner.
 * Applies every .sql file in ./migrations (sorted by name) exactly once,
 * tracking applied files in a _migrations table. Safe to run repeatedly.
 *   dev:  npm run db:migrate
 *   prod: node dist/db/migrate.js
 */
const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, 'migrations');

async function main(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS _migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
     )`,
  );

  const files = (await readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();
  for (const file of files) {
    const already = await query('SELECT 1 FROM _migrations WHERE name = $1', [file]);
    if (already.rows.length > 0) {
      console.log(`[migrate] skip ${file} (already applied)`);
      continue;
    }
    const sql = await readFile(join(migrationsDir, file), 'utf8');
    console.log(`[migrate] applying ${file}...`);
    await query(sql);
    await query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    console.log(`[migrate] applied ${file} ✅`);
  }
  console.log('[migrate] up to date.');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('[migrate] failed ❌:', (err as Error).message);
    return pool.end().finally(() => process.exit(1));
  });
