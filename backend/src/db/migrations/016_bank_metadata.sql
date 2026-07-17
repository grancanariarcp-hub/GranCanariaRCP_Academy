-- Metadatos de banco (OPE/MIR) + temas por pregunta.
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS comunidad_autonoma   VARCHAR(120);
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS anio                 SMALLINT;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS categoria_profesional VARCHAR(160);
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS official             BOOLEAN NOT NULL DEFAULT FALSE; -- oficiales vs pool
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS descripcion          TEXT;

-- Ampliar 'kind' a rcp/ope/mir/otro (ya era VARCHAR sin CHECK estricto).
-- Las preguntas de OPE/MIR no usan la categoría RCP: la hacemos opcional.
ALTER TABLE questions ALTER COLUMN category DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_questions_tema ON questions(bank_id, tema);
