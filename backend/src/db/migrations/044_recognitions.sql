-- Certificados de reconocimiento: desafíos ganados y horas de práctica.
--
-- No son certificados de aprovechamiento ni acreditados: reconocen la
-- participación y la dedicación. Se configuran con la misma lógica que los de
-- aprobación (quién certifica, firmantes e imagen de fondo), pero su literal
-- deja claro que NO otorgan créditos, para que nadie los confunda con la
-- formación oficial.

CREATE TABLE IF NOT EXISTS recognition_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  kind        VARCHAR(20) NOT NULL CHECK (kind IN ('desafio', 'horas')),
  title       VARCHAR(200) NOT NULL,

  -- Cuerpo con marcadores: {nombre} {desafio} {puesto} {horas} {fecha}
  body_template TEXT NOT NULL,
  -- Frase de cierre, destacada bajo el cuerpo.
  frase       TEXT,

  certifica        VARCHAR(200),
  firmante1_nombre VARCHAR(160),
  firmante1_cargo  VARCHAR(160),
  firmante2_nombre VARCHAR(160),
  firmante2_cargo  VARCHAR(160),
  bg_key           TEXT,

  -- kind='desafio': puesto máximo que da derecho (1 = solo el ganador).
  -- Si es NULL, lo obtiene todo el que complete el desafío.
  max_position     SMALLINT,
  -- Limitar a un desafío concreto; NULL = cualquiera.
  challenge_id     UUID REFERENCES challenges(id) ON DELETE CASCADE,

  -- kind='horas': umbral de horas acumuladas que lo desencadena.
  threshold_hours  NUMERIC(6,1),

  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rec_templates_kind ON recognition_templates (kind, is_active);

CREATE TABLE IF NOT EXISTS issued_recognitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code        VARCHAR(16) NOT NULL UNIQUE,
  template_id UUID REFERENCES recognition_templates(id) ON DELETE SET NULL,
  kind        VARCHAR(20) NOT NULL,

  -- Sin clave ajena: el reconocimiento sobrevive a la baja de la cuenta, igual
  -- que los rankings, y el nombre queda congelado en el momento de emitirlo.
  subject_id   UUID NOT NULL,
  subject_type VARCHAR(10) NOT NULL DEFAULT 'student',
  subject_name VARCHAR(160) NOT NULL,

  challenge_id    UUID,
  challenge_title VARCHAR(200),
  position        SMALLINT,
  hours           NUMERIC(6,1),

  issued_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_issued_rec_subject ON issued_recognitions (subject_id, issued_at DESC);

-- Un reconocimiento por persona y desafío, y uno por persona y umbral de horas.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rec_desafio
  ON issued_recognitions (subject_id, challenge_id) WHERE kind = 'desafio';
CREATE UNIQUE INDEX IF NOT EXISTS uniq_rec_horas
  ON issued_recognitions (subject_id, hours) WHERE kind = 'horas';
