-- Seguimiento del avance: qué actividades ha completado cada alumno.
-- Las actividades normales las marca el alumno; las de examen/test se marcan
-- solas al aprobarlas. Con esto se calcula la barra de avance y los pendientes.
CREATE TABLE IF NOT EXISTS activity_completions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  activity_id  UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, activity_id)
);
CREATE INDEX IF NOT EXISTS idx_activity_completions_student ON activity_completions(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_completions_activity ON activity_completions(activity_id);
