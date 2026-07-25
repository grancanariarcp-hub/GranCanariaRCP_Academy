-- Resultados de la parte práctica que devuelve PÚLSAR.
--
-- Al importar un resultados-pulsar.json, la nota práctica de cada alumno se
-- guarda aquí, casada por documento. El acta la incorpora: en un curso con parte
-- práctica, «apto» pasa a exigir aprobar la teoría Y la práctica.
--
-- Se conserva el detalle (escenarios, ítems no conseguidos, feedback) porque es
-- lo que alimenta el legajo del alumno y lo que justifica la nota si se revisa.

CREATE TABLE IF NOT EXISTS course_pulsar_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id     UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  -- El alumno casado por documento. Puede quedar en NULL si el documento no
  -- estaba en la academia: entonces es un resultado huérfano que hay que revisar.
  student_id    UUID REFERENCES students(id) ON DELETE SET NULL,
  documento     VARCHAR(30) NOT NULL,
  nombre        VARCHAR(160),          -- tal como vino de PÚLSAR, para el cotejo
  nota_practica SMALLINT,
  apto_practica BOOLEAN,
  apto_global   BOOLEAN,
  asistencia    BOOLEAN,
  umbral_apto   SMALLINT,
  detalle       JSONB,                 -- escenarios + ítems no conseguidos
  feedback      JSONB,                 -- mejorar / fortalecer / comentario
  id_pulsar     VARCHAR(80),           -- id del curso en PÚLSAR, para trazar
  imported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by   UUID
);

-- Un único resultado vigente por alumno (documento) y curso: reimportar un
-- archivo corregido reemplaza el anterior en vez de duplicarlo.
CREATE UNIQUE INDEX IF NOT EXISTS uq_pulsar_result
  ON course_pulsar_results (course_id, documento);
CREATE INDEX IF NOT EXISTS idx_pulsar_result_student ON course_pulsar_results (student_id);
