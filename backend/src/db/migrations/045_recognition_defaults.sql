-- Plantillas de reconocimiento por defecto, listas para usar.
--
-- Se crean solo si no existe ninguna: si el super admin ya las configuró a su
-- gusto, esta migración no toca nada. Los textos son editables desde el panel.

INSERT INTO recognition_templates
  (kind, title, body_template, frase, certifica, max_position, threshold_hours)
SELECT * FROM (VALUES
  (
    'desafio',
    'Reconocimiento por desafío',
    'Participó en el desafío «{desafio}» y obtuvo el {puesto} lugar.',
    'Gracias por contribuir a que nuestra sociedad cada día esté más cardioprotegida.',
    'Gran Canaria RCP',
    3::smallint,
    NULL::numeric
  ),
  (
    'horas',
    'Reconocimiento por 10 horas de práctica',
    'Ha dedicado {horas} horas a entrenar sus conocimientos en reanimación cardiopulmonar y primeros auxilios.',
    'Gracias por contribuir a que nuestra sociedad cada día esté más cardioprotegida.',
    'Gran Canaria RCP',
    NULL::smallint,
    10::numeric
  ),
  (
    'horas',
    'Reconocimiento por 25 horas de práctica',
    'Ha dedicado {horas} horas a entrenar sus conocimientos en reanimación cardiopulmonar y primeros auxilios.',
    'Gracias por contribuir a que nuestra sociedad cada día esté más cardioprotegida.',
    'Gran Canaria RCP',
    NULL::smallint,
    25::numeric
  ),
  (
    'horas',
    'Reconocimiento por 50 horas de práctica',
    'Ha dedicado {horas} horas a entrenar sus conocimientos en reanimación cardiopulmonar y primeros auxilios.',
    'Gracias por contribuir a que nuestra sociedad cada día esté más cardioprotegida.',
    'Gran Canaria RCP',
    NULL::smallint,
    50::numeric
  )
) AS v(kind, title, body_template, frase, certifica, max_position, threshold_hours)
WHERE NOT EXISTS (SELECT 1 FROM recognition_templates);
