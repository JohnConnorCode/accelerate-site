BEGIN;
-- write_site_draft and write_site_website are SECURITY DEFINER functions
-- that already validate tenant (private.authorized_request_tenant_id()),
-- actor, and document shape internally -- the same pattern every other
-- tenant-write RPC in this codebase (apply_proposal_lifecycle,
-- reserve_radar_outreach, ...) uses, and those all grant EXECUTE to
-- authenticated. These two were mistakenly restricted to service_role
-- only, so every admin-authenticated call (the only way the app ever
-- calls them) failed with "permission denied for function
-- write_site_draft/write_site_website" -- Site Studio has never been able
-- to save a page since these were introduced.
GRANT EXECUTE ON FUNCTION public.write_site_draft(text,uuid,text,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.write_site_website(text,uuid,integer,uuid,jsonb,text) TO authenticated;
COMMIT;
