-- Rediseño de acceso: alumnos "públicos" (adultos que se registran solos, sin
-- institución) y datos del alumno menor (edad + seudónimo por el código).
ALTER TABLE students ADD COLUMN IF NOT EXISTS age SMALLINT;

-- Un alumno ya no tiene por qué pertenecer a una institución.
ALTER TABLE students ALTER COLUMN institution_id DROP NOT NULL;
