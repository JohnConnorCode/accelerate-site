-- Founder-authorized work continuity: volume is not an admission gate.
-- Patch only the canonical claim branch, preserving later lifecycle additions.
-- Explicit expired claims require the revision read by the caller; live claims
-- and every other readiness/capability/ownership check remain unchanged.
DO $migration$
DECLARE definition text; guard text; anchor text; replacement text;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('work-board',0));
  definition := pg_get_functiondef('public.mutate_work_board(text,text,uuid,bigint,uuid,text,jsonb,text[],boolean)'::regprocedure);
  guard := $guard$IF (SELECT count(*) FROM feature_requests WHERE status='in_progress' AND archived_at IS NULL)>=6 THEN RAISE EXCEPTION 'WIP limit reached; review stale claims first'; END IF;$guard$;
  IF position(guard IN definition)>0 THEN
    definition := replace(definition, guard, '-- Work volume never blocks an otherwise authorized claim.');
  ELSIF position('-- Work volume never blocks an otherwise authorized claim.' IN definition)=0 THEN
    RAISE EXCEPTION 'Unknown work-board admission implementation; preserve it and reconcile the migration';
  END IF;
  anchor := 'reasons:=work_board_readiness(c.id);';
  replacement := $replacement$reasons:=work_board_readiness(c.id);
   -- Explicit expired claim continuation; never selected by automatic pickup.
   IF p_id IS NOT NULL AND c.status='in_progress' AND c.lease_expires_at IS NOT NULL AND c.lease_expires_at<=now() THEN
    IF p_expected_revision IS NULL OR p_expected_revision<>c.revision THEN
     RAISE EXCEPTION 'Revision conflict; refresh expired work before resuming' USING ERRCODE='PT409';
    END IF;
    reasons:=array_remove(reasons,'status:in_progress');
   END IF;$replacement$;
  IF position('-- Explicit expired claim continuation;' IN definition)=0 THEN
    IF position(anchor IN definition)=0 OR array_length(string_to_array(definition,anchor),1)<>2 THEN
      RAISE EXCEPTION 'Unknown work-board readiness implementation; preserve it and reconcile the migration';
    END IF;
    definition:=replace(definition,anchor,replacement);
  END IF;
  EXECUTE definition;
END
$migration$;
