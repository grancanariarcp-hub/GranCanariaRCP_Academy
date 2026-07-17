-- Fase B: actividades dentro de cada módulo (documento / vídeo / enlace / test / examen).
CREATE TABLE IF NOT EXISTS activities (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id    UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  type         VARCHAR(16) NOT NULL CHECK (type IN ('documento', 'video', 'enlace', 'test', 'examen')),
  title        VARCHAR(200) NOT NULL,
  sort_order   SMALLINT NOT NULL DEFAULT 0,
  is_mandatory BOOLEAN NOT NULL DEFAULT FALSE,   -- obligatorio verlo para avanzar
  document_id  UUID REFERENCES documents(id) ON DELETE SET NULL,
  url          TEXT,
  body         TEXT,
  exam_id      UUID,                             -- se enlazará en la Fase C
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activities_module ON activities(module_id);
