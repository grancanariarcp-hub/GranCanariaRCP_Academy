-- Opción de imprimir el programa del curso en el reverso del certificado.
-- Si se activa, el PDF del certificado lleva una segunda página con el temario
-- completo (módulos y actividades) del curso.
ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS cert_programa_reverso BOOLEAN NOT NULL DEFAULT FALSE;
