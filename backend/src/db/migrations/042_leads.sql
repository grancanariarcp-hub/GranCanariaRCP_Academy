-- Avisos de apertura de matrícula.
--
-- Mientras el catálogo esté vacío, quien llega con intención de matricularse se
-- marcha sin dejar rastro. Aquí se recoge su correo para avisarle cuando abran
-- las matrículas, midiendo además el interés real antes de producir los cursos.
--
-- RGPD: el consentimiento es expreso y para una finalidad concreta (avisar de
-- la apertura). Se guarda la marca temporal y la versión de la política que
-- aceptó, para poder acreditarlo, y la baja se resuelve borrando la fila.

CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email           VARCHAR(200) NOT NULL,
  -- Interés declarado (tema del curso que espera), si lo indica.
  interes         VARCHAR(120),
  -- De qué página llegó: permite saber qué convierte.
  origen          VARCHAR(60) NOT NULL DEFAULT 'campus',
  privacy_version VARCHAR(20),
  consent_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Se marca al enviarle el aviso, para no duplicar envíos.
  notified_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email)
);

CREATE INDEX IF NOT EXISTS idx_leads_created ON leads (created_at DESC);
