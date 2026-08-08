-- Vínculo formal entre un miembro de la comisión (auditor) y un curso que
-- evalúa para otorgar los CFC, con su ventana de validez. Por defecto la
-- ventana son las fechas del curso, pero se puede ajustar (una comisión puede
-- revisar antes de que empiece o después de que termine).
--
-- Los auditores ya consultan la plataforma en modo lectura; este vínculo es el
-- registro oficial de QUÉ cursos evalúa cada uno y DURANTE cuándo, base para
-- acotar en el futuro su acceso al historial acreditable de esos cursos.
CREATE TABLE IF NOT EXISTS course_auditors (
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  starts_at  DATE,
  ends_at    DATE,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_course_auditors_user ON course_auditors(user_id);
