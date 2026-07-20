-- El histórico de respuestas no admitía los temas de oposición.
--
-- answer_log.category nació para las categorías de RCP (questions.category, de
-- 8 caracteres). El motor de tests OPE escribe ahí el TEMA de la pregunta
-- (questions.tema, de 160), y con cualquier tema real —«Ley 41/2002 de
-- autonomía del paciente»— Postgres rechazaba la fila.
--
-- El efecto era destructivo, no solo molesto: la corrección marca primero el
-- test como enviado y después vuelca el histórico, así que el opositor recibía
-- un error, perdía la nota, y al reintentar se le respondía que ese test ya
-- estaba corregido. El examen quedaba inutilizable para siempre.

ALTER TABLE answer_log ALTER COLUMN category TYPE VARCHAR(160);
