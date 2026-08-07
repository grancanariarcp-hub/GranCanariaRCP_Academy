-- Visibilidad de un documento, igual que en los bancos.
--   privado     = solo su autor
--   publico     = cualquier profesor lo ve y puede enlazarlo en sus cursos
--   restringido = solo los profesores de la lista document_access
--
-- Hasta ahora no había columna: un profesor veía SUS documentos y los subidos
-- por la plataforma (super admin). Para no cambiar ese comportamiento, los
-- documentos de la plataforma (autor super admin o sin autor) se marcan
-- 'publico' y el resto 'privado'.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS visibility VARCHAR(12) NOT NULL DEFAULT 'privado';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'documents_visibility_check'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_visibility_check
      CHECK (visibility IN ('privado', 'publico', 'restringido'));
  END IF;
END $$;

UPDATE documents SET visibility = 'publico'
 WHERE uploaded_by IS NULL
    OR uploaded_by IN (SELECT id FROM users WHERE role = 'super_admin');

CREATE TABLE IF NOT EXISTS document_access (
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (document_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_document_access_user ON document_access(user_id);
