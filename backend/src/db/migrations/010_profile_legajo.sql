-- Perfil (foto) y campos de curso para el legajo / ficha pública.
ALTER TABLE users   ADD COLUMN IF NOT EXISTS photo_key    TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS resumen      TEXT;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS acreditacion VARCHAR(200);  -- institución que acredita
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cfc          VARCHAR(120);  -- CFC otorgados / en trámite
