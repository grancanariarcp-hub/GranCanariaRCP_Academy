-- Usuario auditor para la comisión de formación continuada.
--
-- La comisión pide acceso a la plataforma para valorar los cursos. Necesita
-- VER todo y no poder tocar ni llevarse nada: sin descargas, sin modificar y
-- sin figurar en las actas, porque no es alumnado. Cada clic suyo queda en la
-- auditoría, que es lo que protege a ambas partes si luego hay discrepancias.
--
-- Se crean como usuarios normales con rol 'auditor'. Aunque la comisión pida
-- unas credenciales compartidas, se permite crear varios: una cuenta por
-- persona hace que la auditoría diga QUIÉN miró qué, y permite revocar a uno
-- sin dejar fuera a los demás.

-- El CHECK original solo admitía super_admin e institution_admin; se ha ido
-- ampliando con los roles nuevos, así que se recompone entero.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('super_admin', 'institution_admin', 'profesor', 'institution_teacher', 'auditor'));

-- Caducidad del acceso: el de una comisión no debería durar para siempre.
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;

-- Para qué se creó la cuenta: qué comisión, qué expediente.
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes VARCHAR(300);

CREATE INDEX IF NOT EXISTS idx_users_auditor ON users (role) WHERE role = 'auditor';
