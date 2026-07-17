-- Fase E: intentos de examen de los alumnos.
CREATE TABLE IF NOT EXISTS exam_attempts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id            UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id         UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at       TIMESTAMPTZ,
  score              SMALLINT,      -- % sobre las auto-corregibles (test/vf)
  passed             BOOLEAN,
  time_spent_seconds INTEGER,
  auto_total         SMALLINT,      -- nº de preguntas auto-corregibles
  auto_correct       SMALLINT,
  answers            JSONB          -- { questionId: índice (test/vf) | texto (abierta) }
);

CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student ON exam_attempts(student_id);
