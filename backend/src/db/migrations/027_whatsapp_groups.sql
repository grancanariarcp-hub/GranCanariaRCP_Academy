-- Grupos de WhatsApp: enlace de invitación por curso (lo pone el director) y
-- uno general de la plataforma (super_admin). La adhesión es VOLUNTARIA: solo
-- guardamos si el alumno ha marcado que se unió, nunca su teléfono.
ALTER TABLE courses     ADD COLUMN IF NOT EXISTS whatsapp_url       TEXT;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS whatsapp_joined_at TIMESTAMPTZ;
ALTER TABLE students    ADD COLUMN IF NOT EXISTS whatsapp_joined_at TIMESTAMPTZ;

-- Ajustes globales de la plataforma (clave/valor).
CREATE TABLE IF NOT EXISTS platform_settings (
  key        VARCHAR(60) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
