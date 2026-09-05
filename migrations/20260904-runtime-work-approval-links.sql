-- Durable links let a work item wait for existing proposals instead of asking
-- the model to propose them again after each scheduler tick.
BEGIN;
ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS action_ids uuid[] NOT NULL DEFAULT '{}';
ALTER TABLE public.action_queue ADD COLUMN IF NOT EXISTS work_item_id uuid;
CREATE INDEX IF NOT EXISTS action_queue_work_item ON public.action_queue(tenant_id,work_item_id) WHERE work_item_id IS NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='public.action_queue'::regclass AND conname='action_queue_tenant_work_fk') THEN
    ALTER TABLE public.action_queue ADD CONSTRAINT action_queue_tenant_work_fk FOREIGN KEY(tenant_id,work_item_id) REFERENCES public.work_items(tenant_id,id) NOT VALID;
  END IF;
END $$;
ALTER TABLE public.action_queue VALIDATE CONSTRAINT action_queue_tenant_work_fk;
COMMIT;
