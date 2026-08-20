-- Alerting needs a dedupe key or a flapping subsystem buries the operator.
--
-- admin_notifications had no unique index, no dedupe column, and no upsert at
-- any of its write sites, so every insert created a new row. That was tolerable
-- while the only writers were inbound forms, which are genuinely distinct
-- events. It is not tolerable for failure alerts: a cron failing every night,
-- or a webhook failing on every retry, would produce an unbounded stream of
-- identical rows and drown the real work.
--
-- The index is scoped to unread rows, mirroring idx_tasks_open_dedupe: once the
-- founder has acknowledged an alert, the same condition recurring is new
-- information and should notify again.
--
-- Additive and idempotent.

ALTER TABLE public.admin_notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_notifications_unread_dedupe
  ON public.admin_notifications (dedupe_key)
  WHERE dedupe_key IS NOT NULL AND read = false;

COMMENT ON COLUMN public.admin_notifications.dedupe_key IS
  'Stable key for recurring conditions such as job failures. Unique among unread rows only, so an acknowledged alert can fire again if the condition returns.';
