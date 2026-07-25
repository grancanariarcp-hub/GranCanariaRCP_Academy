import type { Request, Response } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../config/database.js';
import { assertDirector } from '../services/courseAuth.js';
import { badRequest, notFound } from '../utils/httpError.js';
import { documentoValido } from '../services/documento.js';

/**
 * Puente con PÚLSAR (simulación clínica).
 *
 * La academia lleva la teoría y cierra las actas; PÚLSAR ejecuta la práctica.
 * El intercambio es por archivos JSON: la academia EXPORTA el curso con sus
 * alumnos y grupos, y luego IMPORTA los resultados de la práctica para cerrar el
 * acta. El curso se casa por su id; los alumnos, por documento.
 */

// Partir "Nombre Apellido1 Apellido2" en nombre + apellidos, lo mejor posible.
// Los instructores se guardan en users.name como un único campo.
function partirNombre(name: string): { nombre: string; apellidos: string } {
  const p = name.trim().split(/\s+/);
  if (p.length === 1) return { nombre: p[0], apellidos: '' };
  return { nombre: p[0], apellidos: p.slice(1).join(' ') };
}

/**
 * GET /api/courses/:id/pulsar/export — genera el curso-academia.json.
 *
 * Bloquea si algún alumno no tiene documento: es la llave del cruce, y exportar
 * sin ella produciría resultados que PÚLSAR no podría devolver.
 */
export async function exportarCurso(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const courseId = req.params.id;

  const cur = await query<{
    id: string; title: string; tipo_clinico: string | null; empresa: string | null;
    lugar: string | null; starts_at: string | null; ends_at: string | null; codigo_vinculacion: string | null;
  }>(
    `SELECT id, title, tipo_clinico, empresa, lugar, starts_at, ends_at, codigo_vinculacion
       FROM courses WHERE id = $1`,
    [courseId],
  );
  if (cur.rows.length === 0) throw notFound('Curso no encontrado');
  const c = cur.rows[0];

  // Instructores que participan en la práctica (los que van a PÚLSAR).
  const instructores = await query<{ name: string; dni: string | null; email: string }>(
    `SELECT u.name, u.dni, u.email
       FROM course_staff cs JOIN users u ON u.id = cs.user_id
      WHERE cs.course_id = $1 AND cs.parte IN ('practica', 'ambas')
      ORDER BY u.name`,
    [courseId],
  );

  const alumnos = await query<{
    enrollment_id: string; dni: string | null; nombre: string | null; apellidos: string | null;
    display_name: string; email: string | null; grupo: string | null; color: string | null; orden: number | null;
  }>(
    `SELECT e.id AS enrollment_id, st.dni, st.nombre, st.apellidos, st.display_name, st.email,
            g.nombre AS grupo, g.color, g.orden
       FROM enrollments e
       JOIN students st ON st.id = e.student_id
       LEFT JOIN course_subgroups g ON g.id = e.subgroup_id
      WHERE e.course_id = $1 AND e.status <> 'pendiente_pago'
      ORDER BY g.orden NULLS LAST, st.apellidos, st.nombre`,
    [courseId],
  );

  // El documento es obligatorio para exportar: sin él, PÚLSAR no puede devolver
  // la nota. Se avisa de quién falta en vez de exportar un archivo inservible.
  const sinDoc = alumnos.rows.filter((a) => !documentoValido(a.dni));
  if (sinDoc.length > 0) {
    throw badRequest(
      `Estos alumnos no tienen documento y no se pueden exportar: ${sinDoc
        .map((a) => a.display_name)
        .join(', ')}. Complétalo antes de exportar.`,
      'ALUMNOS_SIN_DOCUMENTO',
    );
  }

  // Agrupar alumnos por subgrupo. Si el curso no usa subgrupos, todos van a uno
  // solo llamado «Todos», porque el formato de PÚLSAR siempre espera grupos.
  const porGrupo = new Map<string, { nombre: string; color: string | null; alumnos: unknown[] }>();
  for (const a of alumnos.rows) {
    const clave = a.grupo ?? 'Todos';
    if (!porGrupo.has(clave)) porGrupo.set(clave, { nombre: clave, color: a.color, alumnos: [] });
    porGrupo.get(clave)!.alumnos.push({
      documento: documentoValido(a.dni),
      nombre: a.nombre ?? a.display_name,
      apellidos: a.apellidos ?? '',
      email: a.email ?? '',
      profesion: '',
    });
  }

  const doc = {
    version: '1.0',
    origen: 'academia',
    curso: {
      idAcademia: c.id,
      codigoVinculacion: c.codigo_vinculacion,
      nombre: c.title,
      modalidad: c.tipo_clinico ?? 'otro',
      empresa: c.empresa ?? '',
      lugar: c.lugar ?? '',
      fechaInicio: c.starts_at ?? '',
      fechaFin: c.ends_at ?? '',
      instructores: instructores.rows.map((i) => ({
        ...partirNombre(i.name),
        documento: i.dni ?? '',
        email: i.email,
      })),
    },
    grupos: [...porGrupo.values()],
  };

  const nombreArchivo = `curso-academia-${(c.codigo_vinculacion ?? c.id).replace(/[^\w-]/g, '')}.json`;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
  res.send(JSON.stringify(doc, null, 2));
}

