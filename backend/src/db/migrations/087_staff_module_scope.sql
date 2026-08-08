-- Alcance por módulo de un instructor dentro de un curso.
--
-- Sin filas para (curso, usuario) = acceso a TODO el curso (puede tocar todos
-- los módulos y crear módulos). Con filas = solo puede editar las actividades de
-- esos módulos concretos y no crear módulos nuevos. El director y el super admin
-- no tienen límite.
CREATE TABLE IF NOT EXISTS staff_module_scope (
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  module_id UUID NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  PRIMARY KEY (course_id, user_id, module_id)
);
CREATE INDEX IF NOT EXISTS idx_staff_scope_user ON staff_module_scope(course_id, user_id);
