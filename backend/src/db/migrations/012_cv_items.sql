-- CV esquemático del profesor: ítems por categoría (visible a los alumnos).
CREATE TABLE IF NOT EXISTS cv_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category   VARCHAR(20) NOT NULL CHECK (category IN ('formacion', 'investigacion', 'publicaciones', 'reconocimientos', 'experiencia')),
  text       TEXT NOT NULL,
  sort_order SMALLINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cv_items_user ON cv_items(user_id);
