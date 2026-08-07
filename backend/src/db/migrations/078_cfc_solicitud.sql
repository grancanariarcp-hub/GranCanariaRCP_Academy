-- Solicitud de CFC y bloqueo de campos acreditables.
--
-- Al REGISTRAR la solicitud de CFC (una sola acción del director), los campos
-- que se acreditan quedan congelados: título, horas lectivas, temario,
-- profesorado y fechas de la edición. Todo lo demás sigue editable. A partir de
-- ese momento, cada cambio en lo NO bloqueado se registra —qué campo, valor
-- anterior, valor nuevo, quién y cuándo—, que es lo que permite demostrar ante
-- la comisión que lo impartido coincide con lo acreditado. El candado por sí
-- solo no lo demuestra; el registro sí.

ALTER TABLE courses
  ADD COLUMN IF NOT EXISTS cfc_solicitado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cfc_solicitado_by UUID REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS course_field_changes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  campo       VARCHAR(60) NOT NULL,
  valor_antes TEXT,
  valor_nuevo TEXT,
  changed_by  UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_field_changes ON course_field_changes (course_id, changed_at DESC);
