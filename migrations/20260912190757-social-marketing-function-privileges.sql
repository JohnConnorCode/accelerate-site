-- Supabase installations can grant new functions to API roles through default
-- privileges. Remove explicit inherited grants as well as PUBLIC access.
REVOKE ALL ON FUNCTION public.execute_social_command(uuid,jsonb,timestamptz,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_social_publication(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_social_publication(uuid,text,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assert_social_dispatch(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.execute_social_command(uuid,jsonb,timestamptz,text,uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_social_publication(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.record_social_publication(uuid,text,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.assert_social_dispatch(uuid) TO service_role;
