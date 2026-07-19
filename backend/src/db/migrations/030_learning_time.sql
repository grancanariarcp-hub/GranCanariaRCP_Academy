-- Tiempo de estudio: distingue tiempo ACTIVO (pestaña visible + interacción
-- reciente) del tiempo de sesión (la pestaña simplemente abierta). El activo es
-- el que sirve para justificar dedicación y para cruzarlo con los resultados.
CREATE TABLE IF NOT EXISTS learning_time (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id      UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES courses(id) ON DELETE CASCADE, -- NULL = fuera de un curso (práctica, desafíos)
  day             DATE NOT NULL,
  active_seconds  INTEGER NOT NULL DEFAULT 0,
  session_seconds INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_learning_time_student ON learning_time(student_id, day);
CREATE INDEX IF NOT EXISTS idx_learning_time_course ON learning_time(course_id, student_id);
