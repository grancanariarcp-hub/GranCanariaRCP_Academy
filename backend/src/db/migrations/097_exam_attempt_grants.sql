-- "Otra oportunidad": el profesor concede intentos EXTRA a un alumno concreto en
-- un examen (p. ej. lo envió por error teniendo un solo intento). No se borra el
-- historial: el intento erróneo se conserva y, según la política de nota del
-- examen (mejor/último), el nuevo intento cuenta como corresponda. El límite
-- efectivo pasa a ser attempts_allowed + extra_attempts para ese alumno.
CREATE TABLE IF NOT EXISTS exam_attempt_grants (
  exam_id        UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  extra_attempts INT  NOT NULL DEFAULT 0,
  granted_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (exam_id, student_id)
);
