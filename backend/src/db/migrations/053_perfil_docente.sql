-- Profesión sanitaria del docente.
--
-- El alumno debe saber no solo el nombre de quien le enseña, sino su profesión
-- colegiada. Se pide junto al currículum antes de publicar un curso.
ALTER TABLE users ADD COLUMN IF NOT EXISTS profession VARCHAR(120);
