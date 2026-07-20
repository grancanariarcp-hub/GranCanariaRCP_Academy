import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { badRequest, notFound } from '../utils/httpError.js';

/**
 * Convocatorias de oposición.
 *
 * Agrupan los bancos que el super admin asigna a UNA oposición concreta, para
 * que el opositor vea solo lo que le corresponde y no todo el catálogo.
 */

const convSchema = z.object({
  name: z.string().min(2).max(200),
  comunidad: z.string().max(120).nullish(),
  categoria: z.string().max(160).nullish(),
  anio: z.number().int().min(2000).max(2100).nullish(),
  descripcion: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
  /** Curso que da acceso. Vacío = convocatoria abierta a cualquiera. */
  courseId: z.string().uuid().nullish(),
});

/** GET /api/admin/convocatorias */
export async function listConvocatorias(_req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.*,
            cur.title  AS curso_titulo,
            cur.status AS curso_estado,
            cur.enrollment_open AS curso_matricula,
            COALESCE(json_agg(json_build_object('id', b.id, 'name', b.name, 'preguntas',
              (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id AND q.is_active))
              ORDER BY cb.sort_order) FILTER (WHERE b.id IS NOT NULL), '[]') AS bancos
       FROM ope_convocatorias c
       LEFT JOIN courses cur ON cur.id = c.course_id
       LEFT JOIN ope_convocatoria_banks cb ON cb.convocatoria_id = c.id
       LEFT JOIN question_banks b ON b.id = cb.bank_id
      GROUP BY c.id, cur.title, cur.status, cur.enrollment_open
      ORDER BY c.anio DESC NULLS LAST, c.name`,
  );
  res.json({ convocatorias: rows });
}

/**
 * Escala de precios por defecto, en céntimos.
 *
 * Cuanto más largo el compromiso, más barato el mes: es lo que reduce la baja
 * en cuanto pasa el examen, que es el mayor riesgo de este producto. Cada
 * periodo se cobra ENTERO por adelantado, no mes a mes: evita los impagos a
 * mitad de periodo y simplifica el cobro.
 */
const PRECIOS_POR_DEFECTO = {
  mensual: 10_00,      // 10 €/mes
  trimestral: 27_00,   //  9 €/mes
  semestral: 48_00,    //  8 €/mes
  anual: 84_00,        //  7 €/mes
};

/**
 * POST /api/admin/convocatorias
 *
 * La convocatoria SE COMPORTA como un curso: si no se indica uno existente, se
 * crea el suyo con la ficha lista, su módulo de bienvenida, su encuesta y la
 * escala de precios por suscripción. Así solo queda elegir los bancos y
 * publicar, en lugar de tener que montar el curso aparte y acordarse de
 * enlazarlo.
 */
export async function createConvocatoria(req: Request, res: Response): Promise<void> {
  const d = convSchema.parse(req.body);
  const userId = req.auth!.sub;

  const creado = await withTransaction(async (client) => {
    let courseId = d.courseId || null;

    if (!courseId) {
      const curso = await client.query<{ id: string }>(
        `INSERT INTO courses
           (title, tema, subtema, modality, publico_objetivo, price_cents, created_by,
            billing_type, price_mensual_cents, price_trimestral_cents, price_semestral_cents, price_anual_cents,
            resumen, objetivo_general)
         VALUES ($1,'OPE',$2,'online','{}',0,$3,'suscripcion',$4,$5,$6,$7,$8,$9)
         RETURNING id`,
        [
          d.name,
          d.categoria || null,
          userId,
          PRECIOS_POR_DEFECTO.mensual, PRECIOS_POR_DEFECTO.trimestral,
          PRECIOS_POR_DEFECTO.semestral, PRECIOS_POR_DEFECTO.anual,
          `Preparación de ${d.name}: generador de exámenes y simulacros con seguimiento de tu avance por materias.`,
          'Preparar la oposición mediante la práctica dirigida sobre los bancos oficiales de preguntas.',
        ],
      );
      courseId = curso.rows[0].id;

      await client.query(
        `INSERT INTO course_staff (course_id, user_id, role) VALUES ($1, $2, 'director')`,
        [courseId, userId],
      );
      // Misma estructura de partida que cualquier curso.
      await client.query(
        `INSERT INTO modules (course_id, title, sort_order) VALUES ($1, 'Bienvenida', 0)`,
        [courseId],
      );
      await client.query(
        'INSERT INTO course_surveys (course_id) VALUES ($1) ON CONFLICT (course_id) DO NOTHING',
        [courseId],
      );
    }

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO ope_convocatorias (name, comunidad, categoria, anio, descripcion, is_active, course_id)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6, TRUE),$7) RETURNING id`,
      [d.name, d.comunidad || null, d.categoria || null, d.anio ?? null, d.descripcion || null, d.isActive, courseId],
    );
    return { id: rows[0].id, courseId };
  });

  res.status(201).json({ ...creado, cursoCreado: !d.courseId });
}

