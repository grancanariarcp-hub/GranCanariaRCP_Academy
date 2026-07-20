-- Número de orden automático para las preguntas nuevas.
--
-- Se resuelve con un disparador y no en los controladores porque las preguntas
-- entran por varias vías (alta manual, importación masiva, importación en el
-- banco, alta con imagen) y bastaría olvidarse de una para que el criterio
-- "de la 1 a la 50" dejara huecos.

CREATE OR REPLACE FUNCTION asignar_orden_pregunta() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.orden IS NULL AND NEW.bank_id IS NOT NULL THEN
    SELECT COALESCE(MAX(orden), 0) + 1 INTO NEW.orden
      FROM questions WHERE bank_id = NEW.bank_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orden_pregunta ON questions;
CREATE TRIGGER trg_orden_pregunta
  BEFORE INSERT ON questions
  FOR EACH ROW EXECUTE FUNCTION asignar_orden_pregunta();
