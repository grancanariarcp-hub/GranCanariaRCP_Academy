import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';
import { env } from './env.js';

/** Copias, migraciones y semillas: procesos que legítimamente tardan. */
const TAREA_DE_MANTENIMIENTO = /db[\\/](migrate|backup|setup|seed|limpiarPruebas)/.test(process.argv[1] ?? '');

/**
 * Single shared connection pool for the whole process.
 * pg manages the underlying sockets; we just borrow clients per query.
 */
export const pool = new Pool({
  connectionString: env.databaseUrl,
  // ElephantSQL / Hostinger managed Postgres often require SSL in production.
  ssl: env.isProduction ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30_000,
  // Sin estos topes, una sola consulta lenta secuestra una de las diez
  // conexiones hasta que termine —o para siempre—, y con unas pocas así la
  // plataforma entera deja de responder aunque la base esté sana.
  connectionTimeoutMillis: 10_000,
  // Ninguna petición de la aplicación necesita quince segundos de base de
  // datos: si los pasa, es que algo va mal y es mejor fallar esa petición que
  // arrastrar a las demás.
  //
  // Las tareas de mantenimiento comparten este pool y sí tardan legítimamente
  // más —una copia de seguridad vuelca tablas enteras—, así que se quedan sin
  // tope. Se distinguen por el comando que las arrancó, no por una variable de
  // entorno, para que no dependa de acordarse de ponerla.
  statement_timeout: TAREA_DE_MANTENIMIENTO ? undefined : 15_000,
});

pool.on('error', (err) => {
  // A client sitting idle in the pool errored (e.g. DB restarted).
  // Log it; the pool will discard the client and create a new one on demand.
  console.error('[db] unexpected idle client error:', err.message);
});

/** Thin query helper so call sites don't each import the pool. */
export function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params as never);
}

/**
 * Run a set of statements inside a single transaction.
 * Commits on success, rolls back on any thrown error.
 */
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Verify connectivity at boot; used by the health check and startup. */
export async function assertDatabaseConnection(): Promise<void> {
  const { rows } = await query<{ now: Date }>('SELECT NOW() as now');
  console.log(`[db] connected (server time: ${rows[0].now.toISOString()})`);
}
