-- Convocatorias de oposición y generador de tests configurable.
--
-- Una convocatoria agrupa los bancos que el super admin define para ESA
-- oposición. El opositor elige la convocatoria y, dentro de ella, con qué
-- bancos quiere trabajar.

CREATE TABLE IF NOT EXISTS ope_convocatorias (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(200) NOT NULL,
  comunidad   VARCHAR(120),
  categoria   VARCHAR(160),
  anio        SMALLINT,
  descripcion TEXT,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ope_convocatoria_banks (
  convocatoria_id UUID NOT NULL REFERENCES ope_convocatorias(id) ON DELETE CASCADE,
  bank_id         UUID NOT NULL REFERENCES question_banks(id)    ON DELETE CASCADE,
  sort_order      SMALLINT NOT NULL DEFAULT 0,
  PRIMARY KEY (convocatoria_id, bank_id)
);

-- Número de orden de la pregunta DENTRO de su banco.
--
-- Necesario para poder pedir "de la 1 a la 50": en las oposiciones que
-- publican el pool de preguntas, ese número es el que maneja el opositor.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS orden INTEGER;

-- Numeración de lo ya existente, por antigüedad dentro de cada banco.
WITH numeradas AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY bank_id ORDER BY created_at, id) AS n
    FROM questions WHERE bank_id IS NOT NULL
)
UPDATE questions q SET orden = numeradas.n
  FROM numeradas WHERE numeradas.id = q.id AND q.orden IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_bank_orden ON questions (bank_id, orden);

-- Tests generados por el opositor: se guardan para poder corregir sobre las
-- preguntas servidas y para repetir el mismo test barajado.
CREATE TABLE IF NOT EXISTS practice_tests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,             -- students.id o users.id, sin clave ajena
  bank_ids    UUID[] NOT NULL,

  criterio    VARCHAR(12) NOT NULL CHECK (criterio IN ('aleatorio', 'rango', 'tema')),
  rango_desde INTEGER,
  rango_hasta INTEGER,
  temas       TEXT[],

  -- Preguntas servidas, EN EL ORDEN en que se presentaron.
  question_ids UUID[] NOT NULL,
  minutos     SMALLINT,                  -- NULL = sin límite de tiempo
  correccion  VARCHAR(10) NOT NULL DEFAULT 'final' CHECK (correccion IN ('inmediata', 'final')),
  barajado    BOOLEAN NOT NULL DEFAULT TRUE,

  -- Test del que se repite, para poder seguir la serie.
  repite_de   UUID REFERENCES practice_tests(id) ON DELETE SET NULL,

  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at TIMESTAMPTZ,
  correct      SMALLINT,
  total        SMALLINT,
  seconds      INTEGER
);

CREATE INDEX IF NOT EXISTS idx_practice_tests_user ON practice_tests (user_id, started_at DESC);
