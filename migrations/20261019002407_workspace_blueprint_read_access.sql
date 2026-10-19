-- Admin adapters use the signed-in tenant client. Reads must work on that
-- client; draft/version/generation writes remain service-owned commands.
REVOKE ALL ON public.workspace_blueprints, public.workspace_blueprint_versions,
  public.workspace_generated_operations FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.workspace_blueprints, public.workspace_blueprint_versions,
  public.workspace_generated_operations TO authenticated;

DROP POLICY IF EXISTS "Blueprint workspace read" ON public.workspace_blueprints;
CREATE POLICY "Blueprint workspace read" ON public.workspace_blueprints
  FOR SELECT TO authenticated
  USING (tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id));

DROP POLICY IF EXISTS "Blueprint workspace read" ON public.workspace_blueprint_versions;
CREATE POLICY "Blueprint workspace read" ON public.workspace_blueprint_versions
  FOR SELECT TO authenticated
  USING (tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id));

DROP POLICY IF EXISTS "Blueprint workspace read" ON public.workspace_generated_operations;
CREATE POLICY "Blueprint workspace read" ON public.workspace_generated_operations
  FOR SELECT TO authenticated
  USING (tenant_id = private.request_tenant_id()
    AND private.has_active_tenant_membership(tenant_id));
