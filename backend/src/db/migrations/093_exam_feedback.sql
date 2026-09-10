-- Feedback en los exámenes:
--  · exam_questions.explanation    → feedback general de la pregunta (por qué).
--  · exam_questions.option_feedback→ feedback por opción (array alineado a options).
--  · exams.feedback_general        → valoración general del examen para el alumno.
-- (attempts_allowed = 0 pasa a significar «intentos infinitos»; no necesita cambio
--  de esquema porque no había CHECK.)
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS explanation TEXT;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS option_feedback JSONB NOT NULL DEFAULT '[]';
ALTER TABLE exams ADD COLUMN IF NOT EXISTS feedback_general TEXT;
