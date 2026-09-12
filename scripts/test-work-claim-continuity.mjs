import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runPsql } from "./lib/accelerate-database.mjs";

// Real PostgreSQL execution; every fixture and even the migration are rolled back.
const migration = readFileSync(
  new URL("../migrations/20260912153548-work-board-claim-continuity.sql", import.meta.url),
  "utf8",
);
const sql = `BEGIN;
SET LOCAL lock_timeout='10s';
${migration}
${migration}
DO $test$
DECLARE project text := 'qa-continuity-'||gen_random_uuid(); actor text := 'test:continuity';
 ids uuid[] := ARRAY[]::uuid[]; response jsonb; before_claim jsonb; target_id uuid; rev bigint; i int; rejected boolean;
BEGIN
 FOR i IN 1..7 LOOP
  response := public.mutate_work_board(actor,'create',NULL,NULL,gen_random_uuid(),gen_random_uuid()::text,
    jsonb_build_object('project_key',project,'title','Continuity fixture '||i,'description','Controlled fixture','acceptance_criteria','Protocol proof','work_kind','research','labels',jsonb_build_array('milestone:now')),
    ARRAY[project],false);
  target_id:=(response->'card'->>'id')::uuid; ids:=array_append(ids,target_id);
  response := public.mutate_work_board(actor,'claim',target_id,1,gen_random_uuid(),gen_random_uuid()::text,
    jsonb_build_object('claim_token_hash','old-token'),ARRAY[project],false);
  IF response->'card'->>'status'<>'in_progress' THEN RAISE EXCEPTION 'Claim % did not succeed',i; END IF;
 END LOOP;
 IF (SELECT count(*) FROM public.feature_requests WHERE project_key=project AND status='in_progress')<>7 THEN RAISE EXCEPTION 'Seventh claim failed'; END IF;
 target_id:=ids[1];
 SELECT revision INTO rev FROM public.feature_requests WHERE feature_requests.id=target_id;
 rejected:=false;
 BEGIN
  PERFORM public.mutate_work_board(actor,'claim',target_id,rev,gen_random_uuid(),gen_random_uuid()::text,jsonb_build_object('claim_token_hash','new-token'),ARRAY[project],false);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Live claim was stolen'; END IF;
 -- Controlled fixture only: model elapsed time without waiting thirty minutes.
 UPDATE public.feature_requests SET lease_expires_at=now()-interval '1 minute' WHERE feature_requests.id=target_id AND project_key=project;
 SELECT revision INTO rev FROM public.feature_requests WHERE feature_requests.id=target_id;
 rejected:=false;
 BEGIN
  PERFORM public.mutate_work_board(actor,'claim',target_id,rev-1,gen_random_uuid(),gen_random_uuid()::text,jsonb_build_object('claim_token_hash','new-token'),ARRAY[project],false);
 EXCEPTION WHEN SQLSTATE 'PT409' THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Stale revision resumed work'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mutate_work_board(actor,'claim',target_id,rev,gen_random_uuid(),gen_random_uuid()::text,jsonb_build_object('claim_token_hash','new-token'),ARRAY['other-project'],false);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Cross-project claim succeeded'; END IF;
 response:=public.mutate_work_board(actor,'claim',target_id,rev,gen_random_uuid(),gen_random_uuid()::text,jsonb_build_object('claim_token_hash','new-token'),ARRAY[project],false);
 IF response->'card'->>'status'<>'in_progress' THEN RAISE EXCEPTION 'Expired continuation failed'; END IF;
 SELECT payload->'before' INTO before_claim FROM public.work_board_events WHERE card_id=target_id AND revision=(response->'card'->>'revision')::bigint;
 IF before_claim->>'lease_owner' IS DISTINCT FROM actor OR before_claim ? 'claim_token_hash' THEN RAISE EXCEPTION 'Prior owner audit or token redaction lost'; END IF;
 rejected:=false;
 BEGIN
  PERFORM public.mutate_work_board(actor,'heartbeat',target_id,NULL,gen_random_uuid(),gen_random_uuid()::text,jsonb_build_object('claim_token_hash','old-token'),ARRAY[project],false);
 EXCEPTION WHEN insufficient_privilege THEN rejected:=true; END;
 IF NOT rejected THEN RAISE EXCEPTION 'Old claim token remained valid'; END IF;
 PERFORM public.mutate_work_board(actor,'heartbeat',target_id,NULL,gen_random_uuid(),gen_random_uuid()::text,jsonb_build_object('claim_token_hash','new-token'),ARRAY[project],false);
 IF has_function_privilege('anon','public.mutate_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean)','EXECUTE') OR has_function_privilege('authenticated','public.mutate_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean)','EXECUTE') THEN RAISE EXCEPTION 'Claim RPC privileges widened'; END IF;
END
$test$;
ROLLBACK;`;
const result = runPsql(["--quiet"], { input: sql });
assert.equal(result.status, 0, result.stderr);
console.log(
  "Passed: seven concurrent claims, expired continuation, live ownership, revision/project fencing, old-token rejection, audit preservation, service-only privileges, and idempotent migration (rolled back).",
);
