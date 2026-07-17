-- Fase F: configuración del certificado del curso.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS certifica         VARCHAR(200);  -- quién certifica
ALTER TABLE courses ADD COLUMN IF NOT EXISTS firmante1_nombre  VARCHAR(160);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS firmante1_cargo   VARCHAR(160);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS firmante2_nombre  VARCHAR(160);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS firmante2_cargo   VARCHAR(160);
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cert_bg_key       TEXT;          -- imagen de fondo (R2)
ALTER TABLE courses ADD COLUMN IF NOT EXISTS cfc_image_key     TEXT;          -- imagen de los CFC (R2)
