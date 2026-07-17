-- Certificados emitidos: SOLO metadatos para poder mostrar/verificar la versión
-- digital vía QR. El PDF NO se guarda (se regenera al vuelo). Ocupa mínimo.
CREATE TABLE IF NOT EXISTS issued_certificates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code         VARCHAR(16) UNIQUE NOT NULL,  -- código público corto para la URL/QR
  student_id   UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  student_name VARCHAR(160) NOT NULL,        -- snapshot del nombre
  issued_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (student_id, course_id)
);
