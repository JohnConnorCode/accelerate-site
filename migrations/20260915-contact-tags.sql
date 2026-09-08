-- Bulk contact operations: operator-curated tags on the canonical contact.
-- Tags are short lowercase slugs maintained only through the bulk domain
-- service (validated, bounded per contact). Tenancy rides on the existing
-- contacts row RLS; no new table, no new policy, no backfill.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin
  ON public.contacts USING GIN (tags);
