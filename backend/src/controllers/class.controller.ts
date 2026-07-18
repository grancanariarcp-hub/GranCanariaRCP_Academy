import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database.js';
import { badRequest, forbidden, notFound } from '../utils/httpError.js';
import { generateAccessCode } from '../utils/crypto.js';

/**
 * Panel del MAESTRO (institution_teacher): crea clases y genera códigos de
 * acceso para sus alumnos menores. Cada código es una fila en `students`
 * (is_minor, sin datos personales) con su access_code RCP-XXXX-XXXX; el menor
 * lo escanea (QR) o lo teclea, y al entrar elige su seudónimo y edad.
 */

async function institutionId(req: Request): Promise<string> {
  const id = req.auth!.institutionId;
  if (!id) throw forbidden('No perteneces a ninguna institución');
  return id;
}

/** Verifica que la clase es de este maestro; devuelve la fila. */
async function assertMyClass(req: Request): Promise<{ id: string; name: string; institution_id: string }> {
  const { rows } = await query<{ id: string; name: string; institution_id: string }>(
    'SELECT id, name, institution_id FROM classes WHERE id = $1 AND teacher_id = $2',
    [req.params.id, req.auth!.sub],
  );
  if (rows.length === 0) throw notFound('Clase no encontrada');
  return rows[0];
}

export async function listClasses(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.name, c.expected_students, c.created_at,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id) AS codes,
            (SELECT COUNT(*) FROM students s WHERE s.class_id = c.id AND s.last_login_at IS NOT NULL) AS activos
     FROM classes c WHERE c.teacher_id = $1 ORDER BY c.created_at DESC`,
    [req.auth!.sub],
  );
  res.json({ classes: rows });
}

const createClassSchema = z.object({ name: z.string().min(2).max(160), expectedStudents: z.number().int().min(1).max(500).optional() });
export async function createClass(req: Request, res: Response): Promise<void> {
  const instId = await institutionId(req);
  const d = createClassSchema.parse(req.body);
  const { rows } = await query(
    `INSERT INTO classes (institution_id, teacher_id, name, expected_students)
     VALUES ($1,$2,$3,$4) RETURNING id, name, expected_students, created_at`,
    [instId, req.auth!.sub, d.name, d.expectedStudents ?? null],
  );
  res.status(201).json({ class: rows[0] });
}

export async function getClass(req: Request, res: Response): Promise<void> {
  const c = await assertMyClass(req);
  const students = await query(
    `SELECT id, display_name, access_code, age, (last_login_at IS NOT NULL) AS activo
     FROM students WHERE class_id = $1 ORDER BY created_at`,
    [c.id],
  );
  res.json({ class: c, students: students.rows });
}

/** Genera N códigos (alumnos menores vacíos) en la clase. */
const genSchema = z.object({ count: z.number().int().min(1).max(100) });
export async function generateCodes(req: Request, res: Response): Promise<void> {
  const c = await assertMyClass(req);
  const { count } = genSchema.parse(req.body);
  const created: Array<{ id: string; access_code: string }> = [];
  for (let i = 0; i < count; i++) {
    // access_code es UNIQUE; reintenta si por casualidad colisiona.
    let inserted = false;
    for (let attempt = 0; attempt < 5 && !inserted; attempt++) {
      try {
        const { rows } = await query<{ id: string; access_code: string }>(
          `INSERT INTO students (institution_id, class_id, display_name, access_code, is_minor, identity_hash)
           VALUES ($1,$2,$3,$4,TRUE,NULL) RETURNING id, access_code`,
          [c.institution_id, c.id, 'Sin asignar', generateAccessCode()],
        );
        created.push(rows[0]);
        inserted = true;
      } catch { /* colisión de código: reintenta */ }
    }
  }
  if (created.length === 0) throw badRequest('No se pudieron generar códigos', 'GEN_FAILED');
  res.status(201).json({ created });
}

export async function deleteClass(req: Request, res: Response): Promise<void> {
  await assertMyClass(req);
  await query('DELETE FROM classes WHERE id = $1', [req.params.id]);
  res.json({ ok: true });
}

/** Borra un código de alumno (solo si no ha iniciado sesión aún). */
export async function deleteCode(req: Request, res: Response): Promise<void> {
  const c = await assertMyClass(req);
  const r = await query(
    'DELETE FROM students WHERE id = $1 AND class_id = $2 AND last_login_at IS NULL RETURNING id',
    [req.params.studentId, c.id],
  );
  if (r.rows.length === 0) throw badRequest('No se puede borrar (ya lo usó un alumno o no existe)', 'CANT_DELETE');
  res.json({ ok: true });
}
