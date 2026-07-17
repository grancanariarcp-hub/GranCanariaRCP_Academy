-- Fase A2: perfil del profesor (para su ficha y, más adelante, el reclutamiento).
ALTER TABLE users ADD COLUMN IF NOT EXISTS headline VARCHAR(160);
