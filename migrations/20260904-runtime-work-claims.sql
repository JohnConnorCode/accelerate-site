-- Serialize recovery and claims using the same row locks. A stale snapshot
-- cannot reset a replacement owner's lease; explicit IDs obey kind and delay.
BEGIN;
CREATE OR REPLACE FUNCTION public.claim_work_item(
  p_kind TEXT,
  p_work_item_id UUID DEFAULT NULL,
  p_lease_owner TEXT DEFAULT NULL,
  p_lease_duration_ms INTEGER DEFAULT 1800000
) RETURNS TABLE(work_item_id UUID, claimed BOOLEAN, existing_status TEXT, recovered_stale BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  t UUID;
  target public.work_items%ROWTYPE;
  stale public.work_items%ROWTYPE;
  recovered BOOLEAN := false;
BEGIN
  t := private.authorized_request_tenant_id();
  IF nullif(btrim(p_kind),'') IS NULL THEN RAISE EXCEPTION 'kind is required'; END IF;
  IF p_lease_duration_ms IS NULL OR p_lease_duration_ms < 60000 OR p_lease_duration_ms > 3600000 THEN
    RAISE EXCEPTION 'lease duration must be between 60 seconds and one hour';
  END IF;
  FOR stale IN
    SELECT w.* FROM public.work_items w
    WHERE w.tenant_id=t AND w.kind=p_kind
      AND w.status IN ('claimed','in_progress') AND w.lease_expires_at <= now()
    ORDER BY w.lease_expires_at FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE public.work_items w SET
      status=CASE WHEN stale.attempt_count >= stale.max_attempts THEN 'failed' ELSE 'pending' END,
      error='Previous work lease expired before a terminal receipt',
      finished_at=CASE WHEN stale.attempt_count >= stale.max_attempts THEN now() ELSE NULL END,
      lease_owner=NULL, lease_expires_at=NULL
    WHERE w.id=stale.id AND w.tenant_id=t;
    recovered := true;
  END LOOP;
  IF p_work_item_id IS NOT NULL THEN
    SELECT w.* INTO target FROM public.work_items w
      WHERE w.id=p_work_item_id AND w.tenant_id=t AND w.kind=p_kind
      FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN QUERY SELECT p_work_item_id,false,'unavailable'::text,recovered; RETURN;
    END IF;
    IF target.status NOT IN ('pending','waiting') OR target.next_check_at > now()
      OR target.attempt_count >= target.max_attempts THEN
      RETURN QUERY SELECT target.id,false,target.status,recovered; RETURN;
    END IF;
  ELSE
    SELECT w.* INTO target FROM public.work_items w
    WHERE w.tenant_id=t AND w.kind=p_kind AND w.status IN ('pending','waiting')
      AND (w.next_check_at IS NULL OR w.next_check_at <= now())
      AND w.attempt_count < w.max_attempts
    ORDER BY CASE w.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      w.next_check_at ASC NULLS LAST,w.created_at,w.id
    LIMIT 1 FOR UPDATE SKIP LOCKED;
    IF NOT FOUND THEN
      RETURN QUERY SELECT NULL::uuid,false,'none_available'::text,recovered; RETURN;
    END IF;
  END IF;
  UPDATE public.work_items w SET status='claimed',
    lease_owner=coalesce(nullif(btrim(p_lease_owner),''),gen_random_uuid()::text),
    lease_expires_at=now() + p_lease_duration_ms * interval '1 millisecond',
    attempt_count=w.attempt_count+1,claimed_at=now(),next_check_at=NULL,next_check_reason=NULL
    WHERE w.id=target.id AND w.tenant_id=t;
  RETURN QUERY SELECT target.id,true,'claimed'::text,recovered;
END $$;
REVOKE ALL ON FUNCTION public.claim_work_item(TEXT,UUID,TEXT,INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_work_item(TEXT,UUID,TEXT,INTEGER) TO service_role;
COMMIT;
