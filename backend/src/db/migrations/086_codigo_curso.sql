-- Código de curso legible: PREFIJO-Modalidad-AÑO-NN
--   ej. SVA-ONL-2026-01, SEG-PRE-2026-02
-- Las letras orientan el tema, la modalidad y el año; NN es el nº de curso de
-- ese año (se reinicia cada año). Se autogenera al crear y el super admin puede
-- editarlo. Sirve para buscar en auditoría y para vincular la comisión CFC.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS codigo_curso VARCHAR(40);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courses_codigo ON courses(codigo_curso) WHERE codigo_curso IS NOT NULL;
