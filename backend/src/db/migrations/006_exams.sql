-- Fase C: exámenes/tests dentro de los módulos + sus preguntas.
CREATE TABLE IF NOT EXISTS exams (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id        UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  title            VARCHAR(200) NOT NULL,
  kind             VARCHAR(16) NOT NULL DEFAULT 'test' CHECK (kind IN ('test', 'examen')),
  attempts_allowed SMALLINT NOT NULL DEFAULT 1,
  pass_pct         SMALLINT NOT NULL DEFAULT 60,
  time_limit_min   SMALLINT,                 -- NULL = sin límite de tiempo
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_questions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id       UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  format        VARCHAR(16) NOT NULL DEFAULT 'test' CHECK (format IN ('test', 'vf', 'abierta')),
  text          TEXT NOT NULL,
  options       JSONB NOT NULL DEFAULT '[]',
  correct_index SMALLINT,                    -- test/vf; NULL en abierta
  sort_order    SMALLINT NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exams_module ON exams(module_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_exam ON exam_questions(exam_id);
