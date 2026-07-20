-- Ajusta dos restricciones que impedían crear el usuario auditor.
--
-- 1) admin_institution_rule enumera los roles uno a uno y no contemplaba
--    'auditor', que no pertenece a ninguna institución: es de la comisión.
-- 2) users_status_check solo admitía pending/active/rejected, de modo que
--    bloquear una cuenta sin borrarla era imposible.

ALTER TABLE users DROP CONSTRAINT IF EXISTS admin_institution_rule;
ALTER TABLE users ADD CONSTRAINT admin_institution_rule CHECK (
  (role = 'super_admin'         AND institution_id IS NULL) OR
  (role = 'profesor'            AND institution_id IS NULL) OR
  (role = 'auditor'             AND institution_id IS NULL) OR
  (role = 'institution_admin'   AND institution_id IS NOT NULL) OR
  (role = 'institution_teacher' AND institution_id IS NOT NULL)
);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check
  CHECK (status IN ('pending', 'active', 'rejected', 'blocked'));
