-- Exámenes entregados fuera de tiempo.
--
-- El límite de tiempo solo se vigilaba en el navegador, con un temporizador de
-- JavaScript. Cerrando la pestaña se mataba el temporizador y el examen podía
-- entregarse una hora después: se aceptaba y se calificaba como si nada. En
-- formación acreditada eso invalida el examen para cualquiera que lo revise.
--
-- Ahora el servidor lo comprueba, y deja constancia de por qué un intento
-- quedó a cero, para que la dirección del curso pueda distinguir a quien no
-- supo la materia de quien se le agotó el plazo y decidir si le concede otro
-- intento.

ALTER TABLE exam_attempts
  ADD COLUMN IF NOT EXISTS fuera_de_plazo BOOLEAN NOT NULL DEFAULT FALSE;
