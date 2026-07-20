-- Índices que faltaban en rutas transitadas, y uno que sobraba.
--
-- Hoy, con decenas de usuarios, nada de esto se nota. Se añade ahora porque
-- crear un índice sobre una tabla pequeña es instantáneo y sobre una tabla
-- grande bloquea; el momento de ponerlos es antes de necesitarlos.

-- Cada intento de examen se busca SIEMPRE por el par (examen, alumno): al
-- empezar, para reanudar el intento abierto, y al contar los consumidos.
-- Estaban los dos por separado, que obliga a leer uno entero y filtrar.
CREATE INDEX IF NOT EXISTS idx_attempts_exam_student ON exam_attempts (exam_id, student_id);

-- Las devoluciones llegan de Stripe identificadas por el intento de pago, y esa
-- columna no tenía índice: cada reembolso recorría la tabla de cobros entera.
CREATE INDEX IF NOT EXISTS idx_payments_intent ON payments (stripe_payment_intent_id);

-- El panel de oposiciones consulta las sesiones de práctica por banco para cada
-- banco que muestra.
CREATE INDEX IF NOT EXISTS idx_practice_sessions_bank ON practice_sessions (bank_id, user_id);

-- Claves foráneas sin índice: Postgres no los crea solos, y sin ellos borrar la
-- fila referenciada obliga a recorrer entera la tabla que la apunta.
CREATE INDEX IF NOT EXISTS idx_anon_practice_bank      ON anon_practice (bank_id);
CREATE INDEX IF NOT EXISTS idx_issued_certs_course     ON issued_certificates (course_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_student ON survey_responses (student_id);
CREATE INDEX IF NOT EXISTS idx_activities_document     ON activities (document_id);

-- Y uno de menos. answer_log es la tabla que más se escribe de la plataforma
-- —una fila por respuesta— y cada índice se paga en cada inserción.
-- idx_answerlog_user (user_id) es un prefijo exacto de idx_answerlog_user_q
-- (user_id, question_id): cualquier consulta que use el primero puede usar el
-- segundo. Mantenerlo era pagar una escritura de más por respuesta sin ganar
-- ningún plan de consulta.
DROP INDEX IF EXISTS idx_answerlog_user;
