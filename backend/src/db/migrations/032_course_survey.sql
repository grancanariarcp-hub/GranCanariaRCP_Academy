-- Encuesta de satisfacción del curso. Los ítems NO se guardan como plantilla
-- fija: se generan al vuelo a partir de los módulos y del profesorado del curso,
-- así siempre están al día. Solo se guardan las respuestas (con el nombre del
-- ítem en el momento de responder, para que el histórico no se rompa si luego
-- se renombra un módulo o cambia el profesorado).
CREATE TABLE IF NOT EXISTS course_surveys (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
  is_open    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS survey_responses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id       UUID NOT NULL REFERENCES course_surveys(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  global_rating   SMALLINT CHECK (global_rating BETWEEN 1 AND 5),
  would_recommend BOOLEAN,
  comments        TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (survey_id, student_id)          -- una respuesta por alumno
);

CREATE TABLE IF NOT EXISTS survey_item_scores (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID NOT NULL REFERENCES survey_responses(id) ON DELETE CASCADE,
  item_kind   VARCHAR(20) NOT NULL CHECK (item_kind IN ('modulo', 'profesor', 'general')),
  item_ref    UUID,                        -- module_id o user_id (NULL en los generales)
  item_label  VARCHAR(200) NOT NULL,       -- nombre en el momento de responder
  score       SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5)
);
CREATE INDEX IF NOT EXISTS idx_survey_scores_response ON survey_item_scores(response_id);

-- Los cursos que ya existen también tienen su encuesta.
INSERT INTO course_surveys (course_id)
SELECT id FROM courses ON CONFLICT (course_id) DO NOTHING;
