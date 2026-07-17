-- Reference documents (ERC 2025 guides, PNRCP manuals, ...).
-- The PDF itself lives in Cloudflare R2; here we only keep light metadata.
CREATE TABLE IF NOT EXISTS documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         VARCHAR(200) NOT NULL,
  kind          VARCHAR(16) NOT NULL DEFAULT 'otro' CHECK (kind IN ('erc', 'pnrcp', 'otro')),
  storage_key   TEXT,                 -- R2 object key (null = metadata only, file not uploaded yet)
  content_type  VARCHAR(80),
  size_bytes    BIGINT,
  pages         INT,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  uploaded_by   UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A question can point to a specific document + page as its minimum feedback.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ref_document_id UUID REFERENCES documents(id) ON DELETE SET NULL;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS ref_page INT;

CREATE INDEX IF NOT EXISTS idx_questions_ref_document ON questions(ref_document_id);
