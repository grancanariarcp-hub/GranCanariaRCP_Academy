import { query } from '../config/database.js';

/**
 * Recopilación de los datos del acta del curso.
 *
 * Se ejecuta una sola vez, al cerrar el acta, y su resultado se congela en la
 * tabla: consultar un acta cerrada NUNCA vuelve a pasar por aquí. Así el
 * documento no cambia aunque después se corrija una nota o se borre un alumno.
 */

export interface ActaSnapshot {
  curso: {
    titulo: string;
    tema: string | null;
    subtema: string | null;
    modalidad: string;
    horas: number | null;
    acreditacion: string | null;
    cfc: string | null;
    objetivoGeneral: string | null;
    objetivosEspecificos: string | null;
    publicoObjetivo: string[];
    periodo: string;
    minAsistenciaPct: number;
  };
  director: string | null;
  profesorado: Array<{ nombre: string; titular: string | null; rol: string }>;
  temario: Array<{ modulo: string; actividades: string[] }>;
  alumnos: Array<{
    nombre: string;
    dni: string | null;
    asistenciaPct: number | null;
    notaFinal: number | null;
    apto: boolean;
    porModulo: Array<{ modulo: string; nota: number | null }>;
  }>;
  resumen: {
    matriculados: number;
    aptos: number;
    noAptos: number;
    presentados: number;
    notaMedia: number | null;
    asistenciaMedia: number | null;
    jornadasPresenciales: number;
  };
  encuesta: {
    respuestas: number;
    participacionPct: number;
    mediaGlobal: number | null;
    recomiendanPct: number | null;
    porItem: Array<{ etiqueta: string; media: number | null; n: number }>;
  };
  generadoEl: string;
}

/** Formatea el periodo lectivo tal y como debe figurar en el acta. */
function periodoDe(inicio: string | null, fin: string | null): string {
  const f = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
  if (inicio && fin) return `del ${f(inicio)} al ${f(fin)}`;
  if (inicio) return `desde el ${f(inicio)}`;
  if (fin) return `hasta el ${f(fin)}`;
  return 'sin fechas declaradas';
}

