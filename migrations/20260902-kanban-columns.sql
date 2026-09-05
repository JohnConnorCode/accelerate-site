-- Unified kanban column infrastructure for Feature Board, Content Kanban, and
-- Pipeline. This migration is Phase 0 of the unified-kanban plan: it ships the
-- shared `kanban_columns` table, the generic reorder/delete RPCs, and seed
-- data that exactly mirrors today's hardcoded column lists. Nothing reads any
-- of this yet (Phase 1 ships the API routes; Phase 2+ cuts each board over).
--
-- Apply after migrations/20260830-tenant-context-authorization.sql (uses
-- private.authorized_request_tenant_id()) and migrations/20260816-revenue-os.sql
-- / migrations/20260816-feature-board.sql (extends opportunities, content_calendar,
-- feature_requests).

-- =============================================================================
-- 1. kanban_columns
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_key TEXT NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE RESTRICT,
  column_key TEXT NOT NULL,
  label TEXT NOT NULL,
  color TEXT,
  sort_order NUMERIC NOT NULL DEFAULT 1000,
  is_default BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- NULL <> NULL in Postgres, so the platform-global `features` board (tenant_id
-- IS NULL) and every tenant-scoped board each need their own partial unique
-- index rather than one composite constraint.
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_columns_global_key
  ON public.kanban_columns (board_key, column_key) WHERE tenant_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_kanban_columns_tenant_key
  ON public.kanban_columns (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_kanban_columns_board_sort
  ON public.kanban_columns (board_key, tenant_id, sort_order);

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.kanban_columns;
CREATE POLICY "Service role full access" ON public.kanban_columns
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Mirrors the tenant-member policy generated for every other operational
-- table in migrations/20260830-shared-database-tenancy.sql. Rows with
-- tenant_id IS NULL (the `features` board) can never satisfy
-- `tenant_id = private.request_tenant_id()`, so they stay invisible to
-- tenant-scoped queries with no extra guard.
DROP POLICY IF EXISTS "Tenant member access" ON public.kanban_columns;
CREATE POLICY "Tenant member access" ON public.kanban_columns
  FOR ALL TO authenticated
  USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))
  WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_columns TO authenticated;
GRANT ALL ON public.kanban_columns TO service_role;

CREATE OR REPLACE FUNCTION public.kanban_columns_touch_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS kanban_columns_touch_updated_at ON public.kanban_columns;
CREATE TRIGGER kanban_columns_touch_updated_at
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.kanban_columns_touch_updated_at();

-- =============================================================================
-- 2. sort_order on content_calendar and opportunities
-- =============================================================================

-- Added nullable first (no default) so the one-time backfill below can target
-- exactly the rows that predate this migration via `WHERE sort_order IS NULL`;
-- re-running this migration is then a no-op for rows already backfilled.
ALTER TABLE public.content_calendar ADD COLUMN IF NOT EXISTS sort_order NUMERIC;
UPDATE public.content_calendar AS item
SET sort_order = ranked.rn * 1000
FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id, status ORDER BY created_at) AS rn
  FROM public.content_calendar
) AS ranked
WHERE item.id = ranked.id AND item.sort_order IS NULL;
ALTER TABLE public.content_calendar ALTER COLUMN sort_order SET DEFAULT 1000;
ALTER TABLE public.content_calendar ALTER COLUMN sort_order SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_calendar_tenant_status_sort
  ON public.content_calendar (tenant_id, status, sort_order);

ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS sort_order NUMERIC;
UPDATE public.opportunities AS item
SET sort_order = ranked.rn * 1000
FROM (
  SELECT id, row_number() OVER (PARTITION BY tenant_id, stage ORDER BY created_at) AS rn
  FROM public.opportunities
) AS ranked
WHERE item.id = ranked.id AND item.sort_order IS NULL;
ALTER TABLE public.opportunities ALTER COLUMN sort_order SET DEFAULT 1000;
ALTER TABLE public.opportunities ALTER COLUMN sort_order SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_tenant_stage_sort
  ON public.opportunities (tenant_id, stage, sort_order);

