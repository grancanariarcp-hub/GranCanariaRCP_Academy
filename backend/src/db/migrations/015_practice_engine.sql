-- Motor de práctica GENÉRICO (reutilizable con cualquier banco de preguntas:
-- RCP, OPE, etc.) + registro de respuestas por usuario para estadísticas.

CREATE TABLE IF NOT EXISTS question_banks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       VARCHAR(160) NOT NULL,
  kind       VARCHAR(20) NOT NULL DEFAULT 'rcp',   -- rcp | ope | otro
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Banco RCP por defecto (el actual).
INSERT INTO question_banks (name, kind)
SELECT 'Banco RCP', 'rcp'
WHERE NOT EXISTS (SELECT 1 FROM question_banks WHERE kind = 'rcp');

-- Cada pregunta pertenece a un banco y puede tener un "tema" libre (para OPE).
ALTER TABLE questions ADD COLUMN IF NOT EXISTS bank_id UUID REFERENCES question_banks(id) ON DELETE CASCADE;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS tema VARCHAR(160);
UPDATE questions SET bank_id = (SELECT id FROM question_banks WHERE kind = 'rcp' LIMIT 1) WHERE bank_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_questions_bank ON questions(bank_id);

-- Registro de respuestas (la "máquina" de estadísticas). Una fila por
-- pregunta respondida, venga de práctica, desafío o examen.
CREATE TABLE IF NOT EXISTS answer_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,               -- alumno/usuario (sin FK: histórico persiste)
  question_id UUID NOT NULL,
  bank_id     UUID,
  category    VARCHAR(16),                 -- tema/categoría de la pregunta (denormalizado)
  is_correct  BOOLEAN NOT NULL,
  source      VARCHAR(12) NOT NULL DEFAULT 'practica', -- practica | desafio | examen
  answered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_answerlog_user ON answer_log(user_id);
CREATE INDEX IF NOT EXISTS idx_answerlog_user_q ON answer_log(user_id, question_id);
CREATE INDEX IF NOT EXISTS idx_answerlog_day ON answer_log(user_id, answered_at);
