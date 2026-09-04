-- Plugin Platform phase 1 of 6, primitive 1 of 7 (Records): open entity
-- registry and polymorphic link graph.
--
-- Entity types become rows rather than an enum so links, traversal, merge,
-- and audit work on a newly registered type the day it appears with no code
-- change. A meeting capability links a transcript to a contact to an
-- opportunity to a follow-up task through one table instead of four bespoke
-- join tables and their migrations.
--
-- ADDITIVE ONLY: two new tables. No existing object is altered. Every
-- statement is IF NOT EXISTS / DROP IF EXISTS guarded, so the file is safe
-- to re-run. No cascade deletes anywhere: history is not the plugin's
-- property, and every FK uses ON DELETE RESTRICT.

CREATE TABLE IF NOT EXISTS public.entity_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.accelerate_default_tenant_id()
    REFERENCES public.tenants(id) ON DELETE RESTRICT,
  type_key TEXT NOT NULL,
  label TEXT NOT NULL,
  backing_table TEXT NOT NULL,
  id_column TEXT NOT NULL DEFAULT 'id',
  -- Foreign key catalog driving generic merge: [{table, column, id_column}].
  -- Each entry names a concrete table+column holding this type's ids so a
  -- merge can reassign references without knowing the type up front.
  fk_catalog JSONB NOT NULL DEFAULT '[]',
  -- Identity fields driving record resolution for this type.
  identity_fields TEXT[] NOT NULL DEFAULT '{}',
  -- Concrete column the merge path writes when retiring a duplicate
  -- (for example 'archived_at' or 'is_disabled'). NULL means the type
  -- cannot be soft-retired and a merge involving it must refuse loudly.
  soft_delete_column TEXT,
  -- Soft-delete flag on the type row itself: disabled types stop accepting
  -- new links but keep their history readable.
  is_disabled BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, type_key)
);

CREATE TABLE IF NOT EXISTS public.entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL DEFAULT public.accelerate_default_tenant_id()
    REFERENCES public.tenants(id) ON DELETE RESTRICT,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  link_type TEXT NOT NULL DEFAULT 'relates_to',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- The tuple is the idempotency key: repeated writes are no-ops, never
  -- duplicates. Deliberately no foreign keys to concrete entity tables: a
  -- polymorphic table cannot enumerate them, so tenant scoping plus the
  -- owning service (src/lib/revenue-os/entity-registry.ts) is the boundary.
  UNIQUE (tenant_id, source_type, source_id, target_type, target_id, link_type)
);

-- Tenant ownership, matching migrations/20260830-shared-database-tenancy.sql.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.entity_types'::regclass AND conname = 'entity_types_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.entity_types
      ADD CONSTRAINT entity_types_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.entity_links'::regclass AND conname = 'entity_links_tenant_id_fkey'
  ) THEN
    ALTER TABLE public.entity_links
      ADD CONSTRAINT entity_links_tenant_id_fkey
      FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_types_tenant_id_id
  ON public.entity_types (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_links_tenant_id_id
  ON public.entity_links (tenant_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_types_tenant_key_unique
  ON public.entity_types (tenant_id, type_key);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entity_links_tuple_unique
  ON public.entity_links (tenant_id, source_type, source_id, target_type, target_id, link_type);
CREATE INDEX IF NOT EXISTS idx_entity_links_source
  ON public.entity_links (tenant_id, source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target
  ON public.entity_links (tenant_id, target_type, target_id);

ALTER TABLE public.entity_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.entity_types;
CREATE POLICY "Service role full access" ON public.entity_types
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Service role full access" ON public.entity_links;
CREATE POLICY "Service role full access" ON public.entity_links
  FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Tenant member access" ON public.entity_types;
CREATE POLICY "Tenant member access" ON public.entity_types FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
DROP POLICY IF EXISTS "Tenant member access" ON public.entity_links;
CREATE POLICY "Tenant member access" ON public.entity_links FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_types TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.entity_links TO authenticated;
GRANT ALL ON public.entity_types, public.entity_links TO service_role;

DROP TRIGGER IF EXISTS entity_types_touch_updated_at ON public.entity_types;
CREATE TRIGGER entity_types_touch_updated_at BEFORE UPDATE ON public.entity_types
  FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();
DROP TRIGGER IF EXISTS entity_links_touch_updated_at ON public.entity_links;
CREATE TRIGGER entity_links_touch_updated_at BEFORE UPDATE ON public.entity_links
  FOR EACH ROW EXECUTE FUNCTION revenue_os_touch_updated_at();
