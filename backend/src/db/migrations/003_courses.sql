-- Fase A: rol profesor, taxonomías (tema/subtema/público) y cursos.

-- 1) Rol profesor + estado de la cuenta (los profesores se validan).
ALTER TABLE users ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'active';

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'institution_admin', 'profesor'));

ALTER TABLE users DROP CONSTRAINT IF EXISTS admin_institution_rule;
ALTER TABLE users ADD CONSTRAINT admin_institution_rule CHECK (
  (role = 'super_admin'      AND institution_id IS NULL) OR
  (role = 'profesor'         AND institution_id IS NULL) OR
  (role = 'institution_admin' AND institution_id IS NOT NULL)
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check') THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('pending', 'active', 'rejected'));
  END IF;
END $$;

-- 2) Taxonomías editables por super_admin (desplegables de tema/subtema/público).
CREATE TABLE IF NOT EXISTS taxonomies (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind       VARCHAR(16) NOT NULL CHECK (kind IN ('tema', 'subtema', 'publico')),
  label      VARCHAR(120) NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kind, label)
);

-- 3) Cursos.
CREATE TABLE IF NOT EXISTS courses (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title                 VARCHAR(200) NOT NULL,
  tema                  VARCHAR(120),
  subtema               VARCHAR(120),
  duration_hours        NUMERIC(6,1),
  modality              VARCHAR(16) NOT NULL DEFAULT 'online' CHECK (modality IN ('online', 'mixto', 'presencial')),
  objetivo_general      TEXT,
  objetivos_especificos TEXT,
  publico_objetivo      TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_key         TEXT,
  price_cents           INTEGER NOT NULL DEFAULT 0,     -- 0 = gratis
  enrollment_open       BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(16) NOT NULL DEFAULT 'borrador' CHECK (status IN ('borrador', 'publicado', 'archivado')),
  starts_at             DATE,
  ends_at               DATE,
  final_exam_start      DATE,
  final_exam_end        DATE,
  created_by            UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4) Staff del curso: directores e instructores.
CREATE TABLE IF NOT EXISTS course_staff (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      VARCHAR(16) NOT NULL DEFAULT 'instructor' CHECK (role IN ('director', 'instructor')),
  PRIMARY KEY (course_id, user_id)
);

-- 5) Módulos.
CREATE TABLE IF NOT EXISTS modules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id    UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title        VARCHAR(200) NOT NULL,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at    DATE,
  ends_at      DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_courses_created_by ON courses(created_by);
CREATE INDEX IF NOT EXISTS idx_course_staff_user ON course_staff(user_id);
CREATE INDEX IF NOT EXISTS idx_modules_course ON modules(course_id);

-- 6) Valores base de las taxonomías (editables luego por super_admin).
INSERT INTO taxonomies (kind, label, sort_order) VALUES
  ('tema', 'RCP', 1), ('tema', 'Medicina Intensiva', 2), ('tema', 'Emergencias', 3),
  ('subtema', 'SVB', 1), ('subtema', 'SVA', 2), ('subtema', 'SVI', 3),
  ('subtema', 'Respiratorio', 4), ('subtema', 'Cardiológico', 5), ('subtema', 'Neurocrítico', 6),
  ('publico', 'Médicos', 1), ('publico', 'Enfermeros', 2),
  ('publico', 'Estudiantes de Medicina', 3), ('publico', 'Estudiantes de Enfermería', 4)
ON CONFLICT (kind, label) DO NOTHING;
