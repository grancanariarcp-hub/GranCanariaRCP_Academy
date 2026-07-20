-- Los desafíos no recordaban qué preguntas habían servido.
--
-- La corrección se hacía sobre los identificadores que enviaba el navegador y
-- el total era «cuántos me has mandado», así que respondiendo solo a las tres
-- de las que uno estaba seguro se obtenía un 3/3 = 100 %. De esos rankings
-- —públicos, y de institución— salen diplomas, así que la clasificación era
-- manipulable desde la consola del navegador.
--
-- El motor de exámenes ya resolvió esto guardando las preguntas servidas en el
-- intento; aquí se aplica lo mismo.

ALTER TABLE challenge_attempts
  ADD COLUMN IF NOT EXISTS served_questions JSONB;
