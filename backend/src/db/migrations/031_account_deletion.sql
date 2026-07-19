-- Bajas: borrado de cuenta a petición del usuario (derecho de supresión, RGPD).
-- Se anonimiza la fila pero se conserva para no romper resultados, certificados
-- ni estadísticas históricas. deleted_at permite contar las bajas por periodo.
ALTER TABLE students ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(200);
ALTER TABLE users    ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ;
ALTER TABLE users    ADD COLUMN IF NOT EXISTS deletion_reason VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_students_deleted ON students(deleted_at);
