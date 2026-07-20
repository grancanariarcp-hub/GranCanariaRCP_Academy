-- Control de sesiones y cursos por suscripción.
--
-- Dos problemas del producto de oposiciones: se cobra por periodos y, al no
-- entregar certificado, la tentación de compartir credenciales es alta.
--
-- Contra lo segundo se limita el número de sesiones simultáneas. Es la medida
-- con mejor relación entre eficacia y molestia: quien usa móvil y ordenador no
-- se entera, mientras que un grupo compartiendo una cuenta se echa fuera
-- constantemente y acaba resultando inservible. No se bloquea a nadie ni se
-- exige verificar dispositivos: solo se cierra la sesión más antigua.

CREATE TABLE IF NOT EXISTS sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Sujeto: students.id o users.id. Sin clave ajena, como el resto de tablas
  -- que sirven a las dos.
  subject_id  UUID NOT NULL,
  subject_type VARCHAR(10) NOT NULL,

  -- Huellas para reconocer el dispositivo sin guardar datos personales en
  -- claro: solo el resumen, y una etiqueta legible para que el titular
  -- reconozca sus propias sesiones.
  ip_hash     CHAR(64),
  ua_hash     CHAR(64),
  dispositivo VARCHAR(60),

  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Motivo del cierre: el titular debe saber por qué se cerró su sesión.
  revoked_at   TIMESTAMPTZ,
  revoked_reason VARCHAR(40)
);

CREATE INDEX IF NOT EXISTS idx_sessions_subject ON sessions (subject_id, revoked_at);
CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions (last_seen_at);

-- Cursos por suscripción -----------------------------------------------------
-- El curso de oposición no se compra una vez: se paga por periodos mientras se
-- prepara. El precio existente pasa a ser el del periodo elegido.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS billing_type VARCHAR(20) NOT NULL DEFAULT 'unico'
  CHECK (billing_type IN ('unico', 'suscripcion'));

-- Precios por periodo, en céntimos. NULL = ese periodo no se ofrece.
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_mensual_cents    INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_trimestral_cents INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_semestral_cents  INTEGER;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS price_anual_cents      INTEGER;

-- Hasta cuándo tiene acceso quien está matriculado. NULL = sin caducidad, que
-- es el caso de los cursos de pago único.
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS access_until TIMESTAMPTZ;
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS periodo VARCHAR(12);

CREATE INDEX IF NOT EXISTS idx_enrollments_access ON enrollments (access_until);
