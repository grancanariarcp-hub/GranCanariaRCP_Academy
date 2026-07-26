-- Venta cruzada con PÚLSAR: medición de referidos ENTRANTES.
--
-- La academia ya promociona a PÚLSAR con enlaces `?ref=academia`, y PÚLSAR nos
-- devolverá tráfico con `?ref=pulsar`. Esta tabla registra esas llegadas para
-- poder medir la reciprocidad, de forma simétrica a lo que PÚLSAR hace con las
-- nuestras. Es solo una capa de marketing: no toca cursos, actas ni matrículas.
--
-- No guarda nada personal: solo la fuente, la página de aterrizaje y cuándo.

CREATE TABLE IF NOT EXISTS referral_hits (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ref        VARCHAR(40) NOT NULL,          -- p.ej. "pulsar"
  path       VARCHAR(200),                  -- dónde aterrizó
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_referral_hits_ref ON referral_hits (ref, created_at);
