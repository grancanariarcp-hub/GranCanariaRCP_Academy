-- Asistente de creación de exámenes: preguntas con imagen o vídeo (para que se
-- respondan a partir de lo que se ve) y barajado del orden por alumno.
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS image_key TEXT;
ALTER TABLE exam_questions ADD COLUMN IF NOT EXISTS video_url TEXT;

-- Las preguntas de banco también pueden llevar imagen (ya tenían vídeo).
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_key TEXT;

-- Orden distinto para cada alumno: dificulta copiar y no cambia la dificultad.
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle BOOLEAN NOT NULL DEFAULT TRUE;
