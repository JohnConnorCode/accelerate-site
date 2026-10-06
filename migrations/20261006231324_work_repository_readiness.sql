-- Reject unusable repository addresses without rewriting cards, claims or history.
-- Shared grammar: src/lib/work-repository.mjs. Application requests never install this.
BEGIN;
CREATE OR REPLACE FUNCTION public.work_repository_url_valid(value text) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE input text; parts text[]; host text; path text; segment text; octet text;
BEGIN
 IF value IS NULL OR length(value) NOT BETWEEN 1 AND 500 OR value ~ '[^!-~]|[?#\\]' THEN RETURN false; END IF;
 input := regexp_replace(value, '^([a-zA-Z0-9._-]+)@([^/:]+):', 'ssh://\1@\2/');
 IF input ~ '%([^a-fA-F0-9]|[a-fA-F0-9]([^a-fA-F0-9]|$)|$)' THEN RETURN false; END IF;
 IF input ~* '^file://(localhost)?/[^/]' THEN
  path := regexp_replace(input, '^file://(localhost)?', '', 'i');
 ELSE
  parts := regexp_match(input, '^(https|ssh)://(?:([a-zA-Z0-9._-]+)@)?(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(?::([0-9]{1,5}))?(/.+)$', 'i');
  IF parts IS NULL OR (lower(parts[1]) = 'https' AND parts[2] IS NOT NULL) THEN RETURN false; END IF;
  host := parts[3]; path := parts[5];
  IF parts[4] IS NOT NULL AND parts[4]::integer NOT BETWEEN 1 AND 65535 THEN RETURN false; END IF;
  IF left(host, 1) = '[' THEN
   BEGIN
    IF family(substring(host FROM 2 FOR length(host)-2)::inet) <> 6 THEN RETURN false; END IF;
   EXCEPTION WHEN invalid_text_representation THEN RETURN false; END;
  ELSE
   IF host !~ '^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$' THEN RETURN false; END IF;
   segment := (regexp_split_to_array(host, '\.'))[array_length(regexp_split_to_array(host, '\.'),1)];
   IF segment ~* '^([0-9]+|0x[0-9a-f]+)$' THEN
    IF host !~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' THEN RETURN false; END IF;
    FOREACH octet IN ARRAY regexp_split_to_array(host, '\.') LOOP
     IF length(octet)>3 OR octet::integer>255 OR (length(octet)>1 AND left(octet,1)='0') THEN RETURN false; END IF;
    END LOOP;
   END IF;
  END IF;
 END IF;
 RETURN path ~ '[^/]' AND path !~* '(^|/)(\.|%2e){1,2}(/|$)';
END $$;
REVOKE ALL ON FUNCTION public.work_repository_url_valid(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.work_repository_url_valid(text) TO service_role;

CREATE OR REPLACE FUNCTION public.work_packet_problems(s jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path=public AS $$
DECLARE reasons text[] := '{}'; k text;
BEGIN
 IF s->>'packetVersion' IS DISTINCT FROM '2' THEN reasons:=array_append(reasons,'missing_packet_version'); END IF;
 IF nullif(btrim(s->>'businessValue'),'') IS NULL THEN reasons:=array_append(reasons,'missing_business_value'); END IF;
 IF nullif(btrim(s->>'currentBehavior'),'') IS NULL THEN reasons:=array_append(reasons,'missing_current_behavior'); END IF;
 IF coalesce(s->'northstar'->>'phase','') NOT IN ('A','B','C','D','E') OR jsonb_typeof(s->'northstar'->'layers') IS DISTINCT FROM 'array' OR coalesce(s->'northstar'->'layers','[]')='[]'::jsonb OR nullif(btrim(s->'northstar'->>'contribution'),'') IS NULL THEN reasons:=array_append(reasons,'missing_northstar'); END IF;
 FOREACH k IN ARRAY ARRAY['scope','exclusions','references','verification','workflow','failureModes','acceptance'] LOOP
  IF jsonb_typeof(s->k) IS DISTINCT FROM 'array' OR s->k='[]'::jsonb THEN reasons:=array_append(reasons,'missing_'||k); END IF;
 END LOOP;
 IF jsonb_typeof(s->'requiredCapabilities') IS DISTINCT FROM 'array' THEN reasons:=array_append(reasons,'missing_required_capabilities'); END IF;
 IF coalesce(s->'repository'->>'baseCommit','') !~ '^[a-f0-9]{40}$' OR nullif(btrim(s->'repository'->>'baseBranch'),'') IS NULL OR nullif(btrim(s->'repository'->>'url'),'') IS NULL THEN reasons:=array_append(reasons,'missing_repository');
 ELSIF NOT public.work_repository_url_valid(s->'repository'->>'url') THEN reasons:=array_append(reasons,'invalid_repository_url'); END IF;
 IF jsonb_typeof(s->'acceptance')='array' THEN
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(s->'acceptance') a WHERE nullif(btrim(a->>'id'),'') IS NULL OR nullif(btrim(a->>'criterion'),'') IS NULL OR coalesce(a->>'environment','') NOT IN ('local','controlled-integration','production','observation')) OR (SELECT count(*)<>count(DISTINCT a->>'id') FROM jsonb_array_elements(s->'acceptance') a) THEN reasons:=array_append(reasons,'invalid_acceptance_ids_or_environment'); END IF;
 END IF;
 IF jsonb_typeof(s->'verification')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->'verification') v WHERE nullif(btrim(v->>'command'),'') IS NULL OR nullif(btrim(v->>'expected'),'') IS NULL OR coalesce(v->>'environment','') NOT IN ('local','controlled-integration','production','observation')) THEN reasons:=array_append(reasons,'invalid_verification'); END IF;
 IF jsonb_typeof(s->'references')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->'references') r WHERE nullif(btrim(r->>'path'),'') IS NULL OR nullif(btrim(r->>'reason'),'') IS NULL) THEN reasons:=array_append(reasons,'invalid_references'); END IF;
 FOREACH k IN ARRAY ARRAY['scope','exclusions','workflow','failureModes'] LOOP
  IF jsonb_typeof(s->k)='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements(s->k) v WHERE jsonb_typeof(v)<>'string' OR nullif(btrim(v#>>'{}'),'') IS NULL) THEN reasons:=array_append(reasons,'invalid_'||k); END IF;
 END LOOP;
 IF jsonb_typeof(s->'northstar'->'layers')='array' AND EXISTS(SELECT 1 FROM jsonb_array_elements_text(s->'northstar'->'layers') l WHERE l NOT IN ('See','Remember','Notice','Act','Learn')) THEN reasons:=array_append(reasons,'invalid_northstar_layers'); END IF;
 RETURN reasons;
END $$;
REVOKE ALL ON FUNCTION public.work_packet_problems(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.work_packet_problems(jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;
