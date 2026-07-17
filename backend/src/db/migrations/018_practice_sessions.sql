-- Historial de sesiones de práctica/simulacro: permite graficar HORAS reales
-- (suma de segundos por día) y guardar el historial de tandas y simulacros.
CREATE TABLE IF NOT EXISTS practice_sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bank_id       UUID REFERENCES question_banks(id) ON DELETE SET NULL,
  total         SMALLINT NOT NULL,           -- nº de preguntas de la tanda
  correct       SMALLINT NOT NULL,           -- aciertos
  seconds       INTEGER  NOT NULL DEFAULT 0, -- duración en segundos
  is_simulacro  BOOLEAN  NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id, created_at);
