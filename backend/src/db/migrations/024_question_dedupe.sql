-- Detección de preguntas duplicadas dentro de un mismo banco.
-- text_norm = md5 del enunciado normalizado (minúsculas, sin espacios ni
-- puntuación), así "¿Profundidad en adulto?" y "profundidad en adulto"
-- se detectan como la misma pregunta.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS text_norm TEXT;

UPDATE questions
   SET text_norm = md5(lower(regexp_replace(text, '[^[:alnum:]]+', '', 'g')))
 WHERE text_norm IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_bank_norm ON questions(bank_id, text_norm);
