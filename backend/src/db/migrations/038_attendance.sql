-- Asistencia presencial: jornadas/actividades con registro de entrada y salida,
-- por QR rotativo desde el perfil del alumno o a mano por el profesor.

-- Umbral mínimo de asistencia que condiciona el certificado (requisito típico
-- de las comisiones de formación continuada).
ALTER TABLE courses ADD COLUMN IF NOT EXISTS min_attendance_pct SMALLINT NOT NULL DEFAULT 80;

-- Datos identificativos para actas y listados oficiales de asistencia. Solo se
-- piden a los alumnos adultos que cursan formación acreditada; los menores
-- siguen identificándose únicamente por su seudónimo.
ALTER TABLE students ADD COLUMN IF NOT EXISTS nombre    VARCHAR(80);
ALTER TABLE students ADD COLUMN IF NOT EXISTS apellidos VARCHAR(120);
ALTER TABLE students ADD COLUMN IF NOT EXISTS dni       VARCHAR(20);

-- Una fila por jornada o actividad presencial evaluable.
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  -- Opcional: ata la jornada a una actividad concreta del temario.
  activity_id  UUID REFERENCES activities(id) ON DELETE SET NULL,
  title        VARCHAR(200) NOT NULL,
  session_date DATE NOT NULL,
  starts_at    TIME,
  ends_at      TIME,
  -- Permanencia mínima antes de poder fichar la salida: evita que se registre
  -- entrada y salida seguidas y conste como asistencia completa.
  min_minutes  SMALLINT NOT NULL DEFAULT 30,
  -- Semilla del token rotativo del QR. Nunca sale del servidor.
  qr_secret    TEXT NOT NULL,
  -- Segundos de validez de cada token: un QR fotografiado caduca enseguida.
  qr_window_seconds SMALLINT NOT NULL DEFAULT 45,
  is_open      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_att_sessions_course ON attendance_sessions (course_id, session_date);

-- Un registro por alumno y jornada.
CREATE TABLE IF NOT EXISTS attendance_records (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  check_in_at  TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  in_method    VARCHAR(10) CHECK (in_method  IS NULL OR in_method  IN ('qr', 'manual')),
  out_method   VARCHAR(10) CHECK (out_method IS NULL OR out_method IN ('qr', 'manual')),
  -- Profesor que lo marcó cuando el registro es manual.
  marked_by    UUID REFERENCES users(id) ON DELETE SET NULL,
  -- Incidencias: retraso, ausencia justificada, salida anticipada…
  incidencia   VARCHAR(200),
  UNIQUE (session_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_att_records_student ON attendance_records (student_id);
