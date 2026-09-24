-- Existing installations may retain an explicit authenticated grant even
-- after REVOKE FROM PUBLIC. Proposal transitions use the verified host bridge.
REVOKE EXECUTE ON FUNCTION public.apply_proposal_lifecycle(text,jsonb,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_proposal_lifecycle(text,jsonb,text)
  TO service_role;
