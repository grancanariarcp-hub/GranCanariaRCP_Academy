-- El código de vinculación debía no llevar caracteres ambiguos (ni 0/O ni 1/I/L)
-- para poder dictarlo sin error, pero el DEFAULT anterior solo remapeaba las
-- letras a–f del hexadecimal y dejaba pasar los dígitos 0 y 1. Se rehace el
-- DEFAULT mapeando los 16 símbolos del hex a un alfabeto sin ambigüedades.
--
-- Los códigos ya emitidos no se tocan (podrían estar ya en un papel o en PÚLSAR);
-- esto solo afecta a los cursos que se creen a partir de ahora.

ALTER TABLE courses
  ALTER COLUMN codigo_vinculacion SET DEFAULT
    'RCP-' || TRANSLATE(
      SUBSTRING(MD5(RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 6),
      '0123456789abcdef', 'GHJKMNPQRSTVWXYZ');
