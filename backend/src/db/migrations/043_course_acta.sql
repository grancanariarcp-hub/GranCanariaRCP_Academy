-- Acta del curso: el documento que cierra la actividad formativa.
--
-- Un acta debe ser INMUTABLE una vez cerrada: es lo que se presenta ante la
-- comisión de formación continuada si audita. Por eso no se recalcula al
-- consultarla, sino que guarda una instantánea completa de los datos en el
-- momento del cierre, junto con un hash que permite detectar manipulaciones.
--
-- Corregir un acta cerrada no la reescribe: crea una versión nueva del mismo
-- número, de modo que la corrección queda trazada.

CREATE TABLE IF NOT EXISTS course_actas (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  -- Número correlativo por año: ACTA-2026-000007.
  numero      VARCHAR(30) NOT NULL,
  version     SMALLINT NOT NULL DEFAULT 1,
  -- Código público corto para el QR de verificación.
  code        VARCHAR(16) NOT NULL UNIQUE,

  -- Instantánea íntegra: ficha, profesorado, temario, asistencia,
  -- calificaciones y resultados de la encuesta tal como estaban al cerrar.
  snapshot    JSONB NOT NULL,
  -- SHA-256 del snapshot: si alguien alterase la fila, dejaría de cuadrar.
  hash        CHAR(64) NOT NULL,

  -- Motivo de la nueva versión, cuando se rehace un acta ya cerrada.
  motivo      VARCHAR(300),

  closed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (numero, version)
);

CREATE INDEX IF NOT EXISTS idx_actas_course ON course_actas (course_id, version DESC);

-- Contador de actas por año natural.
CREATE TABLE IF NOT EXISTS acta_counters (
  year    SMALLINT PRIMARY KEY,
  last_no INTEGER NOT NULL DEFAULT 0
);

-- Un curso con acta cerrada queda cerrado a efectos docentes.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS acta_closed_at TIMESTAMPTZ;
