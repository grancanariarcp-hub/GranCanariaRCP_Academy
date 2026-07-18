-- Galería de imágenes por curso (carrusel de la ficha). Solo la clave en R2;
-- las imágenes viven en R2 (egress gratis), no en la base de datos.
CREATE TABLE IF NOT EXISTS course_images (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id  UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  image_key  TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_course_images_course ON course_images(course_id, sort_order);
