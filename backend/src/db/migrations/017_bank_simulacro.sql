-- Configuración de simulacro por banco (cada OPE es distinta: nº de preguntas,
-- tiempo y nota de corte los define el super_admin al crear/editar el banco).
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS sim_questions SMALLINT; -- nº de preguntas del simulacro
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS sim_minutes   SMALLINT; -- tiempo total en minutos
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS sim_pass_pct  SMALLINT; -- nota de corte (% de aciertos)