// --------------------------------------------------------------------------
// Importar resultados-pulsar.json
// --------------------------------------------------------------------------
const resultadoSchema = z.object({
  version: z.string().optional(),
  origen: z.string().optional(),
  cursoRef: z.object({
    idAcademia: z.string().optional().default(''),
    idPulsar: z.string().optional().default(''),
    nombre: z.string().optional().default(''),
  }).partial().default({}),
  // Acotado: nota_practica y umbral_apto son SMALLINT en la base. Sin tope, un
  // «nota: 100000» de PÚLSAR reventaría el INSERT y abortaría todo el import.
  umbralApto: z.number().int().min(0).max(1000).optional(),
  alumnos: z.array(z.object({
    documento: z.string(),
    nombre: z.string().optional().default(''),
    apellidos: z.string().optional().default(''),
    grupo: z.string().optional(),
    asistencia: z.boolean().optional(),
    teorico: z.any().optional(),
    simulacion: z.object({
      nota: z.number().min(0).max(1000).optional(),
      apto: z.boolean().optional(),
      escenarios: z.array(z.any()).optional(),
    }).partial().optional(),
    global: z.object({ apto: z.boolean().optional() }).partial().optional(),
    feedback: z.any().optional(),
    // Un curso presencial tiene decenas de alumnos; 2000 es un techo amplio que
    // acota la transacción del import ante un archivo desmesurado o malformado.
  })).max(2000, 'El archivo trae demasiados alumnos').default([]),
});

/**
 * POST /api/courses/:id/pulsar/import — carga los resultados de la práctica.
 *
 * Con `?preview=1` no escribe nada: devuelve qué haría (a quién casa por
 * documento y a quién no encuentra), para revisarlo antes de aplicarlo.
 */
