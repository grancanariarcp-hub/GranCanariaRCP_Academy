-- Con más de un intento, qué nota cuenta: la MEJOR de todos los intentos
-- (por defecto, comportamiento actual) o la del ÚLTIMO intento realizado.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS grading_policy VARCHAR(8) NOT NULL DEFAULT 'mejor';
ALTER TABLE exams DROP CONSTRAINT IF EXISTS exams_grading_policy_check;
ALTER TABLE exams ADD CONSTRAINT exams_grading_policy_check CHECK (grading_policy IN ('mejor', 'ultimo'));
