-- Cuota de almacenamiento por autor.
--
-- Los documentos ocupan espacio real en Cloudflare R2 y lo paga la plataforma.
-- Se reserva una franja gratuita generosa por profesor y, al superarla, hay que
-- liberar espacio o ampliar. El límite se guarda por usuario para poder
-- ampliárselo a alguien concreto sin tocar el de los demás.

ALTER TABLE users ADD COLUMN IF NOT EXISTS storage_quota_mb INTEGER NOT NULL DEFAULT 500;

-- Quién subió cada documento ya se guarda en uploaded_by; hace falta poder
-- filtrar por autor con rapidez para calcular lo consumido.
CREATE INDEX IF NOT EXISTS idx_documents_uploaded_by ON documents (uploaded_by) WHERE is_active = TRUE;

-- El super admin no tiene tope: administra la plataforma.
UPDATE users SET storage_quota_mb = 1000000 WHERE role = 'super_admin';
