-- Desafíos v2: dirigidos a un público, con bancos propios, ritmo rápido
-- (segundos POR PREGUNTA), un solo intento por persona y miniatura.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS audience VARCHAR(20) NOT NULL DEFAULT 'todos'
  CHECK (audience IN ('ninos', 'jovenes', 'adultos', 'todos'));

-- El desafío se configura por segundos por pregunta; el total se calcula.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS seconds_per_question SMALLINT NOT NULL DEFAULT 30;

-- Un solo intento: el ranking mide conocimiento, no insistencia. Para entrenar
-- está la práctica libre, que es ilimitada.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS one_attempt_only BOOLEAN NOT NULL DEFAULT TRUE;

-- Bancos de los que salen las preguntas (SVB, primeros auxilios, ética…).
-- Si está vacío, se usa el criterio antiguo por área/categoría.
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS bank_ids UUID[] NOT NULL DEFAULT '{}';

ALTER TABLE challenges ADD COLUMN IF NOT EXISTS thumbnail_key TEXT;

-- Los desafíos existentes conservan su ritmo actual.
UPDATE challenges
   SET seconds_per_question = GREATEST(5, ROUND(time_limit_seconds::numeric / NULLIF(num_questions, 0)))
 WHERE num_questions > 0;
