-- Tenant-scoped recurring plans, customer identities, provider subscriptions,
-- and idempotent operation receipts. Stripe remains provider authority.
CREATE TABLE IF NOT EXISTS public.billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (length(description) <= 500),
  currency text NOT NULL CHECK (currency IN ('usd','eur','gbp','cad','aud')),
  interval text NOT NULL CHECK (interval IN ('month','year')),
  amount integer NOT NULL CHECK (amount > 0 AND amount <= 100000000),
  stripe_product_id text NOT NULL,
  stripe_price_id text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, stripe_product_id),
  UNIQUE (tenant_id, stripe_price_id)
);

CREATE INDEX IF NOT EXISTS billing_plans_active_idx
  ON public.billing_plans (tenant_id, active, created_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  email text NOT NULL CHECK (length(email) <= 254),
  name text NOT NULL DEFAULT '' CHECK (length(name) <= 160),
  stripe_customer_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, user_id),
  UNIQUE (tenant_id, stripe_customer_id)
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  plan_id uuid,
  stripe_subscription_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  stripe_price_id text NOT NULL,
  status text NOT NULL CHECK (status IN ('incomplete','incomplete_expired','trialing','active','past_due','canceled','unpaid','paused')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  pending_plan_id uuid,
  pending_change_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, id),
  UNIQUE (tenant_id, stripe_subscription_id),
  FOREIGN KEY (tenant_id, plan_id) REFERENCES public.billing_plans(tenant_id, id) ON DELETE SET NULL,
  FOREIGN KEY (tenant_id, pending_plan_id) REFERENCES public.billing_plans(tenant_id, id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS billing_subscriptions_customer_idx
  ON public.billing_subscriptions (tenant_id, user_id, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.billing_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  request_id uuid NOT NULL,
  operation text NOT NULL CHECK (operation IN ('create_plan','archive_plan','checkout','cancel','resume','change_plan')),
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL CHECK (status IN ('pending','succeeded','failed')),
  provider_id text,
  result jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, request_id)
);

CREATE TABLE IF NOT EXISTS public.billing_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE RESTRICT,
  event_id text NOT NULL,
  event_type text NOT NULL,
  status text NOT NULL CHECK (status IN ('processing','processed','failed')),
  error text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  UNIQUE (tenant_id, event_id)
);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['billing_plans','billing_customers','billing_subscriptions','billing_operations','billing_webhook_events'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Tenant member billing access" ON public.%I', table_name);
    EXECUTE format('CREATE POLICY "Tenant member billing access" ON public.%I FOR ALL TO authenticated USING (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id)) WITH CHECK (tenant_id = private.request_tenant_id() AND private.has_active_tenant_membership(tenant_id))', table_name);
  END LOOP;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.billing_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_customers TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_operations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.billing_webhook_events TO authenticated;
