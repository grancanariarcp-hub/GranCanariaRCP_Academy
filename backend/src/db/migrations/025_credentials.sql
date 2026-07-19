-- Credenciales: reseteo con clave de un solo uso.
-- Si must_change_password = TRUE, al entrar se obliga a definir una nueva.
ALTER TABLE users    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;
