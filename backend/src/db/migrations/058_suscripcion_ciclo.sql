-- Ciclo de vida de la suscripción: renovación, cancelación y desistimiento.
--
-- Marco legal aplicable (España/UE, RDL 1/2007 de consumidores):
--
--  · DESISTIMIENTO: 14 días naturales desde la contratación, no 3. Es un
--    derecho legal y no se puede reducir. Si el usuario pide empezar de
--    inmediato y renuncia expresamente, se le cobra la parte consumida.
--
--  · CANCELACIÓN: debe ser tan fácil como contratar. Exigir preaviso (15 días
--    u otro) para una suscripción mensual se considera cláusula abusiva, así
--    que aquí se cancela en cualquier momento y surte efecto al final del
--    periodo ya pagado.
--
--  · SIN DEVOLUCIÓN de la parte no consumida del periodo en curso, que sí es
--    válido, siempre que se informe antes de contratar y el acceso se conserve
--    hasta el vencimiento.

-- Renovación automática. Cancelar = ponerlo a FALSE: el acceso continúa hasta
-- access_until y después no se vuelve a cobrar.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;

-- Fin del plazo de desistimiento de 14 días, calculado al contratar.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS withdrawal_until TIMESTAMPTZ;

-- Renuncia expresa a esperar los 14 días para empezar a usarlo. Sin esta
-- renuncia el servicio no debería prestarse hasta que venza el plazo; con
-- ella, el desistimiento sigue existiendo pero se descuenta lo consumido.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS immediate_start_ack BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_enrollments_renovacion
  ON enrollments (access_until) WHERE auto_renew = TRUE;
