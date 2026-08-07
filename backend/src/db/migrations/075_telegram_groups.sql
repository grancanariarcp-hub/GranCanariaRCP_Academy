-- Grupo de Telegram por curso.
--
-- Mismo modelo que el grupo de WhatsApp (migración 027): un enlace de invitación
-- que el profesor pega en la ficha, y al alumno se le ofrece unirse —voluntario
-- e informado— para recibir novedades y actividades del curso. No hay bot ni se
-- añade a nadie automáticamente: unirse por el enlace ES el consentimiento.
--
-- Se guarda por matrícula (y un respaldo por alumno) cuándo se unió o descartó,
-- para dejar de recordárselo.
ALTER TABLE courses     ADD COLUMN IF NOT EXISTS telegram_url       TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS telegram_joined_at TIMESTAMPTZ;
ALTER TABLE students    ADD COLUMN IF NOT EXISTS telegram_joined_at TIMESTAMPTZ;
