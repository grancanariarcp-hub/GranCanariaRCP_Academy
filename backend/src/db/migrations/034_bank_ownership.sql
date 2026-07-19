-- Propiedad y visibilidad de los bancos de preguntas.
--   created_by = quién lo creó (NULL = bancos históricos de la plataforma)
--   visibility = 'privado' (solo su dueño) | 'publico' (cualquier profesor puede
--                usarlo como FUENTE de preguntas para sus exámenes, pero no
--                editarlo, borrarlo ni descargarlo).
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS visibility VARCHAR(10) NOT NULL DEFAULT 'publico'
  CHECK (visibility IN ('privado', 'publico'));

CREATE INDEX IF NOT EXISTS idx_banks_owner ON question_banks(created_by);
