-- Preserve rows and public coworker keys while making ownership tenant-composite.
-- Validation aborts on pre-existing foreign links; it never guesses ownership.
BEGIN;
ALTER TABLE public.autonomy_hard_floors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant member access" ON public.autonomy_hard_floors;
CREATE POLICY "Tenant member access" ON public.autonomy_hard_floors FOR SELECT TO authenticated
USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));

DO $$
DECLARE child text; old_fk record;
BEGIN
  FOREACH child IN ARRAY ARRAY['agent_memory','learned_policies'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = ('public.' || child)::regclass AND conname = child || '_tenant_coworker_fk') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id, coworker_id) REFERENCES public.coworkers(tenant_id,id) NOT VALID', child, child || '_tenant_coworker_fk');
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', child, child || '_tenant_coworker_fk');
  END LOOP;
  -- Remove only the superseded id-only references after their scoped replacements validate.
  FOR old_fk IN SELECT conrelid::regclass AS relation, conname FROM pg_constraint
    WHERE confrelid = 'public.coworkers'::regclass AND contype = 'f' AND cardinality(conkey) = 1
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', old_fk.relation, old_fk.conname);
  END LOOP;
  FOR old_fk IN SELECT conname FROM pg_constraint WHERE conrelid = 'public.coworkers'::regclass
    AND contype = 'p' AND cardinality(conkey) = 1
  LOOP
    EXECUTE format('ALTER TABLE public.coworkers DROP CONSTRAINT %I', old_fk.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.coworkers'::regclass AND contype = 'p') THEN
    ALTER TABLE public.coworkers ADD CONSTRAINT coworkers_pkey PRIMARY KEY (tenant_id,id);
  END IF;
  FOREACH child IN ARRAY ARRAY['plugin_tools','plugin_triggers'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = ('public.' || child)::regclass AND conname = child || '_tenant_plugin_fk') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (tenant_id,plugin_id) REFERENCES public.plugins(tenant_id,id) NOT VALID', child, child || '_tenant_plugin_fk');
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I', child, child || '_tenant_plugin_fk');
  END LOOP;
END $$;
COMMIT;
