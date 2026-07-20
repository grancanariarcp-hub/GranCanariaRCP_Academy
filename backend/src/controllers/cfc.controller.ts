import type { Request, Response } from 'express';
import { query } from '../config/database.js';
import { forbidden, notFound } from '../utils/httpError.js';

/**
 * Asistente de acreditación CFC: revisa el curso y señala qué le falta o qué
 * puede reforzar el director para presentarlo mejor ante la comisión.
 *
 * IMPORTANTE: es una AYUDA INTERNA de preparación, no un cálculo oficial de
 * créditos. Los baremos concretos los fija cada comisión autonómica y cambian;
 * por eso aquí no se prometen créditos, se comprueban los elementos que suelen
 * pedirse en la memoria de la actividad.
 */

type Estado = 'ok' | 'aviso' | 'falta';
interface Check { clave: string; titulo: string; estado: Estado; detalle: string; comoMejorar?: string }

export async function cfcAssistant(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (req.auth!.role !== 'super_admin' && req.auth!.role !== 'auditor') {
    const staff = await query('SELECT 1 FROM course_staff WHERE course_id = $1 AND user_id = $2', [id, req.auth!.sub]);
    if (staff.rows.length === 0) throw forbidden('No formas parte de este curso');
  }

  const c = await query<{
    title: string; objetivo_general: string | null; objetivos_especificos: string | null;
    resumen: string | null; publico_objetivo: string[] | null; duration_hours: string | null;
    acreditacion: string | null; cfc: string | null; certifica: string | null;
    firmante1_nombre: string | null; modality: string;
  }>(
    `SELECT title, objetivo_general, objetivos_especificos, resumen, publico_objetivo, duration_hours,
            acreditacion, cfc, certifica, firmante1_nombre, modality
       FROM courses WHERE id = $1`,
    [id],
  );
  if (c.rows.length === 0) throw notFound('Curso no encontrado');
  const co = c.rows[0];

  const [acts, exams, docs, staff, cvs, encuestas] = await Promise.all([
    query<{ type: string; n: string; sin_duracion: string }>(
      `SELECT a.type, COUNT(*) AS n,
              COUNT(*) FILTER (WHERE a.duration_min IS NULL AND a.type IN ('video','enlace')) AS sin_duracion
         FROM activities a
        WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)
        GROUP BY a.type`,
      [id],
    ),
    query<{ n: string; con_corte: string }>(
      `SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE e.pass_pct > 0) AS con_corte
         FROM exams e JOIN modules m ON m.id = e.module_id WHERE m.course_id = $1`,
      [id],
    ),
    query<{ n: string; sin_paginas: string }>(
      `SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE d.pages IS NULL) AS sin_paginas
         FROM activities a JOIN documents d ON d.id = a.document_id
        WHERE a.module_id IN (SELECT id FROM modules WHERE course_id = $1)`,
      [id],
    ),
    query<{ n: string; directores: string }>(
      `SELECT COUNT(*) AS n, COUNT(*) FILTER (WHERE role = 'director') AS directores
         FROM course_staff WHERE course_id = $1`,
      [id],
    ),
    query<{ n: string }>(
      `SELECT COUNT(DISTINCT ci.user_id) AS n FROM cv_items ci
        WHERE ci.user_id IN (SELECT user_id FROM course_staff WHERE course_id = $1)`,
      [id],
    ),
    query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM survey_responses r
         JOIN course_surveys cs ON cs.id = r.survey_id WHERE cs.course_id = $1`,
      [id],
    ),
  ]);

  const tiposDistintos = acts.rows.filter((a) => Number(a.n) > 0).length;
  const totalActs = acts.rows.reduce((s, a) => s + Number(a.n), 0);
  const sinDuracion = acts.rows.reduce((s, a) => s + Number(a.sin_duracion), 0);
  const horas = co.duration_hours != null ? Number(co.duration_hours) : 0;
  const nStaff = Number(staff.rows[0]?.n ?? 0);
  const nCv = Number(cvs.rows[0]?.n ?? 0);

  const checks: Check[] = [
    {
      clave: 'objetivo_general',
      titulo: 'Objetivo general definido',
      estado: co.objetivo_general?.trim() ? 'ok' : 'falta',
      detalle: co.objetivo_general?.trim() ? 'Definido.' : 'El curso no tiene objetivo general.',
      comoMejorar: 'Redáctalo en una frase medible: qué será capaz de hacer el alumno al terminar.',
    },
    {
      clave: 'objetivos_especificos',
      titulo: 'Objetivos específicos',
      estado: co.objetivos_especificos?.trim() ? 'ok' : 'falta',
      detalle: co.objetivos_especificos?.trim() ? 'Definidos.' : 'Sin objetivos específicos.',
      comoMejorar: 'Enumera 3-6 objetivos con verbos de acción (identificar, aplicar, realizar…).',
    },
    {
      clave: 'publico',
      titulo: 'Público objetivo delimitado',
      estado: (co.publico_objetivo?.length ?? 0) > 0 ? 'ok' : 'falta',
      detalle: (co.publico_objetivo?.length ?? 0) > 0 ? co.publico_objetivo!.join(', ') : 'Sin público objetivo.',
      comoMejorar: 'Las comisiones valoran que la actividad esté dirigida a profesiones y niveles concretos.',
    },
    {
      clave: 'duracion',
      titulo: 'Duración declarada',
      estado: horas > 0 ? (horas < 4 ? 'aviso' : 'ok') : 'falta',
      detalle: horas > 0 ? `${horas} h declaradas.` : 'Sin duración declarada.',
      comoMejorar: horas > 0 && horas < 4
        ? 'Las actividades muy cortas suelen puntuar poco. Comprueba el mínimo de horas que exige tu comisión y usa la calculadora de duración para justificar las horas reales.'
        : 'Usa la calculadora de duración de esta misma página para obtener y justificar las horas.',
    },
    {
      clave: 'duracion_justificada',
      titulo: 'Horas justificables (sin lagunas)',
      estado: sinDuracion + Number(docs.rows[0]?.sin_paginas ?? 0) === 0 ? 'ok' : 'aviso',
      detalle: `${sinDuracion} vídeo(s)/enlace(s) sin duración y ${docs.rows[0]?.sin_paginas ?? 0} documento(s) sin nº de páginas.`,
      comoMejorar: 'Indica la duración de los vídeos y las páginas de los documentos: es lo que permite defender el cómputo de horas.',
    },
    {
      clave: 'evaluacion',
      titulo: 'Evaluación del aprendizaje',
      estado: Number(exams.rows[0]?.n ?? 0) > 0 ? 'ok' : 'falta',
      detalle: Number(exams.rows[0]?.n ?? 0) > 0
        ? `${exams.rows[0].n} prueba(s), ${exams.rows[0].con_corte} con nota de corte.`
        : 'El curso no tiene ninguna prueba de evaluación.',
      comoMejorar: 'Es un requisito casi universal: añade al menos un examen final con nota de corte.',
    },
    {
      clave: 'metodologia',
      titulo: 'Variedad metodológica',
      estado: tiposDistintos >= 3 ? 'ok' : tiposDistintos === 2 ? 'aviso' : 'falta',
      detalle: `${tiposDistintos} tipo(s) de actividad distintos en ${totalActs} actividades.`,
      comoMejorar: 'Combina documentos, textos, vídeos y casos/tests. La variedad y la participación activa puntúan.',
    },
    {
      clave: 'materiales',
      titulo: 'Materiales y bibliografía',
      estado: Number(docs.rows[0]?.n ?? 0) > 0 ? 'ok' : 'falta',
      detalle: `${docs.rows[0]?.n ?? 0} documento(s) adjuntos.`,
      comoMejorar: 'Adjunta guías y bibliografía de referencia (ERC, Plan Nacional de RCP…) como documentos del curso.',
    },
    {
      clave: 'profesorado',
      titulo: 'Profesorado acreditado',
      estado: nStaff > 0 && nCv >= 1 ? 'ok' : nStaff > 0 ? 'aviso' : 'falta',
      detalle: `${nStaff} docente(s); ${nCv} con CV cumplimentado.`,
      comoMejorar: 'Cada docente debería completar su CV en su perfil: la comisión valora la cualificación del profesorado.',
    },
    {
      clave: 'certificacion',
      titulo: 'Datos de certificación',
      estado: co.certifica && co.firmante1_nombre ? 'ok' : 'aviso',
      detalle: co.certifica ? `Certifica: ${co.certifica}${co.firmante1_nombre ? ' · con firmante' : ' · sin firmante'}` : 'Sin entidad certificadora.',
      comoMejorar: 'Completa quién certifica y al menos un firmante en la sección Certificado.',
    },
    {
      clave: 'encuesta',
      titulo: 'Encuesta de satisfacción',
      estado: Number(encuestas.rows[0]?.n ?? 0) > 0 ? 'ok' : 'aviso',
      detalle: Number(encuestas.rows[0]?.n ?? 0) > 0
        ? `${encuestas.rows[0].n} respuesta(s) recogidas.`
        : 'La encuesta está creada pero aún no la ha respondido nadie.',
      comoMejorar: 'Pide a los alumnos que la completen al terminar: las comisiones piden evaluación de la propia actividad.',
    },
  ];

  const ok = checks.filter((x) => x.estado === 'ok').length;
  res.json({
    curso: co.title,
    checks,
    resumen: { ok, avisos: checks.filter((x) => x.estado === 'aviso').length, faltan: checks.filter((x) => x.estado === 'falta').length, total: checks.length },
    aviso: 'Ayuda interna de preparación. Los baremos y mínimos los fija cada comisión autonómica: comprueba siempre su convocatoria vigente.',
  });
}
