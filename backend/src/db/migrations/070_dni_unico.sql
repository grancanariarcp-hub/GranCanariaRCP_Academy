-- El documento del alumno es la llave con la que se cruza su nota práctica desde
-- PÚLSAR. Se validaba la unicidad solo en código, con un «comprueba y luego
-- inserta» que dos altas simultáneas podían saltarse, dejando dos cuentas con el
-- mismo documento: entonces la nota práctica se adjudicaría a la persona
-- equivocada. Se blinda en la base de datos.
--
-- Índice PARCIAL: solo sobre cuentas vivas con documento. Así una cuenta dada de
-- baja no bloquea que ese documento vuelva a registrarse (y la baja, además,
-- ahora limpia el documento).

CREATE UNIQUE INDEX IF NOT EXISTS uq_students_dni_vivo
  ON students (dni) WHERE dni IS NOT NULL AND deleted_at IS NULL;
