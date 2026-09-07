BEGIN;
-- Additive lineage for proposal revisions after send.
-- A material edit on a sent/viewed proposal inserts a new draft row and marks
-- the previous row superseded; accepted rows are never mutated in place.

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS supersedes_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.proposals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_proposals_supersedes_id ON public.proposals(supersedes_id);

COMMENT ON COLUMN public.proposals.supersedes_id IS
  'Prior proposal this version replaces. Null on the original draft.';
COMMENT ON COLUMN public.proposals.superseded_by IS
  'Successor created when this sent/viewed proposal was revised.';

-- The proposal state, revision successor, event and audit commit together.
-- Pipeline follow-up continues through pipeline.ts and is replayable separately.
CREATE TABLE IF NOT EXISTS public.proposal_lifecycle_receipts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id uuid NOT NULL REFERENCES public.tenants(id),
 proposal_id uuid NOT NULL,
 operation_key text NOT NULL CHECK(operation_key ~ '^[a-f0-9]{64}$'),
 command jsonb NOT NULL, result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(tenant_id,operation_key),
 FOREIGN KEY(tenant_id,proposal_id) REFERENCES public.proposals(tenant_id,id)
);
ALTER TABLE public.proposal_lifecycle_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS proposal_lifecycle_read ON public.proposal_lifecycle_receipts;
CREATE POLICY proposal_lifecycle_read ON public.proposal_lifecycle_receipts FOR SELECT TO authenticated
 USING(tenant_id=private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id));
GRANT SELECT ON public.proposal_lifecycle_receipts TO authenticated;
GRANT SELECT,INSERT ON public.proposal_lifecycle_receipts TO service_role;
DROP TRIGGER IF EXISTS proposal_lifecycle_immutable ON public.proposal_lifecycle_receipts;
CREATE TRIGGER proposal_lifecycle_immutable BEFORE UPDATE OR DELETE ON public.proposal_lifecycle_receipts
 FOR EACH ROW EXECUTE FUNCTION private.radar_immutable();
