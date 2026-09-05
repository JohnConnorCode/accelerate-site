-- Checklists on Feature Board cards. Completion is live-managed (seed:features
-- does not overwrite this column) so toggling a subtask on a managed card
-- survives the next manifest reconcile.

ALTER TABLE public.feature_requests
  ADD COLUMN IF NOT EXISTS subtasks JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.feature_requests
  DROP CONSTRAINT IF EXISTS feature_requests_subtasks_is_array;

ALTER TABLE public.feature_requests
  ADD CONSTRAINT feature_requests_subtasks_is_array
  CHECK (jsonb_typeof(subtasks) = 'array');

COMMENT ON COLUMN public.feature_requests.subtasks IS
  'Ordered checklist on the card. Each item is {id, title, done}. Empty means hydrate from acceptance_criteria in the app.';
