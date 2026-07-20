-- Fuentes dinámicas de preguntas y estadística por pregunta.
--
-- Los "bancos" de fallos propios, de fallos de la comunidad y de preguntas poco
-- contestadas NO se materializan como bancos físicos: se calculan al vuelo
-- sobre answer_log. Un banco materializado quedaría desfasado en cuanto el
-- opositor acierta una pregunta que antes fallaba, que es justo lo que pasa
-- todo el rato.
--
-- Aquí solo se añaden los índices que hacen ese cálculo viable.

-- Estadística por pregunta y persona: cuántas veces la respondió y cómo.
CREATE INDEX IF NOT EXISTS idx_answerlog_user_bank_q
  ON answer_log (user_id, bank_id, question_id);

-- Estadística global de una pregunta: cómo le va a toda la comunidad.
CREATE INDEX IF NOT EXISTS idx_answerlog_question
  ON answer_log (question_id, is_correct);

-- Recuento por banco, para saber cuándo el opositor ya ha respondido
-- matemáticamente tantas preguntas como tiene el banco.
CREATE INDEX IF NOT EXISTS idx_answerlog_bank_user
  ON answer_log (bank_id, user_id);

-- Fuente empleada al generar el test, para poder repetirlo igual.
ALTER TABLE practice_tests ADD COLUMN IF NOT EXISTS fuente VARCHAR(20) NOT NULL DEFAULT 'banco'
  CHECK (fuente IN ('banco', 'mis_fallos', 'comunidad_fallos', 'poco_vistas'));
