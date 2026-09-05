-- Stable workflow request identities survive terminal states. Core proposal
-- dedupe behavior is unchanged; only explicitly plugin-originated operations
-- retain their request key forever. Historical collisions fail visibly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_queue_plugin_request
  ON public.action_queue (tenant_id, dedupe_key)
  WHERE source_context = 'plugin' AND dedupe_key IS NOT NULL;

-- Assignment uses real workspace membership, not an email hidden in notes.
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to UUID;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.tasks'::regclass AND conname = 'tasks_assigned_to_membership_fkey'
  ) THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_assigned_to_membership_fkey
      FOREIGN KEY (tenant_id, assigned_to)
      REFERENCES public.tenant_memberships (tenant_id, user_id) ON DELETE RESTRICT;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee_due
  ON public.tasks (tenant_id, assigned_to, due_date) WHERE assigned_to IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_plugin_effect
  ON public.tasks (tenant_id, dedupe_key)
  WHERE source = 'plugin' AND dedupe_key IS NOT NULL;

-- A published invoice is an immutable reviewed presentation over live billing
-- facts. Public bearer tokens are hashed for lookup and encrypted for the owner.
CREATE UNIQUE INDEX IF NOT EXISTS idx_action_queue_tenant_id_identity ON public.action_queue(tenant_id,id);
CREATE TABLE IF NOT EXISTS public.invoice_pages (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
 creation_action_id UUID NOT NULL,
 publication_action_id UUID NOT NULL,
 brand JSONB NOT NULL CHECK(jsonb_typeof(brand)='object'),
 design JSONB NOT NULL CHECK(jsonb_typeof(design)='object'),
 billing_digest TEXT NOT NULL CHECK(billing_digest ~ '^[a-f0-9]{64}$'),
 token_hash TEXT NOT NULL CHECK(token_hash ~ '^[a-f0-9]{64}$'),
 encrypted_token TEXT NOT NULL,
 expires_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id),
 UNIQUE(tenant_id,publication_action_id),
 UNIQUE(tenant_id,token_hash),
 FOREIGN KEY(tenant_id,creation_action_id) REFERENCES public.action_queue(tenant_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(tenant_id,publication_action_id) REFERENCES public.action_queue(tenant_id,id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_invoice_pages_creation ON public.invoice_pages(tenant_id,creation_action_id,created_at DESC);
ALTER TABLE public.invoice_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role full access" ON public.invoice_pages;
CREATE POLICY "Service role full access" ON public.invoice_pages FOR ALL TO service_role USING(true) WITH CHECK(true);
DROP POLICY IF EXISTS "Tenant member access" ON public.invoice_pages;
CREATE POLICY "Tenant member access" ON public.invoice_pages FOR ALL TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
 WITH CHECK(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT, INSERT, UPDATE ON public.invoice_pages TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.protect_published_invoice_page() RETURNS trigger
LANGUAGE plpgsql SET search_path=public AS $$ BEGIN
 IF (to_jsonb(NEW)-'revoked_at') IS DISTINCT FROM (to_jsonb(OLD)-'revoked_at')
   OR (OLD.revoked_at IS NOT NULL AND NEW.revoked_at IS DISTINCT FROM OLD.revoked_at) THEN
   RAISE EXCEPTION 'Published invoice pages are immutable; publish a new reviewed version';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_published_invoice_page ON public.invoice_pages;
CREATE TRIGGER protect_published_invoice_page BEFORE UPDATE ON public.invoice_pages
FOR EACH ROW EXECUTE FUNCTION public.protect_published_invoice_page();
