-- RGPD / LOPDGDD: consentimientos explícitos y granulares + registro probatorio.
-- Por defecto NO hay consentimiento de ranking: quien no lo otorgue aparece
-- como "Usuario anónimo" (también los ya registrados, hasta que lo acepten).
ALTER TABLE users    ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS privacy_version   VARCHAR(20);
ALTER TABLE users    ADD COLUMN IF NOT EXISTS ranking_consent   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE students ADD COLUMN IF NOT EXISTS accepted_terms_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS privacy_version   VARCHAR(20);
ALTER TABLE students ADD COLUMN IF NOT EXISTS ranking_consent   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN NOT NULL DEFAULT FALSE;

-- Prueba del consentimiento (art. 7.1 RGPD: hay que poder demostrarlo).
CREATE TABLE IF NOT EXISTS consent_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id   UUID NOT NULL,
  subject_type VARCHAR(10) NOT NULL CHECK (subject_type IN ('user', 'student')),
  consent      VARCHAR(40) NOT NULL,   -- terms | ranking | marketing
  granted      BOOLEAN NOT NULL,
  version      VARCHAR(20),
  ip           VARCHAR(64),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_consent_log_subject ON consent_log(subject_id, created_at DESC);
