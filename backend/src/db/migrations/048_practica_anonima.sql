-- Práctica libre sin registro: una sola ronda y después muro de registro.
--
-- Deja probar antes de pedir nada, que convierte mucho mejor que un muro por
-- delante, y de paso mide cuánta gente llega y qué perfil tiene.
--
-- RGPD: NO se guardan datos personales ni la IP en claro. Se identifica la
-- sesión por un testigo aleatorio que genera el propio navegador, y la
-- procedencia se resume en el país y el tipo de dispositivo. El testigo no
-- permite reidentificar a nadie; solo evitar que la misma sesión repita.

CREATE TABLE IF NOT EXISTS anon_practice (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Testigo aleatorio del navegador; no se deriva de datos personales.
  visitor     VARCHAR(64) NOT NULL,

  -- Características agregables del participante, sin identificarlo.
  bank_id     UUID REFERENCES question_banks(id) ON DELETE SET NULL,
  tema        VARCHAR(120),
  dispositivo VARCHAR(20),   -- movil | tablet | escritorio
  pais        VARCHAR(2),    -- código ISO que aporta la CDN, si lo hay
  origen      VARCHAR(60),   -- página desde la que llegó

  total       SMALLINT NOT NULL,
  correct     SMALLINT NOT NULL,
  seconds     INTEGER NOT NULL DEFAULT 0,

  -- Se marca si esa misma sesión acabó registrándose: es la tasa de conversión.
  converted   BOOLEAN NOT NULL DEFAULT FALSE,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_anon_practice_visitor ON anon_practice (visitor);
CREATE INDEX IF NOT EXISTS idx_anon_practice_created ON anon_practice (created_at DESC);
