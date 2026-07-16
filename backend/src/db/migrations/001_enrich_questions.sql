-- Enrich the question bank with the Plan Maestro v2 dimensions:
-- audience (niños/jóvenes/adultos), question type (theory vs clinical case),
-- clinical context, references, video, flashcard, tags and criticality.
-- Idempotent: safe to run on databases created before these columns existed.

ALTER TABLE questions ADD COLUMN IF NOT EXISTS audiences TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS qtype VARCHAR(16) NOT NULL DEFAULT 'teorica';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS clinical_context TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_erc TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS source_plan_nacional TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS flashcard TEXT;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_critical BOOLEAN NOT NULL DEFAULT FALSE;

-- Constrain qtype to the two supported values (added only if missing).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_qtype_check') THEN
    ALTER TABLE questions ADD CONSTRAINT questions_qtype_check CHECK (qtype IN ('teorica', 'caso_clinico'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_questions_qtype ON questions(qtype);
CREATE INDEX IF NOT EXISTS idx_questions_audiences ON questions USING GIN (audiences);

-- Give any pre-existing questions a sensible default audience so they aren't empty.
UPDATE questions SET audiences = ARRAY['jovenes', 'adultos'] WHERE audiences = '{}';