-- =============================================================================
-- 3. Drop the literal-stage CHECK constraints. Column validation moves to the
--    app layer plus the EXISTS(kanban_columns) checks inside the RPCs below,
--    which is strictly stronger than the constraints it replaces (see the plan
--    doc for why opportunities_stage_check was already looser than the app's
--    enforced stage set).
-- =============================================================================

-- feature_requests.status: an unnamed inline CHECK in migrations/20260816-feature-board.sql
-- auto-named by Postgres. Looked up dynamically rather than hardcoding the
-- generated name, per the migration's own idempotent-lookup convention.
DO $$
DECLARE
  found_constraint TEXT;
BEGIN
  SELECT pg_constraint.conname INTO found_constraint
  FROM pg_constraint
  JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_namespace.nspname = 'public'
    AND pg_class.relname = 'feature_requests'
    AND pg_constraint.contype = 'c'
    AND pg_get_constraintdef(pg_constraint.oid) ILIKE '%status%'
  LIMIT 1;
  IF found_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.feature_requests DROP CONSTRAINT %I', found_constraint);
  END IF;
END $$;

-- content_calendar.status: same situation, unnamed inline CHECK in
-- supabase/migration-prompt2.sql.
DO $$
DECLARE
  found_constraint TEXT;
BEGIN
  SELECT pg_constraint.conname INTO found_constraint
  FROM pg_constraint
  JOIN pg_class ON pg_class.oid = pg_constraint.conrelid
  JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
  WHERE pg_namespace.nspname = 'public'
    AND pg_class.relname = 'content_calendar'
    AND pg_constraint.contype = 'c'
    AND pg_get_constraintdef(pg_constraint.oid) ILIKE '%status%'
  LIMIT 1;
  IF found_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.content_calendar DROP CONSTRAINT %I', found_constraint);
  END IF;
END $$;

-- opportunities.stage: explicitly named in migrations/20260816-revenue-os.sql.
ALTER TABLE public.opportunities DROP CONSTRAINT IF EXISTS opportunities_stage_check;

-- Replace the literal-stage partial index predicate with the role-driven
-- signal (`closed_at`) that transitionOpportunity() already sets, so a custom
-- admin-created terminal-like stage is not silently miscategorized.
DROP INDEX IF EXISTS idx_opportunities_next_action;
CREATE INDEX IF NOT EXISTS idx_opportunities_next_action
  ON public.opportunities (next_action_at)
  WHERE next_action_at IS NOT NULL AND closed_at IS NULL;

-- =============================================================================
-- 4. reorder_kanban_items / kanban_delete_column
--
-- Both are SECURITY DEFINER, matching private.authorized_request_tenant_id()
-- and every RPC in migrations/20260830-tenant-context-authorization.sql: RLS
-- does not apply inside a SECURITY DEFINER function body (it runs as the
-- function owner), so tenant scoping here is enforced explicitly by the
-- `tenant_id = requested_tenant` predicates, not by RLS.
--
-- GRANT EXECUTE goes to both `authenticated` (content/pipeline, called through
-- the tenant-bound auth.database client) and `service_role` (features, called
-- through the platform service-role client). Because that grant is broad, the
-- `features` branch explicitly requires the caller to already be the
-- service_role -- otherwise any authenticated tenant admin could call this
-- RPC directly against PostgREST and edit the platform-global feature board,
-- bypassing requirePlatformAdmin() entirely. The content/pipeline branches
-- self-gate the same way through private.authorized_request_tenant_id().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reorder_kanban_items(p_board_key TEXT, p_updates JSONB)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected INTEGER := 0;
  requested_tenant UUID;
