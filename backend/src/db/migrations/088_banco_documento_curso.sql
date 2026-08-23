-- Vincular (opcionalmente) un banco de preguntas y un documento a un curso.
-- Objetivo: poder filtrar «mis bancos» / «mis documentos» por curso y reducir el
-- ruido al seleccionar, sin obligar a que todo pertenezca a un curso.
ALTER TABLE question_banks ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_banks_course ON question_banks(course_id) WHERE course_id IS NOT NULL;

ALTER TABLE documents ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES courses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_course ON documents(course_id) WHERE course_id IS NOT NULL;
