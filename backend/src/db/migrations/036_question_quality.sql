-- Calidad de las preguntas y selección aleatoria por alumno.

-- 1) El alumno, al revisar el examen, puede señalar si una pregunta le pareció
--    correcta, ambigua, mal redactada o directamente errónea.
CREATE TABLE IF NOT EXISTS question_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_question_id UUID NOT NULL REFERENCES exam_questions(id) ON DELETE CASCADE,
  student_id       UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  kind             VARCHAR(20) NOT NULL CHECK (kind IN ('ok', 'ambigua', 'mal_redactada', 'error')),
  comment          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (exam_question_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_question_reports_q ON question_reports(exam_question_id);

-- 2) Una pregunta problemática se puede anular: deja de contar para la nota de
--    TODO el grupo, sin borrarla ni perder el histórico.
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS excluded_from_grading BOOLEAN NOT NULL DEFAULT FALSE;

-- 3) Selección aleatoria por alumno: OPCIONAL, la decide el director de cada
--    test/examen. Si se activa, a cada alumno se le sirven N preguntas sacadas
--    al azar del conjunto y se guarda cuáles le tocaron, para corregir sobre
--    esas y poder revisarlas después.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS random_per_student    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS questions_per_attempt SMALLINT;
ALTER TABLE exam_attempts ADD COLUMN IF NOT EXISTS served_questions JSONB;
