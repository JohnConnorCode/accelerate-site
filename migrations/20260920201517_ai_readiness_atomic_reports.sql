BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS ai_readiness_tenant_session
  ON public.ai_readiness_assessments(tenant_id, session_token);
REVOKE ALL ON public.ai_readiness_assessments, public.ai_readiness_reports FROM anon, authenticated;
GRANT SELECT ON public.ai_readiness_assessments, public.ai_readiness_reports TO authenticated;

-- The report is the immutable completion receipt. A retry returns the same
-- token, recipient and report, including after an uncertain network response.
CREATE OR REPLACE FUNCTION public.complete_ai_readiness_report(
  p_tenant_id uuid, p_session_token text, p_report_token text,
  p_assessment jsonb, p_report jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE a public.ai_readiness_assessments; saved_report jsonb;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM public.tenants WHERE id=p_tenant_id AND status='active') THEN
    RAISE EXCEPTION 'Active tenant required';
  END IF;
  IF p_session_token IS NULL OR p_session_token !~ '^[A-Za-z0-9_-]{32,96}$'
    OR p_report_token IS NULL OR p_report_token !~ '^[A-Za-z0-9_-]{32,96}$'
    OR p_assessment->>'consent_given' IS DISTINCT FROM 'true' THEN
    RAISE EXCEPTION 'Valid tokens and report consent required';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(p_tenant_id::text || ':' || p_session_token,0));
  SELECT * INTO a FROM public.ai_readiness_assessments
    WHERE tenant_id=p_tenant_id AND session_token=p_session_token FOR UPDATE;
  IF a.id IS NOT NULL AND a.report_token IS NOT NULL THEN
    SELECT report INTO saved_report FROM public.ai_readiness_reports
      WHERE tenant_id=p_tenant_id AND assessment_id=a.id ORDER BY revision DESC LIMIT 1;
    IF saved_report IS NOT NULL THEN
      RETURN jsonb_build_object('assessmentId',a.id,'reportToken',a.report_token,
        'report',saved_report,'email',a.email,'name',a.name,'businessName',a.business_name,'replayed',true);
    END IF;
  END IF;
  INSERT INTO public.ai_readiness_assessments(
    tenant_id,session_token,report_token,version,status,answers,profile,score,coverage,
    dimension_scores,name,email,business_name,consent_given,marketing_consent,
    utm_source,utm_medium,utm_campaign,referrer_host,unlocked_at)
  VALUES(p_tenant_id,p_session_token,coalesce(a.report_token,p_report_token),p_assessment->>'version',
    'unlocked',p_assessment->'answers',p_assessment->'profile',(p_report->>'score')::int,
    (p_report->>'coverage')::int,p_report->'dimensionScores',p_assessment->>'name',
    p_assessment->>'email',p_assessment->>'business_name',true,
    coalesce((p_assessment->>'marketing_consent')::boolean,false),
    p_assessment->>'utm_source',p_assessment->>'utm_medium',p_assessment->>'utm_campaign',
    p_assessment->>'referrer_host',clock_timestamp())
  ON CONFLICT(tenant_id,session_token) DO UPDATE SET
    report_token=EXCLUDED.report_token,version=EXCLUDED.version,status=EXCLUDED.status,
    answers=EXCLUDED.answers,profile=EXCLUDED.profile,score=EXCLUDED.score,coverage=EXCLUDED.coverage,
    dimension_scores=EXCLUDED.dimension_scores,name=EXCLUDED.name,email=EXCLUDED.email,
    business_name=EXCLUDED.business_name,consent_given=true,marketing_consent=EXCLUDED.marketing_consent,
    unlocked_at=EXCLUDED.unlocked_at,updated_at=clock_timestamp()
  RETURNING * INTO a;
  INSERT INTO public.ai_readiness_reports(tenant_id,assessment_id,revision,report,ai_status)
    VALUES(p_tenant_id,a.id,1,p_report,p_report->>'aiStatus');
  RETURN jsonb_build_object('assessmentId',a.id,'reportToken',a.report_token,
    'report',p_report,'email',a.email,'name',a.name,'businessName',a.business_name,'replayed',false);
END $$;
REVOKE ALL ON FUNCTION public.complete_ai_readiness_report(uuid,text,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_ai_readiness_report(uuid,text,text,jsonb,jsonb) TO service_role;
COMMIT;