BEGIN
  IF p_board_key IS NULL OR btrim(p_board_key) = '' THEN
    RAISE EXCEPTION 'board_key is required';
  END IF;

  IF p_board_key = 'features' THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'features board requires service-role access' USING ERRCODE = '42501';
    END IF;

    WITH requested AS (
      SELECT x.id, x.column_key, x.sort_order
      FROM jsonb_to_recordset(p_updates) AS x(id UUID, column_key TEXT, sort_order NUMERIC)
      WHERE x.column_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kanban_columns kc
        WHERE kc.board_key = 'features' AND kc.tenant_id IS NULL AND kc.column_key = x.column_key
      )
    )
    UPDATE public.feature_requests AS item
    SET status = requested.column_key, sort_order = requested.sort_order, updated_at = now()
    FROM requested
    WHERE item.id = requested.id AND item.archived_at IS NULL;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  END IF;

  requested_tenant := private.authorized_request_tenant_id();

  IF p_board_key = 'content' THEN
    WITH requested AS (
      SELECT x.id, x.column_key, x.sort_order
      FROM jsonb_to_recordset(p_updates) AS x(id UUID, column_key TEXT, sort_order NUMERIC)
      WHERE x.column_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kanban_columns kc
        WHERE kc.board_key = 'content' AND kc.tenant_id = requested_tenant AND kc.column_key = x.column_key
      )
    )
    UPDATE public.content_calendar AS item
    SET status = requested.column_key, sort_order = requested.sort_order, updated_at = now()
    FROM requested
    WHERE item.id = requested.id AND item.tenant_id = requested_tenant;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  END IF;

  IF p_board_key = 'pipeline' THEN
    WITH requested AS (
      SELECT x.id, x.column_key, x.sort_order
      FROM jsonb_to_recordset(p_updates) AS x(id UUID, column_key TEXT, sort_order NUMERIC)
      WHERE x.column_key IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.kanban_columns kc
        WHERE kc.board_key = 'pipeline' AND kc.tenant_id = requested_tenant AND kc.column_key = x.column_key
      )
    )
    UPDATE public.opportunities AS item
    SET stage = requested.column_key, sort_order = requested.sort_order, updated_at = now()
    FROM requested
    WHERE item.id = requested.id AND item.tenant_id = requested_tenant;
    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
  END IF;

  RAISE EXCEPTION 'Unknown board_key: %', p_board_key;
