-- Nuevos tipos de pregunta de examen: escala (Likert 1-5, no puntúa) y
-- emparejar (dos columnas que se relacionan, puntúa por parejas acertadas).
-- El CHECK original de 006 era en línea (auto-nombrado exam_questions_format_check).
ALTER TABLE exam_questions DROP CONSTRAINT IF EXISTS exam_questions_format_check;
ALTER TABLE exam_questions ADD CONSTRAINT exam_questions_format_check
  CHECK (format IN ('test', 'vf', 'abierta', 'escala', 'emparejar'));
