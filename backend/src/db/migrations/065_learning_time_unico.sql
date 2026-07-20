-- Las horas de estudio se contaban de más, para siempre.
--
-- El latido llega cada ~60 s y hacía «UPDATE, y si no actualizó nada, INSERT»,
-- sin restricción de unicidad ni bloqueo. Con dos pestañas abiertas —o con dos
-- latidos solapados— ambos UPDATE no encontraban fila y ambos insertaban: dos
-- filas del mismo alumno, curso y día. Como todas las lecturas son SUM(), el
-- error no se ve en ninguna pantalla: simplemente infla las horas en silencio.
--
-- Y son horas que se usan para justificar dedicación ante la comisión de
-- formación continuada, así que inflarlas no es un detalle estético.
--
-- course_id admite NULL (tiempo fuera de un curso: práctica, desafíos) y en
-- Postgres dos NULL no colisionan entre sí, de modo que un UNIQUE normal no
-- protegería justamente ese caso. Se indexa por expresión, que funciona igual
-- en cualquier versión.

-- 1. Fundir los duplicados que ya existen, conservando la suma real.
WITH agrupado AS (
  SELECT student_id, course_id, day,
         SUM(active_seconds)  AS act,
         SUM(session_seconds) AS ses,
         (ARRAY_AGG(id ORDER BY id))[1] AS conservar
    FROM learning_time
   GROUP BY student_id, course_id, day
  HAVING COUNT(*) > 1
)
UPDATE learning_time lt
   SET active_seconds = a.act, session_seconds = a.ses
  FROM agrupado a
 WHERE lt.id = a.conservar;

DELETE FROM learning_time lt
 USING (
   SELECT student_id, course_id, day, (ARRAY_AGG(id ORDER BY id))[1] AS conservar
     FROM learning_time GROUP BY student_id, course_id, day
 ) k
 WHERE lt.student_id = k.student_id
   AND lt.course_id IS NOT DISTINCT FROM k.course_id
   AND lt.day = k.day
   AND lt.id <> k.conservar;

-- 2. Que no vuelva a ocurrir.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learning_time_dia
  ON learning_time (student_id, COALESCE(course_id, '00000000-0000-0000-0000-000000000000'::uuid), day);
