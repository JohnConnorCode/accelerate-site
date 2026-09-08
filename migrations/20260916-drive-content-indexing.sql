-- drive-content-indexing: searchable text, explicit states, and duplicate
-- detection for approved Google Drive documents.
--
-- ADDITIVE ONLY. The existing drive_documents table already carries
-- extracted_text/content_hash columns; this adds an explicit indexed_status
-- lifecycle, a duplicate-source reference, and a hash index used to detect
-- identical content across distinct files without erasing provenance.
-- Existing rows are untouched (new columns are nullable).

ALTER TABLE public.drive_documents
  ADD COLUMN IF NOT EXISTS indexed_status TEXT;

ALTER TABLE public.drive_documents
  ADD COLUMN IF NOT EXISTS content_duplicate_of TEXT;

CREATE INDEX IF NOT EXISTS idx_drive_documents_content_hash
  ON public.drive_documents (tenant_id, content_hash)
  WHERE content_hash IS NOT NULL;

ALTER TABLE public.drive_documents
  ADD COLUMN IF NOT EXISTS provider_revision TEXT;