export async function recopilarActa(courseId: string): Promise<ActaSnapshot> {
  const curso = await query<{
    title: string; tema: string | null; subtema: string | null; modality: string;
    duration_hours: number | null; acreditacion: string | null; cfc: string | null;
    objetivo_general: string | null; objetivos_especificos: string | null;
    publico_objetivo: string[]; starts_at: string | null; ends_at: string | null;
    min_attendance_pct: number;
  }>(
    `SELECT title, tema, subtema, modality, duration_hours, acreditacion, cfc,
            objetivo_general, objetivos_especificos, publico_objetivo,
            starts_at, ends_at, min_attendance_pct
       FROM courses WHERE id = $1`,
    [courseId],
  );
  const c = curso.rows[0];
  if (!c) throw new Error('Curso no encontrado');

  const staff = await query<{ name: string; headline: string | null; role: string }>(
    `SELECT u.name, u.headline, cs.role
       FROM course_staff cs JOIN users u ON u.id = cs.user_id
      WHERE cs.course_id = $1
      ORDER BY CASE cs.role WHEN 'director' THEN 0 ELSE 1 END, u.name`,
    [courseId],
  );

  const temario = await query<{ modulo: string; actividades: string[] }>(
    `SELECT m.title AS modulo,
            COALESCE(ARRAY_AGG(a.title ORDER BY a.sort_order) FILTER (WHERE a.id IS NOT NULL), '{}') AS actividades
       FROM modules m LEFT JOIN activities a ON a.module_id = m.id
      WHERE m.course_id = $1
      GROUP BY m.id, m.title, m.sort_order
      ORDER BY m.sort_order`,
    [courseId],
  );

  // Jornadas presenciales: definen el denominador de la asistencia.
  const jornadas = await query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM attendance_sessions WHERE course_id = $1',
    [courseId],
  );
  const totalJornadas = Number(jornadas.rows[0].n);

  const alumnos = await query<{
    student_id: string; display_name: string; nombre: string | null; apellidos: string | null; dni: string | null;
    jornadas_asistidas: string;
  }>(
    `SELECT st.id AS student_id, st.display_name, st.nombre, st.apellidos, st.dni,
            (SELECT COUNT(*) FROM attendance_records r
               JOIN attendance_sessions s ON s.id = r.session_id
              WHERE s.course_id = $1 AND r.student_id = st.id AND r.check_in_at IS NOT NULL)::text AS jornadas_asistidas
       FROM enrollments e JOIN students st ON st.id = e.student_id
      WHERE e.course_id = $1 AND e.status <> 'pendiente_pago'
      ORDER BY COALESCE(NULLIF(st.apellidos, ''), st.display_name), st.nombre NULLS FIRST`,
    [courseId],
  );

  // Mejor intento por alumno y módulo: es la nota que cuenta.
  const notas = await query<{ student_id: string; modulo: string; kind: string; score: number | null; passed: boolean | null }>(
    `SELECT DISTINCT ON (a.student_id, e.id)
            a.student_id, m.title AS modulo, e.kind, a.score, a.passed
       FROM exam_attempts a
       JOIN exams e ON e.id = a.exam_id
       JOIN modules m ON m.id = e.module_id
      WHERE m.course_id = $1 AND a.submitted_at IS NOT NULL
      ORDER BY a.student_id, e.id, a.score DESC NULLS LAST`,
    [courseId],
  );

  const filas = alumnos.rows.map((al) => {
    const suyas = notas.rows.filter((n) => n.student_id === al.student_id);
    const porModulo = suyas.map((n) => ({ modulo: n.modulo, nota: n.score }));
    // La nota final es la del examen final si existe; si no, la media de los tests.
    const finales = suyas.filter((n) => n.kind === 'examen');
    const conNota = (finales.length > 0 ? finales : suyas).filter((n) => n.score !== null);
    const notaFinal = conNota.length > 0
      ? Math.round(conNota.reduce((s, n) => s + (n.score ?? 0), 0) / conNota.length)
      : null;

    const asistenciaPct = totalJornadas > 0
      ? Math.round((Number(al.jornadas_asistidas) / totalJornadas) * 100)
      : null;

    // Apto exige aprobar y, en presencial, alcanzar la asistencia mínima.
    const apruebaExamen = (finales.length > 0 ? finales : suyas).some((n) => n.passed === true);
    const cumpleAsistencia = asistenciaPct === null || asistenciaPct >= c.min_attendance_pct;

    return {
      nombre: al.apellidos ? `${al.apellidos}, ${al.nombre || ''}`.replace(/,\s*$/, '') : al.display_name,
      dni: al.dni,
      asistenciaPct,
      notaFinal,
      apto: apruebaExamen && cumpleAsistencia,
      porModulo,
    };
  });

  const conNota = filas.filter((f) => f.notaFinal !== null);
  const conAsistencia = filas.filter((f) => f.asistenciaPct !== null);

  // Resultados de la encuesta, tal como estén al cerrar.
  const enc = await query<{ n: string; media: string | null; recomiendan: string }>(
    `SELECT COUNT(*)::text AS n,
            ROUND(AVG(r.global_rating), 2)::text AS media,
            COUNT(*) FILTER (WHERE r.would_recommend)::text AS recomiendan
       FROM survey_responses r
       JOIN course_surveys s ON s.id = r.survey_id
      WHERE s.course_id = $1`,
    [courseId],
  );
  const encItems = await query<{ item_label: string; media: string | null; n: string }>(
    `SELECT si.item_label,
            ROUND(AVG(si.score) FILTER (WHERE NOT si.skipped), 2)::text AS media,
            COUNT(*) FILTER (WHERE NOT si.skipped)::text AS n
       FROM survey_item_scores si
       JOIN survey_responses r ON r.id = si.response_id
       JOIN course_surveys s ON s.id = r.survey_id
      WHERE s.course_id = $1
      GROUP BY si.item_label
      ORDER BY AVG(si.score) DESC NULLS LAST`,
    [courseId],
  );
  const respuestas = Number(enc.rows[0]?.n ?? 0);

  return {
    curso: {
      titulo: c.title,
      tema: c.tema,
      subtema: c.subtema,
      modalidad: c.modality,
      horas: c.duration_hours,
      acreditacion: c.acreditacion,
      cfc: c.cfc,
      objetivoGeneral: c.objetivo_general,
      objetivosEspecificos: c.objetivos_especificos,
      publicoObjetivo: c.publico_objetivo ?? [],
      periodo: periodoDe(c.starts_at, c.ends_at),
      minAsistenciaPct: c.min_attendance_pct,
    },
    director: staff.rows.find((s) => s.role === 'director')?.name ?? null,
    profesorado: staff.rows.map((s) => ({ nombre: s.name, titular: s.headline, rol: s.role })),
    temario: temario.rows.map((t) => ({ modulo: t.modulo, actividades: t.actividades ?? [] })),
    alumnos: filas,
    resumen: {
      matriculados: filas.length,
      aptos: filas.filter((f) => f.apto).length,
      noAptos: filas.filter((f) => !f.apto).length,
      presentados: conNota.length,
      notaMedia: conNota.length > 0
        ? Math.round(conNota.reduce((s, f) => s + (f.notaFinal ?? 0), 0) / conNota.length)
        : null,
      asistenciaMedia: conAsistencia.length > 0
        ? Math.round(conAsistencia.reduce((s, f) => s + (f.asistenciaPct ?? 0), 0) / conAsistencia.length)
        : null,
      jornadasPresenciales: totalJornadas,
    },
    encuesta: {
      respuestas,
      participacionPct: filas.length > 0 ? Math.round((respuestas / filas.length) * 100) : 0,
      mediaGlobal: enc.rows[0]?.media ? Number(enc.rows[0].media) : null,
      recomiendanPct: respuestas > 0 ? Math.round((Number(enc.rows[0].recomiendan) / respuestas) * 100) : null,
      porItem: encItems.rows.map((i) => ({
        etiqueta: i.item_label,
        media: i.media ? Number(i.media) : null,
        n: Number(i.n),
      })),
    },
    generadoEl: new Date().toISOString(),
  };
}
