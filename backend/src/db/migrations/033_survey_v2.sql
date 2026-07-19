-- Encuesta v2: escala 1-10, posibilidad de NO evaluar un ítem y comentario por
-- ítem. Responder la encuesta pasa a ser requisito para el examen final (o para
-- el certificado si el curso no tiene examen final).
ALTER TABLE survey_item_scores DROP CONSTRAINT IF EXISTS survey_item_scores_score_check;
ALTER TABLE survey_item_scores ALTER COLUMN score DROP NOT NULL;
ALTER TABLE survey_item_scores ADD CONSTRAINT survey_item_scores_score_check
  CHECK (score IS NULL OR (score BETWEEN 1 AND 10));
ALTER TABLE survey_item_scores ADD COLUMN IF NOT EXISTS skipped BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE survey_item_scores ADD COLUMN IF NOT EXISTS comment TEXT;

ALTER TABLE survey_responses DROP CONSTRAINT IF EXISTS survey_responses_global_rating_check;
ALTER TABLE survey_responses ADD CONSTRAINT survey_responses_global_rating_check
  CHECK (global_rating IS NULL OR (global_rating BETWEEN 1 AND 10));

-- Las respuestas antiguas estaban en escala 1-5: se convierten a 1-10.
UPDATE survey_item_scores SET score = score * 2 WHERE score IS NOT NULL AND score <= 5;
UPDATE survey_responses   SET global_rating = global_rating * 2 WHERE global_rating IS NOT NULL AND global_rating <= 5;
