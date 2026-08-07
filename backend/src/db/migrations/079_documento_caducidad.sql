-- Caducidad de un documento de referencia.
--
-- Las guías (ERC, PNRCP…) se sustituyen cada pocos años: una versión antigua
-- sigue siendo un archivo válido, pero ya no debe citarse en un curso que se
-- acredita. En vez de inventar un flujo de validación por revisor, registramos
-- una fecha de caducidad opcional: el documento está «vigente» hasta ella y
-- «caducado» después. Si no se indica, se considera vigente sin fecha.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS valid_until DATE;
