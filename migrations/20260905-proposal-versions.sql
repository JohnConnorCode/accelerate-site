-- Additive lineage for proposal revisions after send.
-- A material edit on a sent/viewed proposal inserts a new draft row and marks
-- the previous row superseded; accepted rows are never mutated in place.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_supersedes_id ON public.proposals(supersedes_id);

COMMENT ON COLUMN public.proposals.supersedes_id IS
  'Prior proposal this version replaces. Null on the original draft.';
COMMENT ON COLUMN public.proposals.superseded_by IS
  'Successor created when this sent/viewed proposal was revised.';