CREATE UNIQUE INDEX IF NOT EXISTS proposal_one_successor ON public.proposals(tenant_id,supersedes_id) WHERE supersedes_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.apply_proposal_lifecycle(p_key text,p_command jsonb,p_actor_email text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE t uuid; p public.proposals; prior public.proposal_lifecycle_receipts;
 successor public.proposals; before_row jsonb; patch jsonb; op text; target text; event text;
 cfg jsonb; result jsonb; changed boolean:=true; src text;
BEGIN
 t:=private.authorized_request_tenant_id();
 IF p_key !~ '^[a-f0-9]{64}$' OR p_key IS NULL OR jsonb_typeof(p_command) IS DISTINCT FROM 'object'
 OR pg_column_size(p_command)>100000 OR nullif(btrim(p_actor_email),'') IS NULL
 THEN RAISE EXCEPTION 'Invalid proposal command'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(t::text||':proposal:'||p_key,0));
 SELECT * INTO prior FROM proposal_lifecycle_receipts WHERE tenant_id=t AND operation_key=p_key;
 IF FOUND THEN
  IF (prior.command-'expectedUpdatedAt') IS DISTINCT FROM (p_command-'expectedUpdatedAt') THEN RAISE EXCEPTION 'Proposal operation identity conflict'; END IF;
  RETURN prior.result||jsonb_build_object('replayed',true);
 END IF;
 SELECT config INTO cfg FROM tenants WHERE id=t AND status='active' FOR SHARE;
 IF cfg IS NULL OR cfg->'modules'->>'proposals'='false' THEN RAISE EXCEPTION 'Proposal workspace unavailable'; END IF;
 SELECT * INTO p FROM proposals WHERE tenant_id=t AND id=(p_command->>'id')::uuid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposal not found'; END IF;
 before_row:=to_jsonb(p);op:=p_command->>'operation';patch:=coalesce(p_command->'patch','{}'::jsonb);
 src:=coalesce(p_command->>'source','admin');
 IF op IS NULL OR op NOT IN ('send','view','accept','decline','expire','edit','revise')
 OR jsonb_typeof(patch) IS DISTINCT FROM 'object'
 OR patch-ARRAY['title','content','total_one_time','total_monthly','client_name']<>'{}'::jsonb
 THEN RAISE EXCEPTION 'Invalid proposal operation or patch'; END IF;
 IF (patch ? 'title' AND coalesce(length(btrim(patch->>'title')),0) NOT BETWEEN 1 AND 300)
 OR (patch ? 'client_name' AND coalesce(length(btrim(patch->>'client_name')),0) NOT BETWEEN 1 AND 300)
 OR (patch ? 'content' AND jsonb_typeof(patch->'content') IS DISTINCT FROM 'object')
 OR (patch ? 'total_one_time' AND (patch->>'total_one_time')::numeric NOT BETWEEN 0 AND 1000000000)
 OR (patch ? 'total_monthly' AND (patch->>'total_monthly')::numeric NOT BETWEEN 0 AND 1000000000)
 THEN RAISE EXCEPTION 'Invalid proposal fields'; END IF;
 IF op IN ('edit','revise') AND p.updated_at IS DISTINCT FROM (p_command->>'expectedUpdatedAt')::timestamptz
 THEN RAISE EXCEPTION 'Proposal changed; refresh before editing'; END IF;
 target:=CASE op WHEN 'send' THEN 'sent' WHEN 'view' THEN 'viewed' WHEN 'accept' THEN 'accepted'
 WHEN 'decline' THEN 'declined' WHEN 'expire' THEN 'expired' WHEN 'revise' THEN 'superseded' ELSE p.status END;
 IF (op='send' AND p.status IN ('sent','viewed')) OR (op='view' AND (p.viewed_at IS NOT NULL OR p.status IN ('accepted','declined','expired','superseded')))
 OR (op IN ('accept','decline') AND p.status=target) THEN changed:=false;
 ELSIF op='view' AND p.status='draft' THEN RAISE EXCEPTION 'Draft proposal is not shared';
 ELSIF op='edit' AND p.status<>'draft' THEN RAISE EXCEPTION 'Only draft proposals can be edited in place';
 ELSIF op='send' AND p.status<>'draft' THEN RAISE EXCEPTION 'Proposal cannot be sent';
 ELSIF op IN ('accept','decline','expire','revise') AND p.status NOT IN ('sent','viewed')
 THEN RAISE EXCEPTION 'Proposal is no longer open for a response or revision'; END IF;
 IF changed AND op IN ('accept','decline') AND p.expires_at<=clock_timestamp()
 THEN RAISE EXCEPTION 'Proposal expired; response refused'; END IF;
 IF op='decline' AND coalesce(length(btrim(p_command->>'reason')),0) NOT BETWEEN 1 AND 1000
 THEN RAISE EXCEPTION 'A bounded decline reason is required'; END IF;
 IF op='expire' AND (p.expires_at IS NULL OR p.expires_at>clock_timestamp()) THEN RAISE EXCEPTION 'Proposal is not due to expire'; END IF;
 IF changed AND op='revise' THEN
  INSERT INTO proposals(tenant_id,lead_id,opportunity_id,contact_id,company_id,client_name,title,content,total_one_time,total_monthly,
   share_token,status,version,supersedes_id,expires_at)
  VALUES(t,p.lead_id,p.opportunity_id,p.contact_id,p.company_id,coalesce(patch->>'client_name',p.client_name),coalesce(patch->>'title',p.title),
   coalesce(patch->'content',p.content),coalesce((patch->>'total_one_time')::numeric,p.total_one_time),coalesce((patch->>'total_monthly')::numeric,p.total_monthly),
   encode(gen_random_bytes(24),'hex'),'draft',coalesce(p.version,1)+1,p.id,p.expires_at) RETURNING * INTO successor;
 END IF;
 IF changed THEN
  UPDATE proposals SET status=target,updated_at=clock_timestamp(),
   title=CASE WHEN op='edit' THEN coalesce(patch->>'title',title) ELSE title END,
   client_name=CASE WHEN op='edit' THEN coalesce(patch->>'client_name',client_name) ELSE client_name END,
   content=CASE WHEN op='edit' THEN coalesce(patch->'content',content) ELSE content END,
   total_one_time=CASE WHEN op='edit' THEN coalesce((patch->>'total_one_time')::numeric,total_one_time) ELSE total_one_time END,
   total_monthly=CASE WHEN op='edit' THEN coalesce((patch->>'total_monthly')::numeric,total_monthly) ELSE total_monthly END,
   sent_at=CASE WHEN op='send' THEN clock_timestamp() ELSE sent_at END,
   viewed_at=CASE WHEN op='view' THEN clock_timestamp() ELSE viewed_at END,
   responded_at=CASE WHEN op IN ('accept','decline') THEN clock_timestamp() ELSE responded_at END,
   decline_reason=CASE WHEN op='decline' THEN btrim(p_command->>'reason') ELSE decline_reason END,
   superseded_by=CASE WHEN op='revise' THEN successor.id ELSE superseded_by END
  WHERE tenant_id=t AND id=p.id RETURNING * INTO p;
  event:=CASE WHEN op='edit' THEN NULL ELSE target END;
  IF event IS NOT NULL THEN INSERT INTO proposal_events(tenant_id,proposal_id,event_type,source,metadata)
   VALUES(t,p.id,event,src,jsonb_build_object('operation_key',p_key,'successor_id',successor.id)); END IF;
  INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,before_state,after_state,metadata)
  VALUES(t,p_actor_email,'proposal.'||coalesce(event,'updated'),'proposal',p.id::text,CASE WHEN src='public_link' THEN 'public' ELSE 'admin' END,
   before_row-ARRAY['share_token','content'],to_jsonb(p)-ARRAY['share_token','content'],jsonb_build_object('operation_key',p_key,'successor_id',successor.id));
  IF successor.id IS NOT NULL THEN INSERT INTO audit_log(tenant_id,actor_email,action,entity_type,entity_id,source,metadata)
   VALUES(t,p_actor_email,'proposal.created','proposal',successor.id::text,'admin',jsonb_build_object('supersedes_id',p.id,'operation_key',p_key)); END IF;
 END IF;
 result:=jsonb_build_object('proposal',to_jsonb(p),'successor',CASE WHEN successor.id IS NULL THEN NULL ELSE to_jsonb(successor) END,'changed',changed,'replayed',false);
 INSERT INTO proposal_lifecycle_receipts(tenant_id,proposal_id,operation_key,command,result) VALUES(t,p.id,p_key,p_command,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.apply_proposal_lifecycle(text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_proposal_lifecycle(text,jsonb,text) TO service_role;

COMMIT;
