-- Foro por curso: hilos (threads) y respuestas (posts).
-- El autor puede ser staff (users) o alumno (students): guardamos author_id +
-- author_type + author_name (snapshot) sin FK estricta, igual que audit_logs.
CREATE TABLE IF NOT EXISTS forum_threads (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL,
  author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('user','student')),
  author_name VARCHAR(160) NOT NULL,
  title       VARCHAR(200) NOT NULL,
  closed      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW() -- última actividad (para ordenar)
);

CREATE TABLE IF NOT EXISTS forum_posts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id   UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id   UUID NOT NULL,
  author_type VARCHAR(10) NOT NULL CHECK (author_type IN ('user','student')),
  author_name VARCHAR(160) NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_course ON forum_threads(course_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id, created_at);
