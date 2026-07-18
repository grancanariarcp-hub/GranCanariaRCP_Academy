-- Módulo de instituciones: alta autoservicio con validación, profesores de
-- institución (distintos de los profesores de cursos), clases y menores por QR.

-- 1) Estado y datos de contacto de la institución.
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active'
  CHECK (status IN ('pending', 'active', 'rejected'));
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS address       TEXT;
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_name  VARCHAR(160);
ALTER TABLE institutions ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(40);

-- 2) Nuevo rol institution_teacher (miembro de institución que crea clases de
--    menores). NO es un profesor de cursos de la plataforma.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'institution_admin', 'profesor', 'institution_teacher'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS admin_institution_rule;
ALTER TABLE users ADD CONSTRAINT admin_institution_rule CHECK (
  (role = 'super_admin'         AND institution_id IS NULL) OR
  (role = 'profesor'            AND institution_id IS NULL) OR
  (role = 'institution_admin'   AND institution_id IS NOT NULL) OR
  (role = 'institution_teacher' AND institution_id IS NOT NULL)
);

-- 3) Clases de menores (propiedad de un profesor de institución).
CREATE TABLE IF NOT EXISTS classes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id    UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  teacher_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name              VARCHAR(160) NOT NULL,
  expected_students SMALLINT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_classes_institution ON classes(institution_id);
CREATE INDEX IF NOT EXISTS idx_classes_teacher ON classes(teacher_id);

-- 4) Un alumno (menor) puede pertenecer a una clase.
ALTER TABLE students ADD COLUMN IF NOT EXISTS class_id UUID REFERENCES classes(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_id);