END;
$$;
REVOKE ALL ON FUNCTION public.reorder_kanban_items(TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_kanban_items(TEXT, JSONB) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.kanban_delete_column(
  p_board_key TEXT,
  p_column_key TEXT,
  p_reassign_to TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_tenant UUID;
  v_count INTEGER;
  v_role TEXT;
  v_remaining_role_count INTEGER;
BEGIN
  IF p_board_key IS NULL OR btrim(p_board_key) = '' THEN
    RAISE EXCEPTION 'board_key is required';
  END IF;
  IF p_column_key IS NULL OR btrim(p_column_key) = '' THEN
    RAISE EXCEPTION 'column_key is required';
  END IF;
  IF p_reassign_to IS NOT NULL AND p_reassign_to = p_column_key THEN
    RAISE EXCEPTION 'cannot_reassign_to_self';
  END IF;

  IF p_board_key = 'features' THEN
    IF auth.role() <> 'service_role' THEN
      RAISE EXCEPTION 'features board requires service-role access' USING ERRCODE = '42501';
    END IF;

    IF p_reassign_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.kanban_columns
      WHERE board_key = 'features' AND tenant_id IS NULL AND column_key = p_reassign_to
    ) THEN
      RAISE EXCEPTION 'target column does not exist: %', p_reassign_to;
    END IF;

    SELECT count(*) INTO v_count FROM public.feature_requests
    WHERE status = p_column_key AND archived_at IS NULL;
    IF v_count > 0 AND p_reassign_to IS NULL THEN
      RAISE EXCEPTION 'column_has_cards:%', v_count;
    END IF;
    IF v_count > 0 THEN
      UPDATE public.feature_requests SET status = p_reassign_to, updated_at = now()
      WHERE status = p_column_key AND archived_at IS NULL;
    END IF;
    DELETE FROM public.kanban_columns
    WHERE board_key = 'features' AND tenant_id IS NULL AND column_key = p_column_key;
    RETURN;
  END IF;

  requested_tenant := private.authorized_request_tenant_id();

  IF p_board_key = 'content' THEN
    IF p_reassign_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.kanban_columns
      WHERE board_key = 'content' AND tenant_id = requested_tenant AND column_key = p_reassign_to
    ) THEN
      RAISE EXCEPTION 'target column does not exist: %', p_reassign_to;
    END IF;

    SELECT count(*) INTO v_count FROM public.content_calendar
    WHERE tenant_id = requested_tenant AND status = p_column_key;
    IF v_count > 0 AND p_reassign_to IS NULL THEN
      RAISE EXCEPTION 'column_has_cards:%', v_count;
    END IF;
    IF v_count > 0 THEN
      UPDATE public.content_calendar SET status = p_reassign_to, updated_at = now()
      WHERE tenant_id = requested_tenant AND status = p_column_key;
    END IF;
    DELETE FROM public.kanban_columns
    WHERE board_key = 'content' AND tenant_id = requested_tenant AND column_key = p_column_key;
    RETURN;
  END IF;

  IF p_board_key = 'pipeline' THEN
    IF p_reassign_to IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.kanban_columns
      WHERE board_key = 'pipeline' AND tenant_id = requested_tenant AND column_key = p_reassign_to
    ) THEN
      RAISE EXCEPTION 'target column does not exist: %', p_reassign_to;
    END IF;

    SELECT metadata ->> 'role' INTO v_role FROM public.kanban_columns
    WHERE board_key = 'pipeline' AND tenant_id = requested_tenant AND column_key = p_column_key;

    IF v_role IN ('won', 'lost') THEN
      SELECT count(*) INTO v_remaining_role_count FROM public.kanban_columns
      WHERE board_key = 'pipeline' AND tenant_id = requested_tenant
        AND metadata ->> 'role' = v_role AND column_key <> p_column_key;
      IF v_remaining_role_count = 0 THEN
        RAISE EXCEPTION 'cannot_delete_last_role:%', v_role;
      END IF;
    END IF;

    SELECT count(*) INTO v_count FROM public.opportunities
    WHERE tenant_id = requested_tenant AND stage = p_column_key;
    IF v_count > 0 AND p_reassign_to IS NULL THEN
      RAISE EXCEPTION 'column_has_cards:%', v_count;
    END IF;
    IF v_count > 0 THEN
      UPDATE public.opportunities SET stage = p_reassign_to, updated_at = now()
      WHERE tenant_id = requested_tenant AND stage = p_column_key;
    END IF;
    DELETE FROM public.kanban_columns
    WHERE board_key = 'pipeline' AND tenant_id = requested_tenant AND column_key = p_column_key;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Unknown board_key: %', p_board_key;
