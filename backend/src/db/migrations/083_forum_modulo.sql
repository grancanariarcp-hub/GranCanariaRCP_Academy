-- Etiqueta de módulo en los hilos del foro.
--
-- Se mantiene UN foro por curso (no uno por módulo, que dispersaría), pero cada
-- hilo puede asociarse a un módulo para organizar y filtrar. NULL = general.
ALTER TABLE forum_threads
  ADD COLUMN IF NOT EXISTS module_id UUID REFERENCES modules(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_forum_threads_module ON forum_threads(module_id);
