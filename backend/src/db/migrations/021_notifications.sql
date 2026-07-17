-- Notificaciones in-app (base para email/push más adelante). El destinatario
-- puede ser staff (users) o alumno (students): user_id + user_type sin FK.
CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL,
  user_type  VARCHAR(10) NOT NULL CHECK (user_type IN ('user','student')),
  title      VARCHAR(200) NOT NULL,
  body       TEXT,
  link       VARCHAR(300),
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at DESC);
