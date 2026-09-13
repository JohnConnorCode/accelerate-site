-- Customer billing is served through tenant-bound server routes. Do not expose
-- provider IDs, operation receipts, or another customer's subscription rows to
-- a browser Supabase session. Service-role routes remain the only data path.
REVOKE ALL ON public.billing_plans,
  public.billing_customers,
  public.billing_subscriptions,
  public.billing_operations,
  public.billing_webhook_events
  FROM anon, authenticated;

GRANT ALL ON public.billing_plans,
  public.billing_customers,
  public.billing_subscriptions,
  public.billing_operations,
  public.billing_webhook_events
  TO service_role;
