-- Tipo de pregunta «multiple»: el alumno marca TODAS las opciones que quiera
-- (selección múltiple / casillas). Puede puntuar (si se marcan correctas) o ser
-- una encuesta/autoinforme (si no se marca ninguna como correcta).
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_format_check;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_format_check
  CHECK (format IN ('test', 'vf', 'abierta', 'escala', 'emparejar', 'multiple'));
