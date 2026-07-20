-- Enlaza cada convocatoria con SU curso.
--
-- Una convocatoria agrupa bancos de preguntas; un curso es lo que se vende:
-- tiene ficha, miniatura, precio, matrícula y certificado. Eran dos cosas
-- separadas y no había forma de decir "este curso prepara esta oposición", así
-- que el super admin creaba la convocatoria y no encontraba dónde publicarla.
--
-- Con el enlace, el curso sigue siendo el producto —se publica, se matricula y
-- se cobra como cualquier otro— y la convocatoria aporta sus bancos a quien
-- esté matriculado.

ALTER TABLE ope_convocatorias
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;

-- Convocatoria abierta: sin curso asociado, sus bancos son de acceso libre
-- para cualquiera que entre a preparar oposiciones.
COMMENT ON COLUMN ope_convocatorias.course_id IS
  'Curso que da acceso a esta convocatoria. NULL = abierta a cualquier usuario.';

CREATE INDEX IF NOT EXISTS idx_convocatorias_curso ON ope_convocatorias (course_id);