END;
$$;
REVOKE ALL ON FUNCTION public.kanban_delete_column(TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kanban_delete_column(TEXT, TEXT, TEXT) TO authenticated, service_role;

-- Keep reorder_feature_requests in place until Feature Board is cut over to
-- reorder_kanban_items and verified for one deploy cycle (additive-migrations
-- convention); drop it in a follow-up migration once Phase 2 lands.

-- =============================================================================
-- 5. Seed data -- exact parity with today's hardcoded column lists.
-- =============================================================================

-- features: platform-global, tenant_id IS NULL. Source of truth:
-- FEATURE_STATUS_META in src/lib/feature-board.ts.
INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
VALUES
  (NULL, 'features', 'backlog', 'Backlog', 'bg-slate-400', 1000, true, '{}'::jsonb),
  (NULL, 'features', 'planned', 'Planned', 'bg-blue-500', 2000, true, '{}'::jsonb),
  (NULL, 'features', 'in_progress', 'In progress', 'bg-amber-500', 3000, true, '{}'::jsonb),
  (NULL, 'features', 'blocked', 'Blocked', 'bg-rose-500', 4000, true, '{}'::jsonb),
  (NULL, 'features', 'shipped', 'Shipped', 'bg-emerald-500', 5000, true, '{}'::jsonb)
ON CONFLICT (board_key, column_key) WHERE tenant_id IS NULL DO NOTHING;

-- content: tenant-scoped, one set of 5 columns per existing tenant. Source of
-- truth: the `columns` array in src/components/admin/ContentKanban.tsx (no
-- colors are defined there today, so color stays NULL).
INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'content', 'idea', 'Ideas', NULL, 1000, true, '{}'::jsonb
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'content' AND k.column_key = 'idea'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'content', 'outline', 'Outline', NULL, 2000, true, '{}'::jsonb
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'content' AND k.column_key = 'outline'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'content', 'draft', 'Draft', NULL, 3000, true, '{}'::jsonb
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'content' AND k.column_key = 'draft'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'content', 'review', 'Review', NULL, 4000, true, '{}'::jsonb
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'content' AND k.column_key = 'review'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'content', 'published', 'Published', NULL, 5000, true, '{}'::jsonb
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'content' AND k.column_key = 'published'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

-- pipeline: tenant-scoped, one set of 9 columns per existing tenant. Source of
-- truth: REVENUE_STAGES / DEFAULT_STAGE_META in src/lib/revenue-os/types.ts.
-- `metadata.role` replaces the hardcoded won/lost literal-name checks;
-- `metadata.probability` replaces DEFAULT_STAGE_META's probability table.
-- Each tenant's existing `config.pipeline.stageLabels` override (see
-- src/config/tenant.ts) is preserved as the seeded label so a
-- already-customized stage name survives the cutover unchanged.
INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'new',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,new}', ''), 'New'),
  NULL, 1000, true, jsonb_build_object('role', 'open', 'probability', 10)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'new'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'contacted',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,contacted}', ''), 'Contacted'),
  NULL, 2000, true, jsonb_build_object('role', 'open', 'probability', 20)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'contacted'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'qualified',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,qualified}', ''), 'Qualified'),
  NULL, 3000, true, jsonb_build_object('role', 'open', 'probability', 40)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'qualified'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'meeting',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,meeting}', ''), 'Meeting'),
  NULL, 4000, true, jsonb_build_object('role', 'open', 'probability', 55)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'meeting'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'proposal',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,proposal}', ''), 'Proposal'),
  NULL, 5000, true, jsonb_build_object('role', 'open', 'probability', 70)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'proposal'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'negotiation',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,negotiation}', ''), 'Negotiation'),
  NULL, 6000, true, jsonb_build_object('role', 'open', 'probability', 85)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'negotiation'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'won',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,won}', ''), 'Won'),
  NULL, 7000, true, jsonb_build_object('role', 'won', 'probability', 100)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'won'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'lost',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,lost}', ''), 'Lost'),
  NULL, 8000, true, jsonb_build_object('role', 'lost', 'probability', 0)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'lost'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

INSERT INTO public.kanban_columns (tenant_id, board_key, column_key, label, color, sort_order, is_default, metadata)
SELECT t.id, 'pipeline', 'nurture',
  COALESCE(NULLIF(t.config #>> '{pipeline,stageLabels,nurture}', ''), 'Nurture'),
  NULL, 9000, true, jsonb_build_object('role', 'open', 'probability', 10)
FROM public.tenants t
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_columns k
  WHERE k.tenant_id = t.id AND k.board_key = 'pipeline' AND k.column_key = 'nurture'
)
ON CONFLICT (tenant_id, board_key, column_key) WHERE tenant_id IS NOT NULL DO NOTHING;

COMMENT ON TABLE public.kanban_columns IS 'Admin-defined columns for every kanban board (features/content/pipeline). tenant_id IS NULL only for the platform-global features board.';
COMMENT ON FUNCTION public.reorder_kanban_items(TEXT, JSONB) IS 'One transaction per drag: writes column_key + sort_order for a board''s item table after validating each target column exists in kanban_columns.';
COMMENT ON FUNCTION public.kanban_delete_column(TEXT, TEXT, TEXT) IS 'Deletes a kanban column; blocks deletion when it still holds cards unless a reassignment target is given, and refuses to remove the last won/lost-role pipeline column.';
