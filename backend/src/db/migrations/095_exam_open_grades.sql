-- Corrección manual de las preguntas ABIERTAS: el profesor puntúa (0..1) y
-- comenta cada respuesta abierta de un intento. La nota del intento se recalcula
-- sumando estos puntos a la parte automática.
CREATE TABLE IF NOT EXISTS exam_open_grades (
  attempt_id  UUID NOT NULL REFERENCES exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  points      NUMERIC(4,3) NOT NULL DEFAULT 0,   -- 0 a 1 (fracción de la pregunta)
  comment     TEXT,
  graded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  graded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (attempt_id, question_id)
);
