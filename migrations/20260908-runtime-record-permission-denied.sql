-- runtime-record-permission-contract: terminal `denied` receipt for
-- permission revoked after preview or approval (denyAction).
--
-- Additive and idempotent: widens the action_queue status set without
-- touching existing rows. Apply through the founder release flow
-- (`npm run db:migrate`); denyAction requires this status on a live database.

ALTER TABLE public.action_queue DROP CONSTRAINT IF EXISTS action_queue_status_check;
DO $$ BEGIN
  ALTER TABLE public.action_queue ADD CONSTRAINT action_queue_status_check CHECK (
    status IN ('pending','approved','executing','executed','rejected','failed','expired','denied')
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
