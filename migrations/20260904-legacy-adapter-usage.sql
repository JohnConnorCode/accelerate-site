-- Legacy adapter usage ledger (identity-review workbench family: legacy-api-adapters).
--
-- Which compatibility routes still serve legacy-shaped reads, how often, and
-- how many rows they link. Retirement decisions read this ledger; nothing
-- here changes read behavior.
--
-- Additive and idempotent. Do NOT add this table to the required
-- schema-contract until the migration has been applied: readers degrade to
-- telemetryReady:false while it is absent.

CREATE TABLE IF NOT EXISTS public.legacy_adapter_usage (
  route TEXT PRIMARY KEY,
  calls BIGINT NOT NULL DEFAULT 0,
  total_rows BIGINT NOT NULL DEFAULT 0,
  linked_rows BIGINT NOT NULL DEFAULT 0,
  first_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.legacy_adapter_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access" ON public.legacy_adapter_usage;
CREATE POLICY "Service role full access" ON public.legacy_adapter_usage
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated full access" ON public.legacy_adapter_usage;
CREATE POLICY "Authenticated full access" ON public.legacy_adapter_usage
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
