-- Free-first sub-daily scheduler for the Command Center.
--
-- Postgres owns cadence only. It wakes an authenticated Vercel adapter, which
-- still claims work through withJobRun and calls Revenue OS services. No
-- business rule or provider mutation lives in this migration.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS supabase_vault;

CREATE OR REPLACE FUNCTION public.configure_command_center_scheduler(
  p_dispatcher_url TEXT,
  p_cron_secret TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  existing_id UUID;
BEGIN
  IF p_dispatcher_url IS NULL
     OR p_dispatcher_url !~ '^https://[^[:space:]]+/api/cron/system-health-snapshot$' THEN
    RAISE EXCEPTION 'Dispatcher URL must be the production HTTPS system-health route';
  END IF;
  IF p_cron_secret IS NULL OR length(p_cron_secret) < 32 THEN
    RAISE EXCEPTION 'Cron secret must contain at least 32 characters';
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'command_center_dispatcher_url';
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(p_dispatcher_url, 'command_center_dispatcher_url', 'HTTPS endpoint woken by Supabase Cron');
  ELSE
    PERFORM vault.update_secret(existing_id, p_dispatcher_url, 'command_center_dispatcher_url', 'HTTPS endpoint woken by Supabase Cron');
  END IF;

  SELECT id INTO existing_id FROM vault.secrets WHERE name = 'command_center_cron_secret';
  IF existing_id IS NULL THEN
    PERFORM vault.create_secret(p_cron_secret, 'command_center_cron_secret', 'Bearer credential for the Command Center cron adapter');
  ELSE
    PERFORM vault.update_secret(existing_id, p_cron_secret, 'command_center_cron_secret', 'Bearer credential for the Command Center cron adapter');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.wake_command_center_health()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  dispatcher_url TEXT;
  cron_secret TEXT;
  request_id BIGINT;
BEGIN
  SELECT decrypted_secret INTO dispatcher_url
    FROM vault.decrypted_secrets
   WHERE name = 'command_center_dispatcher_url';
  SELECT decrypted_secret INTO cron_secret
    FROM vault.decrypted_secrets
   WHERE name = 'command_center_cron_secret';

  -- An unapplied deployment must not generate failing external traffic. The
  -- scheduler becomes active only after the deployment script stores both
  -- encrypted Vault values.
  IF dispatcher_url IS NULL OR cron_secret IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := dispatcher_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || cron_secret
    ),
    body := jsonb_build_object(
      'trigger', 'supabase-cron',
      'requested_at', now()
    ),
    timeout_milliseconds := 20000
  ) INTO request_id;

  RETURN request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.command_center_scheduler_status()
RETURNS JSONB
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'configured',
      EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'command_center_dispatcher_url')
      AND EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'command_center_cron_secret'),
    'active', COALESCE((
      SELECT active FROM cron.job WHERE jobname = 'command-center-health-15m' LIMIT 1
    ), false),
    'schedule', COALESCE((
      SELECT schedule FROM cron.job WHERE jobname = 'command-center-health-15m' LIMIT 1
    ), 'not_scheduled'),
    'last_run_status', (
      SELECT details.status
        FROM cron.job_run_details details
        JOIN cron.job job ON job.jobid = details.jobid
       WHERE job.jobname = 'command-center-health-15m'
       ORDER BY details.start_time DESC
       LIMIT 1
    ),
    'last_run_at', (
      SELECT details.start_time
        FROM cron.job_run_details details
        JOIN cron.job job ON job.jobid = details.jobid
       WHERE job.jobname = 'command-center-health-15m'
       ORDER BY details.start_time DESC
       LIMIT 1
    )
  );
$$;

REVOKE ALL ON FUNCTION public.configure_command_center_scheduler(TEXT, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.wake_command_center_health() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.command_center_scheduler_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.command_center_scheduler_status() TO service_role;

SELECT cron.schedule(
  'command-center-health-15m',
  '*/15 * * * *',
  $cron$SELECT public.wake_command_center_health();$cron$
);

COMMENT ON FUNCTION public.wake_command_center_health() IS
  'Supabase Cron wake-up adapter only. Business work remains in the authenticated Vercel route and Revenue OS services.';
COMMENT ON FUNCTION public.command_center_scheduler_status() IS
  'Redacted behavioral status for Setup and Health. Never returns URL or secret values.';
