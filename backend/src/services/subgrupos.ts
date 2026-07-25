import { query, withTransaction } from '../config/database.js';

/**
 * Subgrupos de alumnos dentro de un curso.
 *
 * El director reparte a los matriculados en subgrupos —normalmente por colores—
 * para la parte práctica en PÚLSAR. El reparto puede ser automático (aleatorio,
 * equilibrado) o manual. Solo se muestra si el curso tiene la casilla activada.
 */

/** Colores primarios primero, como acordamos con PÚLSAR. */
export const COLORES: Array<{ nombre: string; color: string }> = [
  { nombre: 'Rojo', color: '#e23b3b' },
  { nombre: 'Azul', color: '#2f6fe0' },
  { nombre: 'Amarillo', color: '#e8c020' },
  { nombre: 'Verde', color: '#3bb26a' },
  { nombre: 'Naranja', color: '#e8792a' },
  { nombre: 'Violeta', color: '#8b5cf6' },
  { nombre: 'Rosa', color: '#ec4899' },
  { nombre: 'Turquesa', color: '#14b8a6' },
];

export interface Subgrupo {
  id: string;
  nombre: string;
  color: string | null;
  orden: number;
  alumnos: number;
}

/** Matriculados de un curso que cuentan para el reparto (no los impagados). */
async function matriculadosActivos(courseId: string): Promise<string[]> {
  const { rows } = await query<{ id: string }>(
    `SELECT id FROM enrollments
      WHERE course_id = $1 AND status <> 'pendiente_pago'
      ORDER BY enrolled_at`,
    [courseId],
  );
  return rows.map((r) => r.id);
}

/** Baraja de forma determinista a partir de una semilla textual (sin Math.random). */
function barajarCon<T>(arr: T[], semilla: string): T[] {
  const a = [...arr];
  // Generador congruente sembrado con un hash simple de la semilla: reproducible
  // y suficiente para repartir personas, que no necesita azar criptográfico.
  let s = 0;
  for (const c of semilla) s = (s * 31 + c.charCodeAt(0)) >>> 0;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function listar(courseId: string): Promise<Subgrupo[]> {
  const { rows } = await query<Subgrupo>(
    `SELECT g.id, g.nombre, g.color, g.orden,
            (SELECT COUNT(*) FROM enrollments e WHERE e.subgroup_id = g.id)::int AS alumnos
       FROM course_subgroups g WHERE g.course_id = $1 ORDER BY g.orden, g.nombre`,
    [courseId],
  );
  return rows;
}

/**
 * Reparto AUTOMÁTICO: crea `numSubgrupos` con nombres de color y reparte a todos
 * los matriculados de forma equilibrada y aleatoria. Sustituye cualquier reparto
 * anterior, para que "rehacer grupos" sea una sola acción y no deje restos.
 */
export async function repartirAutomatico(
  courseId: string,
  opts: { numSubgrupos?: number; porSubgrupo?: number; usarColores?: boolean },
): Promise<Subgrupo[]> {
  const alumnos = await matriculadosActivos(courseId);
  if (alumnos.length === 0) throw new Error('El curso no tiene alumnos matriculados que repartir');

  // Se puede pedir "n subgrupos" o "n personas por subgrupo": lo que no venga se
  // deduce del otro, redondeando hacia arriba para no dejar a nadie fuera.
  let n = opts.numSubgrupos ?? 0;
  if (!n && opts.porSubgrupo) n = Math.ceil(alumnos.length / opts.porSubgrupo);
  n = Math.max(1, Math.min(n || 2, alumnos.length, COLORES.length));

  const mezclados = barajarCon(alumnos, `${courseId}:${alumnos.length}:${n}`);

  await withTransaction(async (c) => {
    await c.query('DELETE FROM course_subgroups WHERE course_id = $1', [courseId]);
    const ids: string[] = [];
    for (let i = 0; i < n; i++) {
      const col = COLORES[i];
      const { rows } = await c.query<{ id: string }>(
        `INSERT INTO course_subgroups (course_id, nombre, color, orden)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [courseId, col.nombre, opts.usarColores === false ? null : col.color, i],
      );
      ids.push(rows[0].id);
    }
    // Reparto redondo: alumno i → subgrupo i%n, así quedan equilibrados.
    for (let i = 0; i < mezclados.length; i++) {
      await c.query('UPDATE enrollments SET subgroup_id = $1 WHERE id = $2', [ids[i % n], mezclados[i]]);
    }
    await c.query('UPDATE courses SET tiene_subgrupos = TRUE WHERE id = $1', [courseId]);
  });
  // listar() va DESPUÉS de confirmar: dentro de la transacción usaría otra
  // conexión del pool que todavía no ve los cambios sin commitear, y devolvería
  // la lista vacía.
  return listar(courseId);
}

/** Crea un subgrupo vacío (reparto manual). */
export async function crear(courseId: string, nombre: string, color: string | null): Promise<Subgrupo> {
  const { rows } = await query<{ orden: number }>(
    'SELECT COALESCE(MAX(orden), -1) + 1 AS orden FROM course_subgroups WHERE course_id = $1',
    [courseId],
  );
  const { rows: ins } = await query<Subgrupo>(
    `INSERT INTO course_subgroups (course_id, nombre, color, orden)
     VALUES ($1,$2,$3,$4) RETURNING id, nombre, color, orden, 0 AS alumnos`,
    [courseId, nombre.trim().slice(0, 40), color, rows[0].orden],
  );
  return ins[0];
}

/** Asigna (o quita, con null) un alumno a un subgrupo, por su matrícula. */
export async function asignar(courseId: string, enrollmentId: string, subgroupId: string | null): Promise<void> {
  if (subgroupId) {
    const ok = await query('SELECT 1 FROM course_subgroups WHERE id = $1 AND course_id = $2', [subgroupId, courseId]);
    if (ok.rows.length === 0) throw new Error('Subgrupo no válido para este curso');
  }
  await query(
    'UPDATE enrollments SET subgroup_id = $1 WHERE id = $2 AND course_id = $3',
    [subgroupId, enrollmentId, courseId],
  );
}

export async function eliminar(courseId: string, subgroupId: string): Promise<void> {
  // Al borrar el subgrupo, enrollments.subgroup_id queda a NULL por la FK
  // (ON DELETE SET NULL): los alumnos no desaparecen, solo se quedan sin grupo.
  await query('DELETE FROM course_subgroups WHERE id = $1 AND course_id = $2', [subgroupId, courseId]);
}
