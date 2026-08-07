-- Visibilidad «restringida» de un banco: además de privado (solo su dueño) y
-- público (cualquier profesor lo usa como fuente), un banco puede compartirse
-- con una lista concreta de profesores. La lista vive en bank_access.
ALTER TABLE question_banks ALTER COLUMN visibility TYPE VARCHAR(12);
ALTER TABLE question_banks DROP CONSTRAINT IF EXISTS question_banks_visibility_check;
ALTER TABLE question_banks ADD CONSTRAINT question_banks_visibility_check
  CHECK (visibility IN ('privado', 'publico', 'restringido'));

-- Profesores con acceso a un banco restringido. El dueño no necesita figurar:
-- siempre ve lo suyo. Se borra en cascada con el banco o con el usuario.
CREATE TABLE IF NOT EXISTS bank_access (
  bank_id    UUID NOT NULL REFERENCES question_banks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bank_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bank_access_user ON bank_access(user_id);
