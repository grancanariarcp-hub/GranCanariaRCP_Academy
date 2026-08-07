-- Anti-duplicados de los recordatorios de fecha límite.
--
-- El recordatorio del examen final se envía unos días antes. Como lo dispara una
-- tarea diaria (cron-job.org) que podría ejecutarse más de una vez, se registra
-- cada recordatorio ya enviado; el envío inserta con ON CONFLICT DO NOTHING y
-- solo notifica cuando la inserción es nueva. Así, se ejecute las veces que se
-- ejecute, cada alumno recibe cada aviso una sola vez.
--
-- kind identifica el aviso concreto (p. ej. 'examen_3d', 'examen_1d').
CREATE TABLE IF NOT EXISTS course_reminders (
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  kind       VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (student_id, course_id, kind)
);
