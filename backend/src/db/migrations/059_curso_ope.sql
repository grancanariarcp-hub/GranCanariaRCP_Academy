-- Marca de curso de preparación de oposiciones.
--
-- Un curso OPE es un generador de exámenes: no tiene profesorado que impartir,
-- ni encuesta de satisfacción de docentes, ni acreditación CFC, ni certificado
-- ni acta, porque no evalúa ni titula. Mostrarle al director todos esos
-- bloques vacíos confunde y hace pensar que falta configurarlos.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS es_ope BOOLEAN NOT NULL DEFAULT FALSE;

-- Los cursos creados desde una convocatoria ya lo son por definición.
UPDATE courses SET es_ope = TRUE
 WHERE id IN (SELECT course_id FROM ope_convocatorias WHERE course_id IS NOT NULL);
