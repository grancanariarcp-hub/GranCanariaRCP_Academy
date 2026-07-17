-- Núcleo original: desafíos de RCP/primeros auxilios + rankings públicos.

-- Nueva área de preguntas: primeros auxilios (PA), además de SVB/SVI/SVA.
ALTER TABLE questions DROP CONSTRAINT IF EXISTS questions_category_check;
ALTER TABLE questions ADD CONSTRAINT questions_category_check
  CHECK (category IN ('SVB', 'SVI', 'SVA', 'PA'));

CREATE TABLE IF NOT EXISTS challenges (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              VARCHAR(200) NOT NULL,
  area               VARCHAR(8) NOT NULL DEFAULT 'SVB' CHECK (area IN ('SVB', 'PA', 'mixto')),
  num_questions      SMALLINT NOT NULL DEFAULT 10,
  time_limit_seconds INTEGER NOT NULL DEFAULT 300,
  kind               VARCHAR(12) NOT NULL DEFAULT 'temporal' CHECK (kind IN ('permanente', 'temporal')),
  starts_at          TIMESTAMPTZ,
  ends_at            TIMESTAMPTZ,
  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS challenge_attempts (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id      UUID NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  participant_id    UUID NOT NULL,               -- student/user (sin FK: rankings persisten)
  participant_name  VARCHAR(120) NOT NULL,
  participant_role  VARCHAR(20),
  institution_id    UUID,
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  submitted_at      TIMESTAMPTZ,
  correct           SMALLINT,
  total             SMALLINT,
  time_seconds      INTEGER,
  answers           JSONB
);

CREATE INDEX IF NOT EXISTS idx_chatt_challenge ON challenge_attempts(challenge_id);
CREATE INDEX IF NOT EXISTS idx_chatt_participant ON challenge_attempts(participant_id);

-- Desafío permanente: 10 preguntas en 5 minutos (SVB + primeros auxilios).
INSERT INTO challenges (title, area, num_questions, time_limit_seconds, kind)
SELECT 'Desafío permanente', 'mixto', 10, 300, 'permanente'
WHERE NOT EXISTS (SELECT 1 FROM challenges WHERE kind = 'permanente');
