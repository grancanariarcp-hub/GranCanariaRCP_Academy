-- Nuevas actividades: cuadro de texto y imagen (en R2).
ALTER TABLE activities ADD COLUMN IF NOT EXISTS image_key TEXT;

ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check
  CHECK (type IN ('documento', 'video', 'enlace', 'test', 'examen', 'texto', 'imagen'));
