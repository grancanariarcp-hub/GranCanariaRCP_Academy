-- Los reconocimientos pasan a llamarse DIPLOMAS y cambian de tono.
--
-- Se evita la palabra "certificado", reservada a la formación acreditada, y el
-- texto pasa a ser un agradecimiento: es lo que la gente comparte en redes.
-- Además, el diploma de desafío lo recibe TODO el que participe, no solo el
-- podio: el ganador ya tiene la gloria del ranking; el diploma compartible es
-- lo que atrae usuarios nuevos.

UPDATE recognition_templates
   SET title         = 'Diploma de participación en el desafío',
       body_template = 'por PARTICIPAR en el desafío «{desafio}» y contribuir a que nuestra sociedad esté realmente cardioprotegida.',
       frase         = NULL,
       max_position  = NULL
 WHERE kind = 'desafio'
   -- Solo si conserva el texto original: si ya se personalizó, no se toca.
   AND body_template LIKE 'Particip%';

UPDATE recognition_templates
   SET title         = 'Diploma de reconocimiento por ' || TRIM(TRAILING '.0' FROM threshold_hours::text) || ' horas',
       body_template = 'por DEDICAR {horas} horas a formarse en reanimación y primeros auxilios, y contribuir a que nuestra sociedad esté realmente cardioprotegida.',
       frase         = NULL
 WHERE kind = 'horas'
   AND body_template LIKE 'Ha dedicado%';
