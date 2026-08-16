# Accelerate Revenue OS setup

The admin Setup Center at `/admin/setup` is the live source of truth. It checks the running deployment and never displays or stores secret values.

## Required migration order

1. `supabase/migration.sql`
2. `supabase/migration-prompt2.sql`
3. `supabase/migration-prompt2b.sql`
4. `supabase/migration-prompt3.sql`
5. `supabase/migration-prompt4.sql`
6. `supabase/migration-prompt5.sql`
7. `migrations/business-operating-system.sql`
8. `migrations/utm-tracking.sql`
9. `migrations/roofing-booking-machine.sql`
10. `migrations/20260816-revenue-os.sql`
11. `migrations/20260816-feature-board.sql`

Both new migrations are idempotent. The Revenue OS migration preserves legacy tables, extends the existing opportunity and proposal records, imports solution requests into the canonical model, and removes blanket authenticated access from business tables. The Feature Board migration creates the internal delivery roadmap and seeds the known follow-up work once.

## Feature Board operating standard

`/admin/features` is the source of truth for upcoming product and operations work. New ideas belong in **Backlog**. Move only committed work to **Planned**, keep active work in **In progress**, name the dependency when work is **Blocked**, and use **Shipped** only after the definition of done is verified.

Every card should have a clear title, priority, useful labels, enough description to recover context, and a definition of done. Owner and target date are optional until work is committed. Dragging a card persists both its column and exact order in one database transaction. Filters intentionally pause dragging so hidden cards cannot be reordered accidentally. Archiving removes a card from the working board without erasing its audit history.

The initial seed includes production migration, admin QA, unsubscribe handling, Google Workspace setup, provider webhooks, incremental Gmail sync, canonical attribution, test coverage, confirmation-gated calendar actions, Drive indexing, settings consolidation, and a 14-day operational burn-in. After migration, edit those cards in the admin rather than maintaining a second roadmap in documentation.

## Required production environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `NEXT_PUBLIC_SITE_URL=https://www.acceleratewith.us`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`
- `PLAUSIBLE_API_KEY`

Secrets are environment-only. The admin settings API refuses writes for recognized secret keys.

## Optional Google Workspace connection

Enable Gmail API, Google Calendar API, and Google Drive API in one Google Cloud project. Create an OAuth web client with this production callback:

`https://www.acceleratewith.us/api/admin/google/callback`

Add:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — a long independent random value

Then open Setup Center and choose **Connect Google Workspace**. The app requests Gmail read/send, Calendar event, and Drive read-only capabilities. Drive synchronization remains disabled until specific folder IDs are saved in Setup Center.

## Optional Revenue copilot

Add `ANTHROPIC_API_KEY` in Vercel. The copilot can read live operating data directly. Email sends, Gmail replies, pipeline movements, task creation, and campaign activation must be confirmed through the action queue or an explicit final-send confirmation.

## Booking mode

Calendly remains disabled by default. Manual scheduling and Google Calendar are sufficient for launch. Set `CALENDLY_ENABLED=true` only after its token, webhook secret, booking, and cancellation flows pass production testing.

## Verification

1. Deploy after applying the migration and environment changes.
2. Sign in with the exact `ADMIN_EMAIL`; verify another authenticated account is denied.
3. Open Setup Center and refresh all checks, including Feature Board roadmap.
4. Connect Google, save only approved Drive folder IDs, and run Workspace sync.
5. Create a small campaign, inspect its dry run, activate the version, then pause it before a second step becomes due.
6. Send a test proposal and verify view, accept, and decline receipts.
7. Confirm the Vercel cron jobs have terminal `job_runs` and `source_runs` receipts.