/** PATCH /api/admin/convocatorias/:id */
export async function updateConvocatoria(req: Request, res: Response): Promise<void> {
  const d = convSchema.partial().parse(req.body);
  const map: Record<string, unknown> = {
    name: d.name, comunidad: d.comunidad, categoria: d.categoria,
    anio: d.anio, descripcion: d.descripcion, is_active: d.isActive, course_id: d.courseId,
  };
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const [col, val] of Object.entries(map)) {
    if (val === undefined) continue;
    vals.push(val === '' ? null : val);
    sets.push(`${col} = $${vals.length}`);
  }
  if (sets.length === 0) throw badRequest('Nada que actualizar');
  vals.push(req.params.id);
  const { rowCount } = await query(
    `UPDATE ope_convocatorias SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals,
  );
  if (rowCount === 0) throw notFound('Convocatoria no encontrada');
  res.json({ ok: true });
}

/** DELETE /api/admin/convocatorias/:id */
export async function deleteConvocatoria(req: Request, res: Response): Promise<void> {
  const { rowCount } = await query('DELETE FROM ope_convocatorias WHERE id = $1', [req.params.id]);
  if (rowCount === 0) throw notFound('Convocatoria no encontrada');
  res.json({ ok: true });
}

/** PUT /api/admin/convocatorias/:id/banks — fijar qué bancos la componen. */
export async function setConvocatoriaBanks(req: Request, res: Response): Promise<void> {
  const { bankIds } = z.object({ bankIds: z.array(z.string().uuid()) }).parse(req.body);

  // Una convocatoria solo se compone de bancos de oposición: son los que llevan
  // las preguntas numeradas y las etiquetas que el opositor necesita filtrar.
  if (bankIds.length > 0) {
    const validos = await query<{ id: string; name: string; kind: string }>(
      'SELECT id, name, kind FROM question_banks WHERE id = ANY($1::uuid[])',
      [bankIds],
    );
    const ajenos = validos.rows.filter((b) => b.kind !== 'ope' && b.kind !== 'mir');
    if (ajenos.length > 0) {
      throw badRequest(
        `Solo se pueden asignar bancos de tipo OPE o MIR. No válidos: ${ajenos.map((b) => b.name).join(', ')}`,
        'BANCO_NO_OPE',
      );
    }
  }

  await query('DELETE FROM ope_convocatoria_banks WHERE convocatoria_id = $1', [req.params.id]);
  for (const [i, bankId] of bankIds.entries()) {
    await query(
      `INSERT INTO ope_convocatoria_banks (convocatoria_id, bank_id, sort_order)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
      [req.params.id, bankId, i],
    );
  }
  res.json({ ok: true, bancos: bankIds.length });
}

/**
 * GET /api/practice/convocatorias — las que puede preparar el opositor,
 * con sus bancos y las materias de cada uno para poder configurar el test.
 */
export async function myConvocatorias(req: Request, res: Response): Promise<void> {
  const { rows } = await query(
    `SELECT c.id, c.name, c.comunidad, c.categoria, c.anio, c.descripcion,
            COALESCE(json_agg(json_build_object(
              'id', b.id,
              'name', b.name,
              'preguntas', (SELECT COUNT(*) FROM questions q WHERE q.bank_id = b.id AND q.is_active),
              'maxOrden',  (SELECT MAX(q.orden) FROM questions q WHERE q.bank_id = b.id AND q.is_active),
              'temas', (SELECT COALESCE(json_agg(DISTINCT t.tema), '[]')
                          FROM (SELECT tema FROM questions WHERE bank_id = b.id AND is_active AND tema IS NOT NULL) t),
              'vistas', (SELECT COUNT(DISTINCT al.question_id) FROM answer_log al
                          WHERE al.user_id = $1 AND al.bank_id = b.id),
              'simQuestions', b.sim_questions, 'simMinutes', b.sim_minutes, 'simPassPct', b.sim_pass_pct
            ) ORDER BY cb.sort_order) FILTER (WHERE b.id IS NOT NULL), '[]') AS bancos
       FROM ope_convocatorias c
       LEFT JOIN ope_convocatoria_banks cb ON cb.convocatoria_id = c.id
       LEFT JOIN question_banks b ON b.id = cb.bank_id AND b.visibility = 'publico'
      WHERE c.is_active
        -- Abierta, o bien su curso está matriculado y pagado por esta persona.
        AND (c.course_id IS NULL OR EXISTS (
              SELECT 1 FROM enrollments e
               WHERE e.course_id = c.course_id AND e.student_id = $1
                 AND e.status <> 'pendiente_pago'
                 -- Suscripción vencida: deja de ver la convocatoria.
                 AND (e.access_until IS NULL OR e.access_until > NOW())
            ))
      GROUP BY c.id ORDER BY c.anio DESC NULLS LAST, c.name`,
    [req.auth!.sub],
  );
  res.json({ convocatorias: rows });
}
