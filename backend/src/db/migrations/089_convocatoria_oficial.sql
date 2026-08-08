-- Campos para el documento oficial de la convocatoria de oposición. Hasta ahora
-- la convocatoria solo tenía nombre, comunidad, categoría, año y una descripción
-- libre; para poder generar el documento de convocatoria se añaden los datos
-- formales (organismo, plazas, fechas del plazo, requisitos y referencias a las
-- bases y al boletín). Todos son opcionales: el documento imprime solo lo que hay.
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS organismo         VARCHAR(200);
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS plazas            INTEGER;
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS fecha_publicacion DATE;
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS plazo_desde       DATE;
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS plazo_hasta       DATE;
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS requisitos        TEXT;
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS bases_url         TEXT;
ALTER TABLE ope_convocatorias ADD COLUMN IF NOT EXISTS boletin_ref       VARCHAR(200);
