-- Cobro de matrículas con Stripe.
--
-- La actividad se factura como enseñanza EXENTA de impuesto indirecto, así que
-- no se repercute IGIC ni IVA: se guarda el importe tal cual se cobra y la
-- referencia legal, para que el justificante lo indique y quede constancia del
-- criterio aplicado en cada cobro (si el criterio cambia, los cobros antiguos
-- conservan el suyo).

CREATE TABLE IF NOT EXISTS payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id  UUID NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id      UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,

  amount_cents   INTEGER NOT NULL,
  currency       VARCHAR(3) NOT NULL DEFAULT 'eur',
  -- Criterio fiscal aplicado en el momento del cobro.
  tax_regime     VARCHAR(30) NOT NULL DEFAULT 'exento_ensenanza',
  tax_note       TEXT,

  status         VARCHAR(20) NOT NULL DEFAULT 'pendiente'
                   CHECK (status IN ('pendiente', 'pagado', 'fallido', 'reembolsado', 'cancelado')),

  -- Referencias de Stripe. La sesión es única: evita duplicar el cobro si el
  -- webhook llega más de una vez, que es lo normal en Stripe.
  stripe_session_id        VARCHAR(255) UNIQUE,
  stripe_payment_intent_id VARCHAR(255),
  livemode                 BOOLEAN NOT NULL DEFAULT FALSE,

  -- Número correlativo del justificante, asignado al confirmarse el pago.
  receipt_number VARCHAR(30) UNIQUE,

  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_enrollment ON payments (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_payments_course     ON payments (course_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_student    ON payments (student_id);

-- Contador de justificantes por año natural.
CREATE TABLE IF NOT EXISTS receipt_counters (
  year    SMALLINT PRIMARY KEY,
  last_no INTEGER NOT NULL DEFAULT 0
);
