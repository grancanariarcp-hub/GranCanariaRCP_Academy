-- ==========================================================================
-- GranCanaria RCP Academy - PostgreSQL schema (Phase 1)
-- Roles: super_admin, institution_admin, student
-- RGPD notes:
--   * Minors are stored WITHOUT direct identifiers, keyed by an irreversible
--     identity_hash so an institution can't register the same child twice.
--   * Adult contact data can be stored encrypted (see students.email_enc).
-- ==========================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- provides gen_random_uuid()

-- --------------------------------------------------------------------------
-- Institutions (schools / academies that enroll students)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS institutions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(160) NOT NULL,
  code           VARCHAR(32)  NOT NULL UNIQUE,       -- short public code, e.g. "IES-GC-01"
  contact_email  VARCHAR(200),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- --------------------------------------------------------------------------
-- Users = administrators (super_admin + institution_admin).
-- Students live in their own table because they authenticate differently.
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          VARCHAR(200) NOT NULL UNIQUE,
  password_hash  VARCHAR(120) NOT NULL,
  name           VARCHAR(160) NOT NULL,
  role           VARCHAR(20)  NOT NULL CHECK (role IN ('super_admin', 'institution_admin')),
  -- super_admin has no institution; institution_admin must belong to one.
  institution_id UUID REFERENCES institutions(id) ON DELETE CASCADE,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_institution_rule CHECK (
    (role = 'super_admin' AND institution_id IS NULL) OR
    (role = 'institution_admin' AND institution_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_users_institution ON users(institution_id);

-- --------------------------------------------------------------------------
-- Students. Three ways to authenticate:
--   1) register + email/password  (adults)
--   2) email/password login       (adults)
--   3) access_code login          (minors / quick access, no personal data)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  institution_id UUID NOT NULL REFERENCES institutions(id) ON DELETE CASCADE,
  display_name   VARCHAR(120) NOT NULL,               -- nickname / alias, safe to show
  access_code    VARCHAR(20)  NOT NULL UNIQUE,        -- login method 3 (RCP-XXXX-XXXX)
  is_minor       BOOLEAN NOT NULL DEFAULT FALSE,

  -- Adult-only credentials (nullable: minors use access_code only)
  email          VARCHAR(200) UNIQUE,
  password_hash  VARCHAR(120),

  -- RGPD: irreversible hash used only to dedupe minors within an institution
  identity_hash  VARCHAR(64),

  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT uniq_identity_per_institution UNIQUE (institution_id, identity_hash)
);

CREATE INDEX IF NOT EXISTS idx_students_institution ON students(institution_id);
CREATE INDEX IF NOT EXISTS idx_students_access_code ON students(access_code);

-- --------------------------------------------------------------------------
-- Question bank. Categories map to the CPR course levels:
--   SVB = Soporte Vital Basico, SVI = Intermedio, SVA = Avanzado
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS questions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category       VARCHAR(8) NOT NULL CHECK (category IN ('SVB', 'SVI', 'SVA')),
  text           TEXT NOT NULL,
  options        JSONB NOT NULL,                       -- array of option strings
  correct_index  SMALLINT NOT NULL,
  explanation    TEXT,
  difficulty     SMALLINT NOT NULL DEFAULT 1 CHECK (difficulty BETWEEN 1 AND 3),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_by     UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_questions_category ON questions(category);

-- --------------------------------------------------------------------------
-- Test responses (one row per answered question).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS test_responses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  question_id    UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  selected_index SMALLINT NOT NULL,
  is_correct     BOOLEAN NOT NULL,
  answered_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_responses_student ON test_responses(student_id);

-- --------------------------------------------------------------------------
-- Audit log for security-relevant actions (logins, admin/institution CRUD).
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id       UUID,                                 -- user or student id (no FK: keep logs if actor deleted)
  actor_type     VARCHAR(20),                          -- super_admin | institution_admin | student | anonymous
  action         VARCHAR(80) NOT NULL,                 -- e.g. AUTH_LOGIN_SUCCESS
  entity         VARCHAR(60),                          -- affected entity type
  entity_id      UUID,
  ip             VARCHAR(64),
  metadata       JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
