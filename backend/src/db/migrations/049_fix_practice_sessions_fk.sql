-- Corrige un fallo que impedía practicar a los alumnos.
--
-- practice_sessions.user_id apuntaba con clave ajena a users, la tabla del
-- personal (super admin y profesorado). Los alumnos viven en students, así que
-- al terminar una tanda de práctica la inserción violaba la clave ajena y
-- devolvía un error 500: la práctica libre solo funcionaba para el personal.
--
-- Se retira la clave ajena, igual que en answer_log y challenge_attempts, que
-- ya guardaban el identificador sin referencia por este mismo motivo: sirven a
-- dos tablas de sujetos distintas y el histórico debe sobrevivir a la baja de
-- la cuenta.

ALTER TABLE practice_sessions DROP CONSTRAINT IF EXISTS practice_sessions_user_id_fkey;

COMMENT ON COLUMN practice_sessions.user_id IS
  'Sujeto de la sesión: puede ser students.id o users.id. Sin clave ajena a propósito.';
