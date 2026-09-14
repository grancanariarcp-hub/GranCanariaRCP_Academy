-- La encuesta de satisfacción puede marcarse como OBLIGATORIA (hay que
-- responderla para hacer el examen final y descargar el certificado) o no.
-- is_open ya indica si la encuesta está INCLUIDA/abierta a respuestas.
ALTER TABLE course_surveys ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT TRUE;
