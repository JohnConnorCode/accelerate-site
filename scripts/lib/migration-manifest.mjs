/**
 * The single ordered list of migrations a clean install applies, in order.
 * This is the source of truth docs/REVENUE-OS-SETUP.md's numbered list must
 * match — a mismatch between the two is exactly the kind of drift that
 * misleads a fresh clone (human or agent) about how many files there are.
 *
 * migrations/20260830-tenant-uniqueness-compatibility.sql is intentionally
 * excluded: its own header marks it a production-rollout-only compat shim,
 * not part of a clean install.
 */
export const MIGRATION_MANIFEST = [
  "supabase/migration.sql",
  "supabase/migration-prompt2.sql",
  "supabase/migration-prompt2b.sql",
  "supabase/migration-prompt3.sql",
  "supabase/migration-prompt4.sql",
  "supabase/migration-prompt5.sql",
  "migrations/business-operating-system.sql",
  "migrations/utm-tracking.sql",
  "migrations/roofing-booking-machine.sql",
  "migrations/20260816-revenue-os.sql",
  "migrations/20260816-feature-board.sql",
  "migrations/20260816-first-party-analytics.sql",
  "migrations/20260816-money-first-outreach.sql",
  "migrations/20260816-email-studio.sql",
  "migrations/20260816-contact-importer.sql",
  "migrations/20260817-schema-verification.sql",
  "migrations/20260817-atomic-job-claims.sql",
  "migrations/20260817-atomic-campaign-member-claims.sql",
  "migrations/20260817-resend-webhooks.sql",
  "migrations/20260817-campaign-stop-claims.sql",
  "migrations/20260817-campaign-stop-claims-lock-order.sql",
  "migrations/20260819-campaign-send-attempts.sql",
  "migrations/20260819-stale-claim-recovery.sql",
  "migrations/20260820-agent-run-partial.sql",
  "migrations/20260820-notification-dedupe.sql",
  "migrations/20260820-responder-policy.sql",
  "migrations/20260823-command-center-scheduler.sql",
  "migrations/20260823-remove-legacy-job-claim-overload.sql",
  "migrations/20260824-ai-command-runtime.sql",
  "migrations/20260830-shared-database-tenancy.sql",
  "migrations/20260830-tenant-context-authorization.sql",
  "migrations/20260830-tenant-public-boundaries.sql",
  "migrations/20260830-tenant-uniqueness-cutover.sql",
  "migrations/20260830-revenue-recovery.sql",
  "migrations/20260831-tenant-lifecycle-rpcs.sql",
  "migrations/20260831-tenant-invitation-receipt-idempotency.sql",
  "migrations/20260831-tenant-suspension-guards.sql",
];