export async function importarResultados(req: Request, res: Response): Promise<void> {
  await assertDirector(req);
  const courseId = req.params.id;
  const soloVista = req.query.preview === '1';
  const data = resultadoSchema.parse(req.body);

  // Aviso, no bloqueo: el archivo puede traer el id de otra edición por error.
  // El director lo ve en la vista previa y decide.
  const idDeclarado = data.cursoRef?.idAcademia || '';
  const cursoCorrecto = !idDeclarado || idDeclarado === courseId;

  const matriculados = await query<{ student_id: string; dni: string | null; display_name: string }>(
    `SELECT st.id AS student_id, st.dni, st.display_name
       FROM enrollments e JOIN students st ON st.id = e.student_id
      WHERE e.course_id = $1 AND e.status <> 'pendiente_pago'`,
    [courseId],
  );
  const porDoc = new Map<string, { student_id: string; display_name: string }>();
  for (const m of matriculados.rows) {
    const d = documentoValido(m.dni);
    if (d) porDoc.set(d, { student_id: m.student_id, display_name: m.display_name });
  }

  const casados: Array<{ documento: string; nombre: string; alumno: string; nota: number | null; apto: boolean | null }> = [];
  const huerfanos: Array<{ documento: string; nombre: string }> = [];
  const filas = data.alumnos.map((a) => {
    const doc = documentoValido(a.documento);
    const encontrado = doc ? porDoc.get(doc) : undefined;
    const nota = a.simulacion?.nota ?? null;
    // Apto práctico: primero el de la simulación; si no viene, el global. Antes
    // solo se miraba simulacion.apto, así que un alumno con global.apto=true pero
    // sin ese campo quedaba sin apto práctico y salía no-apto en el acta.
    const aptoPract = a.simulacion?.apto ?? a.global?.apto ?? null;
    const nombre = `${a.nombre} ${a.apellidos}`.trim();
    if (encontrado) casados.push({ documento: doc!, nombre, alumno: encontrado.display_name, nota, apto: aptoPract });
    else if (doc) huerfanos.push({ documento: a.documento, nombre });
    return { a, doc, encontrado, aptoPract };
  });

  if (soloVista) {
    res.json({
      cursoCorrecto, idDeclarado,
      totalEnArchivo: data.alumnos.length,
      casados, huerfanos,
      resumen: `${casados.length} alumnos se actualizarán, ${huerfanos.length} no se encuentran en este curso.`,
    });
    return;
  }

  const casadosDocs = new Set<string>();
  await withTransaction(async (client) => {
    for (const f of filas) {
      if (!f.doc) continue;
      await client.query(
        `INSERT INTO course_pulsar_results
           (course_id, student_id, documento, nombre, nota_practica, apto_practica, apto_global, asistencia, umbral_apto, detalle, feedback, id_pulsar, imported_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (course_id, documento) DO UPDATE SET
           student_id = EXCLUDED.student_id, nombre = EXCLUDED.nombre,
           nota_practica = EXCLUDED.nota_practica, apto_practica = EXCLUDED.apto_practica,
           apto_global = EXCLUDED.apto_global, asistencia = EXCLUDED.asistencia,
           umbral_apto = EXCLUDED.umbral_apto, detalle = EXCLUDED.detalle,
           feedback = EXCLUDED.feedback, id_pulsar = EXCLUDED.id_pulsar,
           imported_at = NOW(), imported_by = EXCLUDED.imported_by`,
        [
          courseId, f.encontrado?.student_id ?? null, f.doc,
          `${f.a.nombre} ${f.a.apellidos}`.trim(),
          f.a.simulacion?.nota ?? null, f.aptoPract, f.a.global?.apto ?? null,
          f.a.asistencia ?? null, data.umbralApto ?? null,
          JSON.stringify(f.a.simulacion?.escenarios ?? []), JSON.stringify(f.a.feedback ?? {}),
          data.cursoRef?.idPulsar || null, req.auth!.sub,
        ],
      );
      // Solo cuentan como «aplicados a un alumno» los casados; los huérfanos se
      // guardan como registro de lo que envió PÚLSAR, pero no afectan a nadie.
      if (f.encontrado) casadosDocs.add(f.doc);
    }
  });
  const aplicados = casadosDocs.size;

  res.json({
    ok: true, aplicados,
    huerfanos,
    mensaje: `Se han cargado ${aplicados} resultados sobre alumnos del curso.` +
      (huerfanos.length > 0
        ? ` ${huerfanos.length} venían con un documento que no coincide con ningún alumno matriculado: revísalos, porque esos alumnos se quedarán sin nota práctica en el acta.`
        : ''),
  });
}
