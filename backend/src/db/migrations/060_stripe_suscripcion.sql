-- Referencia a la suscripción de Stripe.
--
-- Hoy el cobro es un pago único por periodo, así que NADA se renueva solo. Al
-- activar las suscripciones de Stripe, cada matrícula guardará aquí su
-- identificador para que cancelar en la plataforma cancele también el cobro
-- recurrente: sin esto, el botón de cancelar solo apagaría una marca interna y
-- el cliente seguiría siendo cobrado, que es la peor reclamación posible.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_enrollments_stripe_sub
  ON enrollments (stripe_subscription_id) WHERE stripe_subscription_id IS NOT NULL;
