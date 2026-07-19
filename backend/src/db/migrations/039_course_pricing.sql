-- Precio de matrícula editable y matrícula anticipada.
--
-- Modelo: el curso tiene un precio base (price_cents, ya existente) que es el
-- de matrícula anticipada. Quien se matricula DESPUÉS de early_bird_until paga
-- ese precio recargado un late_surcharge_pct por ciento. Se guarda el recargo
-- y no el segundo importe porque es como lo razona quien fija el precio, y así
-- un cambio del precio base arrastra al recargado sin tocar dos campos.

-- Último día con precio anticipado (inclusive). NULL = sin matrícula anticipada.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS early_bird_until DATE;

-- Recargo porcentual aplicado a partir del día siguiente a esa fecha.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS late_surcharge_pct NUMERIC(5,2) NOT NULL DEFAULT 0
  CONSTRAINT chk_late_surcharge CHECK (late_surcharge_pct >= 0 AND late_surcharge_pct <= 500);

-- Importe realmente cobrado, congelado en el momento de matricular: si después
-- cambia el precio o vence el plazo, la matrícula ya hecha no se altera.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS price_paid_cents INTEGER;
