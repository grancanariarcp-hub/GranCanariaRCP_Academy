-- Actividades evaluables y sus notas.
--
-- El profesor marca qué actividades de un módulo son evaluables y con qué
-- método: 'examen' (nota automática del examen enlazado), 'finalizacion' (apto
-- al completarla) o 'manual' (el profesor pone la nota). Con esto, el alumno ve
-- en su pestaña Calificaciones qué se le evalúa y con cuánto.
ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS evaluable    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS metodo_eval  VARCHAR(16);

-- Notas manuales que pone el profesor por alumno y actividad.
CREATE TABLE IF NOT EXISTS activity_grades (
  activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  nota        NUMERIC(5,2),
  apto        BOOLEAN,
  graded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  graded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (activity_id, student_id)
);
