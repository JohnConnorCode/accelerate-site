BEGIN;
-- Deploy the explicit verified Site Studio actor bridge before applying this
-- correction to an existing installation. Preserve the earlier applied grant
-- migration unchanged so its recorded checksum remains valid.
REVOKE ALL ON FUNCTION public.write_site_draft(text,uuid,text,jsonb,text) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.write_site_website(text,uuid,integer,uuid,jsonb,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.write_site_draft(text,uuid,text,jsonb,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.write_site_website(text,uuid,integer,uuid,jsonb,text) TO service_role;
COMMIT;
