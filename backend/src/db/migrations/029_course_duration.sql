-- Cálculo de la duración lectiva del curso (necesario para acreditar CFC).
-- Se estima sumando: lectura de documentos (páginas × min/página), lectura de
-- textos (palabras ÷ velocidad de lectura), duración de vídeos y tiempo de
-- tests y exámenes. Cada actividad admite una duración manual que prevalece.
ALTER TABLE activities ADD COLUMN IF NOT EXISTS duration_min INTEGER;

-- Parámetros de estimación, configurables por curso.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS min_per_page     NUMERIC(4,1) NOT NULL DEFAULT 3.0;  -- min por página de documento
ALTER TABLE courses ADD COLUMN IF NOT EXISTS words_per_min    SMALLINT     NOT NULL DEFAULT 200;  -- velocidad de lectura
ALTER TABLE courses ADD COLUMN IF NOT EXISTS min_per_question NUMERIC(4,1) NOT NULL DEFAULT 1.5;  -- test sin límite de tiempo
