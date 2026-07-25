-- El código de vinculación se rellenó para los cursos existentes, pero los que
-- se creen a partir de ahora también lo necesitan. En vez de generarlo en el
-- controlador —donde un segundo camino de creación podría olvidarlo—, se pone un
-- DEFAULT en la propia columna: así ninguna inserción puede quedarse sin código.
--
-- md5(random()::text || clock_timestamp()::text) da un valor distinto por fila
-- aunque se inserten muchas en la misma transacción; se recorta a 6 símbolos del
-- alfabeto sin caracteres ambiguos, igual que el relleno inicial.

ALTER TABLE courses
  ALTER COLUMN codigo_vinculacion SET DEFAULT
    'RCP-' || UPPER(TRANSLATE(
      SUBSTRING(MD5(RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 6),
      'abcdef', 'GHJKMN'));
