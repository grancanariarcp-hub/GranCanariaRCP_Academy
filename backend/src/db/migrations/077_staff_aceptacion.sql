-- Aceptación del profesorado.
--
-- Incluir a un profesor en un curso ya no lo hace participante de inmediato: su
-- participación queda PENDIENTE hasta que él la acepte desde su perfil. Un
-- profesor no debe aparecer como responsable de una formación —ni en la ficha
-- pública ni en el acta que se acredita— sin haber dado su conformidad.
--
-- Estados: 'pendiente' (invitado, sin responder), 'aceptado', 'rechazado'.
-- Nuevas invitaciones nacen 'pendiente' por defecto; el creador del curso se
-- marca 'aceptado' en el código (obviamente participa). Las filas YA existentes
-- se dan por aceptadas: son profesores que ya están trabajando en sus cursos.
ALTER TABLE course_staff
  ADD COLUMN IF NOT EXISTS status VARCHAR(12) NOT NULL DEFAULT 'pendiente'
  CHECK (status IN ('pendiente', 'aceptado', 'rechazado'));

UPDATE course_staff SET status = 'aceptado' WHERE status = 'pendiente';
