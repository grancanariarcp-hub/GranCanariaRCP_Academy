-- Servicios extras: SOLO configuración (aún no se cobra nada).
--
-- Dos niveles:
--   academy_settings = valores por defecto de la academia (una sola fila). El
--     super admin los fija en su perfil; los cursos nuevos parten de aquí.
--   course_extras    = override por curso. Cada columna NULL significa «usa el
--     valor global»; al rellenarla, solo afecta a ese curso.
--
-- Importes en céntimos; los «incluidos» son los límites gratuitos que van con
-- el curso (para poder mostrarlos con claridad: qué entra gratis y qué cuesta).

CREATE TABLE IF NOT EXISTS academy_settings (
  id                       BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  coste_minimo_curso_cents INT NOT NULL DEFAULT 0,
  pct_matricula            NUMERIC(5,2) NOT NULL DEFAULT 0,
  gestion_cfc_cents        INT NOT NULL DEFAULT 0,
  memoria_incluida_mb      INT NOT NULL DEFAULT 500,
  memoria_extra_bloque_mb  INT NOT NULL DEFAULT 500,
  memoria_extra_cents      INT NOT NULL DEFAULT 0,
  ia_creditos_incluidos    INT NOT NULL DEFAULT 0,
  ia_paquete_creditos      INT NOT NULL DEFAULT 100,
  ia_paquete_cents         INT NOT NULL DEFAULT 0,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO academy_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS course_extras (
  course_id                UUID PRIMARY KEY REFERENCES courses(id) ON DELETE CASCADE,
  coste_minimo_curso_cents INT,
  pct_matricula            NUMERIC(5,2),
  gestion_cfc_cents        INT,
  memoria_incluida_mb      INT,
  memoria_extra_bloque_mb  INT,
  memoria_extra_cents      INT,
  ia_creditos_incluidos    INT,
  ia_paquete_creditos      INT,
  ia_paquete_cents         INT,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
