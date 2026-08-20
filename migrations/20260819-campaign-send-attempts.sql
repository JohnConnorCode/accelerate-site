-- Campaign send failures were terminal and unrecoverable.
--
-- A single throw from the provider marked the member `stopped` with
-- next_send_at NULL, which no code path could ever undo: the executor only
-- selects queued/active members with a non-null next_send_at, so recovery
-- required a manual database write that nobody knew was needed. A transient
-- provider blip therefore ended that recipient's sequence permanently.
--
-- This adds a bounded attempt counter so the executor can retry with backoff
-- and stop for real only once the attempts are exhausted.
--
-- Additive and idempotent, safe to rerun.

ALTER TABLE campaign_members
  ADD COLUMN IF NOT EXISTS send_attempts INTEGER NOT NULL DEFAULT 0;

-- Members already stranded by the old behaviour are made recoverable: they were
-- stopped for a delivery failure rather than by any policy decision, so they are
-- returned to the queue with a clean attempt count and become due immediately.
UPDATE campaign_members
   SET status = 'active',
       stop_reason = NULL,
       send_attempts = 0,
       next_send_at = now()
 WHERE status = 'stopped'
   AND stop_reason = 'send_failed_requires_reconciliation';

COMMENT ON COLUMN campaign_members.send_attempts IS
  'Consecutive delivery attempts for the current step. Reset on a successful send; the executor stops the member once it reaches MAX_SEND_ATTEMPTS.';
