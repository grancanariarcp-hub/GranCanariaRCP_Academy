-- Integración con PÚLSAR (simulación clínica) — modelo de datos.
--
-- La academia lleva lo teórico y cierra las actas; PÚLSAR ejecuta la práctica
-- presencial. El intercambio es por archivos JSON, casando el curso por su id y
-- los alumnos por documento. Para que ese contrato tenga de dónde leer, el
-- modelo necesita cinco piezas que hoy no existen:
--
--   1. Subgrupos de alumnos (por color) dentro de un curso.
--   2. Documento (DNI/NIE/pasaporte) del profesorado.
--   3. En qué parte participa cada profesor de cada curso: teórica/práctica.
--   4. Tipo clínico del curso (SVA/SVB/SVI/otro), empresa y lugar.
--   5. Un código de vinculación corto y legible por curso, para no cruzar la
--      edición equivocada al pasar los archivos.

-- 1. ----------------------------------------------------------------- SUBGRUPOS
-- Un curso solo muestra subgrupos si su director lo activa; mientras la casilla
-- esté apagada, nada de esto aparece en pantalla.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS tiene_subgrupos BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS course_subgroups (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  nombre     VARCHAR(40) NOT NULL,           -- "Rojo", "Azul"… o lo que decida el director
  color      VARCHAR(9),                     -- #RRGGBB; opcional si no usan colores
  orden      SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subgroups_course ON course_subgroups (course_id, orden);

-- La pertenencia es por alumno y curso, que es justo la clave de enrollments.
-- Al borrar un subgrupo, sus alumnos quedan sin asignar, no descolgados.
ALTER TABLE enrollments
  ADD COLUMN IF NOT EXISTS subgroup_id UUID REFERENCES course_subgroups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_enrollments_subgroup ON enrollments (subgroup_id);

-- 2. ------------------------------------------------------ DOCUMENTO DEL DOCENTE
ALTER TABLE users ADD COLUMN IF NOT EXISTS dni VARCHAR(30);

-- 3. ------------------------------------------- PARTE EN LA QUE PARTICIPA CADA UNO
-- Un profesor puede dar solo la teoría, solo la práctica (en PÚLSAR) o ambas.
-- Por defecto 'ambas' para no cambiar el significado de lo ya cargado.
ALTER TABLE course_staff
  ADD COLUMN IF NOT EXISTS parte VARCHAR(10) NOT NULL DEFAULT 'ambas'
  CHECK (parte IN ('teorica', 'practica', 'ambas'));

-- 4. ------------------------------------------------ TIPO CLÍNICO, EMPRESA, LUGAR
-- OJO: 'modality' de la academia es online/hibrido/presencial y NO se toca. Esto
-- es el TIPO de curso clínico, que es un eje distinto que PÚLSAR llama "modalidad".
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS tipo_clinico VARCHAR(10) CHECK (tipo_clinico IN ('SVA', 'SVB', 'SVI', 'otro')),
  ADD COLUMN IF NOT EXISTS empresa VARCHAR(160),
  ADD COLUMN IF NOT EXISTS lugar   VARCHAR(160);

-- 5. --------------------------------------------------- CÓDIGO DE VINCULACIÓN
-- Corto, en mayúsculas y sin caracteres ambiguos (nada de 0/O ni 1/I/L), para
-- dictarlo o teclearlo sin error al emparejar los archivos con PÚLSAR.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS codigo_vinculacion VARCHAR(16);

-- Backfill: derivado del id (único), así que no colisiona. Alfabeto sin
-- ambigüedades, 6 símbolos: espacio de sobra para los cursos que habrá.
UPDATE courses
   SET codigo_vinculacion = 'RCP-' || UPPER(
         TRANSLATE(SUBSTRING(MD5(id::text) FROM 1 FOR 6), 'abcdef', 'GHJKMN'))
 WHERE codigo_vinculacion IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_courses_codigo_vinculacion
  ON courses (codigo_vinculacion) WHERE codigo_vinculacion IS NOT NULL;
