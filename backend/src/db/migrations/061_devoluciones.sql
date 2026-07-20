-- Devoluciones.
--
-- Hasta ahora un reembolso solo cambiaba el estado del cobro a 'reembolsado',
-- y eso dejaba dos cosas mal:
--
--  1. El alumno conservaba el acceso al curso. Se podía pagar, hacer el curso
--     entero, descargar el certificado y pedir la devolución quedándoselo todo.
--
--  2. Una devolución PARCIAL marcaba el cobro entero como reembolsado, así que
--     los totales del curso daban por perdido dinero que seguía ingresado.
--
-- Se guarda el importe devuelto para que «cobrado» sea siempre lo realmente
-- ingresado, y la fecha, que es dato contable.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS refunded_cents INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS refunded_at    TIMESTAMPTZ;

-- Los reembolsos ya registrados con el criterio anterior lo fueron por el total.
UPDATE payments SET refunded_cents = amount_cents
 WHERE status = 'reembolsado' AND refunded_cents = 0;
