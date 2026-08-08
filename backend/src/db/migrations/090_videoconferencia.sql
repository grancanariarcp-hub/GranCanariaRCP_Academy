-- Videoconferencia dentro del campus (LiveKit). Es un tipo de actividad más
-- dentro de un módulo: al abrirla, alumno y profesor entran a la misma sala.
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN ('documento', 'video', 'enlace', 'test', 'examen', 'texto', 'imagen', 'videoconferencia'));

-- Config de la sala por actividad: si la cámara es obligatoria y si está abierta.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS camara_obligatoria BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE activities ADD COLUMN IF NOT EXISTS sala_abierta BOOLEAN NOT NULL DEFAULT TRUE;

-- Registro de asistencia/presencia a las sesiones en directo. Una fila por
-- persona y sesión; se va actualizando mientras está conectada (heartbeat) para
-- poder medir cuánto tiempo estuvo realmente presente.
CREATE TABLE IF NOT EXISTS video_attendance (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id  UUID NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  user_type    VARCHAR(10) NOT NULL CHECK (user_type IN ('user', 'student')),
  user_id      UUID NOT NULL,
  nombre       VARCHAR(200),
  rol          VARCHAR(20) NOT NULL DEFAULT 'alumno',   -- 'profesor' | 'alumno'
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  camara_on    BOOLEAN NOT NULL DEFAULT FALSE,
  segundos     INTEGER NOT NULL DEFAULT 0                -- tiempo presente acumulado
);
CREATE INDEX IF NOT EXISTS idx_video_attendance_activity ON video_attendance(activity_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_video_attendance_persona
  ON video_attendance(activity_id, user_type, user_id);
