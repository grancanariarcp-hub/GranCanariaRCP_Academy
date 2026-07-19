-- Corrige los títulos de los diplomas por horas.
--
-- La migración anterior usaba TRIM(TRAILING '.0' FROM ...), que no elimina el
-- sufijo ".0" sino CUALQUIER carácter final que sea '.' o '0': "10.0" quedaba
-- en "1" y "50.0" en "5". Se recompone con una conversión numérica limpia.

UPDATE recognition_templates
   SET title = 'Diploma de reconocimiento por ' || TRUNC(threshold_hours)::bigint::text || ' horas'
 WHERE kind = 'horas'
   AND threshold_hours IS NOT NULL
   AND title LIKE 'Diploma de reconocimiento por %';
