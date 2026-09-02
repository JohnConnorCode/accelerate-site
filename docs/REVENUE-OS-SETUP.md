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
12. `migrations/20260816-first-party-analytics.sql`
13. `migrations/20260816-money-first-outreach.sql`
14. `migrations/20260816-email-studio.sql`
15. `migrations/20260816-contact-importer.sql`
16. `migrations/20260817-schema-verification.sql`
17. `migrations/20260817-atomic-job-claims.sql`
18. `migrations/20260817-atomic-campaign-member-claims.sql`
19. `migrations/20260817-resend-webhooks.sql`
20. `migrations/20260817-campaign-stop-claims.sql`
21. `migrations/20260817-campaign-stop-claims-lock-order.sql`
22. `migrations/20260819-campaign-send-attempts.sql`
23. `migrations/20260819-stale-claim-recovery.sql`
24. `migrations/20260820-agent-run-partial.sql`
25. `migrations/20260820-notification-dedupe.sql`
26. `migrations/20260820-responder-policy.sql`
27. `migrations/20260823-command-center-scheduler.sql`
28. `migrations/20260823-remove-legacy-job-claim-overload.sql`
29. `migrations/20260824-ai-command-runtime.sql`
30. `migrations/20260830-shared-database-tenancy.sql`
31. `migrations/20260830-tenant-context-authorization.sql`
32. `migrations/20260830-tenant-public-boundaries.sql`
33. `migrations/20260830-tenant-uniqueness-cutover.sql`
34. `migrations/20260830-revenue-recovery.sql`
35. `migrations/20260831-tenant-lifecycle-rpcs.sql`
36. `migrations/20260831-tenant-invitation-receipt-idempotency.sql`
37. `migrations/20260831-tenant-suspension-guards.sql`

The Revenue OS migrations are idempotent. The core migration preserves legacy tables and creates the canonical operating model. The Feature Board migration creates the delivery roadmap. First-party analytics adds anonymous event storage. Money-first outreach adds campaign send idempotency and unguessable unsubscribe tokens. Email Studio adds protected draft and published template revisions. Contact Import adds review batches, row receipts, immutable events, and an atomic digest-bound execution claim.

The AI command runtime migration adds founder-owned conversation history, replay-safe client message IDs, and run linkage for provider, tool-pack, duration, and conversation observability. Apply it before enabling `/admin/ai`; until then the command UI fails closed with a setup message and no schema is created from a request path.

The shared-database tenancy migration creates the tenant control plane, assigns
every existing operational row to the deterministic Accelerate tenant, adds
tenant-composite keys and foreign-key backstops, and installs membership-plus-
request-context RLS. Its Accelerate default is a temporary compatibility seam;
the authorization cutover removes it only after every writer passes explicit
tenant context. Revenue recovery follows it and creates tenant-owned recovery
records from its first row. The lifecycle RPC migration makes workspace creation,
membership binding, status changes, revocation, and their platform audit receipts
atomic and service-role-only; apply it before exposing tenant provisioning. The
suspension guard then makes active tenant status a just-in-time requirement for
operational RPC claims, including service-role callers holding a stale context.
Production tenant release and activation use the staged, fail-closed checks in
`docs/TENANT-CUTOVER-RUNBOOK.md`; a green Setup Center or schema check alone is
not activation evidence.

Maintainers apply all migrations in order with `npm run db:migrate:all`, or one
at a time with `npm run db:migrate -- <migration.sql>`, then
verify the resulting objects through the service role. Either command resolves the
project, pooler host, database user, and password from the self-hosted
environment described in `.env.example`; on macOS the password may instead come
from the configured Keychain service. Always inspect the printed target before
continuing. No database password belongs in source control, hosting logs,
documentation, or command output.

After the last migration, agents run `npm run db:verify-schema -- --record`.
This read-only command verifies the versioned Revenue OS contract across required
tables, columns, constraints, indexes, functions, and service-only policies. It
prints a machine-readable result, exits non-zero for an unapplied migration,
metadata drift, or connectivity failure, and writes an immutable verification
receipt only when the receipt table itself is available. Setup Center reports the
exact contract version and its last successful receipt; it does not treat a
single queryable table as schema health.

`migrations/20260817-atomic-job-claims.sql` adds the shared database claim used
by Revenue OS cron and on-demand synchronization. A job key can have only one
active owner; a repeated deterministic claim key returns its existing receipt
instead of running again. New scheduled work must use `withJobRun` from
`src/lib/revenue-os/runs.ts`, never a route-local lock or blind retry.

`migrations/20260823-command-center-scheduler.sql` enables Supabase Cron and
`pg_net` as a cadence and wake-up adapter. It schedules a read-only system-health
snapshot every 15 minutes. The database never owns health rules or automation
logic: it calls `/api/cron/system-health-snapshot`, which authenticates with the
same `CRON_SECRET`, claims through `withJobRun`, calls the shared health service,
and writes the normal job receipt. After deploying that route and applying the
migration, run `npm run scheduler:configure`; the command stores the endpoint and
bearer credential encrypted in Supabase Vault and never prints either value.
The configurator resolves the public canonical host before storing the endpoint.
This is required because `pg_net` must not carry the bearer credential across a
bare-domain redirect. The follow-up overload migration also removes the obsolete
two-argument job-claim RPC so PostgREST has one unambiguous function to call.
Setup remains Action or Degraded until a fresh application receipt proves the
complete wake-up path.

## Approval-gated Contact Import

`/admin/contact-imports` accepts bounded UTF-8 CSV, TSV, JSON, text files, or pasted notes. Deterministic parsing happens before OpenRouter extracts and normalizes only source-grounded facts. Analysis creates a review plan, not contacts. Low-confidence, invalid, and ambiguous identities default to excluded. Saving review reruns deterministic email/domain matching and invalidates any prior approval.

Approval is bound to the exact selected and edited row digest. Execution claims that snapshot atomically, calls the canonical identity/import service, fills only blank fields on exact existing contacts, and records a terminal result per row plus batch events, activity, and audit provenance. It never creates an opportunity, task, campaign membership, or message. A partial batch retains failed rows for a safe replay; already imported rows resolve through the source-row idempotency key.

Apply `migrations/20260816-contact-importer.sql`, then connect and verify the workspace's OpenRouter key in Integrations. The key is stored in the tenant's authenticated encrypted provider envelope; it is never stored in import tables or returned to the browser. `OPENROUTER_MODEL` is optional; `OPENROUTER_FALLBACK_MODEL` may name one OpenRouter-routed model fallback, and workflow-specific model variables remain platform-side routing controls. The full uploaded source is not logged.

## Email Studio publishing

`/admin/emails` is the operator workspace for transactional copy, automated-sequence copy, and sent history. Source-code templates remain the safe fallback. Saving in Email Studio creates a draft and does not affect recipients. A founder-only test send uses the configured Resend sender and can target only the authenticated founder. Publishing atomically replaces the prior live revision; real transactional and legacy sequence sends resolve the published revision through `src/lib/email/runtime-template.ts`.

If the Email Studio tables are unavailable, runtime email continues with built-in content and the Setup Center reports the migration as needing action. Never store a Resend key or other secret in a template revision.

## Money-first operating mode

The contact form, roofing qualifier, and chat capture now feed the canonical identity, opportunity, activity, attribution, and same-day follow-up services. The public contact experience embeds the configured free Calendly event; Calendly API/webhook attribution remains an optional separate capability and must not be represented as connected until its credentials and booking/cancellation receipts pass production checks. Resend confirmation failures never discard an already stored inquiry.

### Additional tools compatibility

The specialized admin tools remain active during migration. Their APIs preserve the existing source-specific fields while `src/lib/revenue-os/legacy-adapter.ts` attaches canonical contact, company, opportunity, and stage identifiers when a deterministic source or email match exists. Leads, Contact Submissions, Chat Inquiries, Clients, Subscribers, Resource Downloads, Partners, and Website Grades use this one bridge. The Contact Timeline is the cross-source person view: it combines the original source history with canonical opportunities, activities, messages, tasks, and a filtered Pipeline handoff.

Manual Lead creation enters the shared identity, inbound, activity, task, and audit services. A single Lead stage change uses the canonical transition service before updating its compatibility record. Bulk Lead stage changes and the legacy Bookings sub-stages remain explicitly tracked migration work because they need an atomic transition contract and a separate meeting-attendance model; do not retire their source tables until production field and row-count reconciliation passes.

Until Gmail reply detection, bounce webhooks, cron, and immediate stop tests are complete, campaigns are limited server-side to one step and 10 sends per day. Campaign sends claim a deterministic idempotency key before provider execution and include one-click unsubscribe headers plus a visible unsubscribe link. Apply the money-first outreach migration before activating a pilot.

### Resend delivery feedback

The shared Revenue OS sender uses a stable provider idempotency key and carries
canonical message, conversation, campaign, source, and template tags into
Resend events. Do not add a second direct Resend path for campaigns or AI sends.

To turn delivery feedback on, create one HTTPS webhook in Resend pointing to
`https://www.acceleratewith.us/api/webhooks/resend`, subscribe to `email.sent`,
`email.delivered`, `email.delivery_delayed`, `email.bounced`,
`email.complained`, `email.failed`, `email.suppressed`, `email.opened`, and
`email.clicked`, and save the signing secret only as `RESEND_WEBHOOK_SECRET`.
The endpoint verifies the raw Svix signature, claims the provider replay ID
before mutation, records a canonical receipt, and suppresses future campaign
mail immediately for bounce, complaint, or suppression events. Opens and clicks
are advisory engagement signals—not evidence of human intent. Setup Center will
show this separately from basic Resend delivery so an API key is never mistaken
for live feedback.

## Feature Board operating standard

`/admin/features` is the source of truth for upcoming product and operations work. New ideas belong in **Backlog**. Move only committed work to **Planned**, keep active work in **In progress**, name the dependency when work is **Blocked**, and use **Shipped** only after the definition of done is verified.

Every card should have a clear title, priority, useful labels, enough description to recover context, and a definition of done. Owner and target date are optional until work is committed. Dragging a card persists both its column and exact order in one database transaction. Filters intentionally pause dragging so hidden cards cannot be reordered accidentally. Archiving removes a card from the working board without erasing its audit history.

The initial seed includes production migration, admin QA, unsubscribe handling, Google Workspace setup, provider webhooks, incremental Gmail sync, canonical attribution, test coverage, confirmation-gated calendar actions, Drive indexing, settings consolidation, and a 14-day operational burn-in. After migration, edit those cards in the admin rather than maintaining a second roadmap in documentation.

### Master backlog and agent handoff

The complete execution backlog is source-controlled in `scripts/feature-backlog-data.mjs`. Its current managed count and status totals come from `npm run verify:agent-contract`; do not copy those mutable totals into documentation. The cards cover foundation, admin, Google, Gmail, Calendar, Drive, campaigns, proposals, AI, setup, security, operations, QA, release, documentation, and client productization.

The universal implementation framework is `docs/REVENUE-OS-ENGINEERING-CONTRACT.md`; the exact pickup/evidence/recovery procedure is `docs/AGENT-TICKET-RUNBOOK.md`; and `src/lib/revenue-os/README.md` maps every core service to its callers and invariants. Run `npm run verify:agent-contract` before claiming work. Managed card definitions are durable in the manifest and projected into `/admin/features`; changes that must survive reconciliation belong in the manifest first.

After applying the Feature Board migration, validate the manifest without writing:

`npm run seed:features`

Reconcile the live board to the authoritative manifest:

`npm run seed:features -- --apply`

Verify live count, content, ordering, and outside-manifest drift without writing:

`npm run seed:features -- --verify`

The apply command upserts every managed card by stable `seed_key`, restores managed cards if they were archived, and recoverably archives active cards outside the manifest. It never hard-deletes backlog history.

Every managed card includes:

- A phase and workstream taxonomy.
- A concrete outcome-oriented description.
- Explicit dependency titles.
- Likely code and documentation starting points.
- Guardrails and stated non-goals.
- Testable acceptance criteria.
- A standard agent handoff protocol.

Agents must claim a card by setting **Owner** before implementation. They should keep the card in **Planned** until work actually begins, move it to **In progress** while actively changing it, record test evidence and material decisions in **Internal notes**, and move it to **Shipped** only after every acceptance item is verified. A partially built foundation may be marked In progress when the remaining scope is explicitly described; this is not permission to call it shipped.

## AI operating architecture

The Revenue Copilot is a bounded tool-using system, not an autonomous database or browser agent. `src/lib/revenue-os/ai-tools.ts` is the single registry for every exposed tool, its JSON input schema, impact tier, confirmation requirement, and the validated service that executes it. Unknown tools fail closed. Each tool receipt records the registry version and impact metadata in the agent event ledger.

Read tools can run directly against bounded live records. Internal writes and external actions only create an expiring `action_queue` proposal, then use the same validation and execution services as the normal UI after explicit founder approval. The agent never receives service credentials or raw database access.

Learning is governed quality telemetry: a founder may rate a completed response once; the event and audit record are immutable. Future runs receive a 90-day aggregate per-tool helpful/not-helpful summary only. Raw prompts, model outputs, free-form feedback, customer documents, secrets, and external messages are never promoted into agent instructions. Outcome linkage, review/correction/disable controls, and retention policy remain tracked on the Feature Board before broader automation is enabled.

## Turn-key first-party analytics

Analytics does not require Plausible, Google Analytics, or any other analytics vendor. After applying `migrations/20260816-first-party-analytics.sql` and deploying, the public site records privacy-minimised page views and conversion events in `website_events`. It stores a per-session random identifier, event name, path, referring host, and UTM fields only—never IP addresses, user agents, email addresses, message content, or a persistent cross-site identifier.

`/admin/analytics` keeps two things intentionally separate: website activity is context; canonical opportunities and won value are revenue truth. It labels the opportunity cohort as records created in the selected window and shows missing attribution rather than silently discarding it. If the event schema is unavailable, the page is visibly degraded while revenue metrics remain available.

## Inbound revenue loop

The live roofing qualifier uses `src/lib/revenue-os/inbound.ts` as its single ingestion path. A valid submission resolves a contact and company, creates or enriches one canonical opportunity, persists source attribution, records an immutable form-submission activity, moves the opportunity through the canonical stage-transition service when appropriate, and creates one deduplicated high-priority same-day follow-up task for qualified inquiries. The existing nurture email remains a non-blocking confirmation step; a delivery failure cannot discard the inbound record.

## Required production environment

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_EMAIL`
- `NEXT_PUBLIC_SITE_URL=https://www.acceleratewith.us`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `CRON_SECRET`

Secrets are environment-only. The admin settings API refuses writes for recognized secret keys.

## Optional Google Workspace connection

Enable Gmail API, Google Calendar API, and Google Drive API in one Google Cloud project. Create an OAuth web client with a callback built from your own `NEXT_PUBLIC_SITE_URL`, not Accelerate's:

`<your NEXT_PUBLIC_SITE_URL>/api/admin/google/callback`

For example, `https://www.acceleratewith.us/api/admin/google/callback` is Accelerate's own production callback and will not work for a different deployment. Setup Center (`/admin/setup`) prints the exact callback URL for your instance.

Add:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` — a long independent random value

Then open Setup Center and choose **Connect Google Workspace**. The app requests Gmail read/send, Calendar event, and Drive read-only capabilities. Drive synchronization remains disabled until specific folder IDs are saved in Setup Center.

Use the staged verifier before and after the founder-owned credential and consent steps:

```bash
npm run verify:google-readiness
npm run verify:google-readiness -- --stage=production
```

The source stage proves the minimum scope declaration, signed tenant-bound OAuth
state, tenant-composite provider writes, stable browser-safe failure projection,
and the ten-folder Drive boundary. The Production stage is read-only: it lists
only Vercel environment variable names and queries only non-secret connection
facts plus the latest source-run statuses. It never returns or prints credential
values, access tokens, refresh tokens, customer messages, or Drive content;
encrypted-envelope checks are reduced to booleans inside PostgreSQL.

Production is ready only when all three Google variable names exist, the
bootstrap tenant has a connected account with supported encrypted token
envelopes and every declared scope, Gmail and Calendar have successful terminal
source receipts, and Drive is either explicitly not configured or has a
successful receipt for no more than ten selected folder IDs. A missing row,
expired consent attempt, partial run, failed run, or environment key alone is
reported as blocked rather than healthy.

OAuth failures return stable codes to the Integrations workspace. Start a fresh
connection after `state_mismatch`, `connection_failed`, or
`reconnect_required`; no local records are deleted. Provider and database error
text is not reflected into the URL or browser response.

## Integration capability catalog

`/admin/integrations` is the authoritative map of live, available, planned, and
optional-edge providers. The versioned registry in
`src/lib/revenue-os/integration-registry.ts` declares each provider's bounded
capabilities, minimum authentication posture, data classes, transports, cost
envelope, operating limits, and ownership guardrail. The read model in
`src/lib/revenue-os/integrations.ts` combines that policy with live connection,
source-run, job-run, webhook, schema-verification, message, analytics, and AI-run
receipts.

An environment variable or connected OAuth row can make a capability available
for testing, but cannot make it Ready. Ready requires successful behavioral
evidence within the capability's freshness window. Missing receipt tables,
missing scopes, revoked connections, failed events, or stale evidence remain
visible as degraded. Providers labeled Planned or Edge are roadmap contracts,
not installed integrations and not permission to connect a new external system.

## Tenant-owned OpenRouter and Revenue Copilot

Each workspace admin connects a dedicated OpenRouter API key in Integrations. The server verifies it with OpenRouter's current-key metadata endpoint without generating tokens, encrypts it with tenant/provider/field authentication, increments its credential version on rotation, and never returns plaintext. AI calls resolve that tenant connection immediately before provider traffic, so client usage is billed to the client's OpenRouter account. Client tenants fail closed when their key is missing, revoked, invalid, or unreadable. Only the Accelerate bootstrap tenant may use the temporary `OPENROUTER_API_KEY` platform fallback, and an explicit disconnect disables that fallback.

Create a separate OpenRouter key per tenant and set a provider-side monthly limit. `OPENROUTER_MODEL` is optional because the gateway has a default; `OPENROUTER_FALLBACK_MODEL` selects a model fallback, not a credential fallback; and workflow-specific `OPENROUTER_*_MODEL` variables can tune a workflow without adding another provider SDK. The same tenant key serves Contact Import, Revenue Copilot, website chat, plan generation, content briefs, proposals, and the responder. Email sends, Gmail replies, pipeline movements, task creation, and campaign activation retain their normal confirmation and policy boundaries.

## Booking mode

The public Calendly embed is the active booking path when `CALENDLY_ENABLED` is not `false`; it does not require a Calendly API token. Manual scheduling remains available as a fallback. Set `CALENDLY_PERSONAL_ACCESS_TOKEN` and `CALENDLY_WEBHOOK_SECRET` only when enabling automatic booking/cancellation attribution, and keep that capability marked degraded/action until its signed production receipts pass.

## Verification

1. Deploy after applying the migration and environment changes.
2. Sign in with the exact `ADMIN_EMAIL`; verify another authenticated account is denied.
3. Run `npm run seed:features -- --apply`, then open Setup Center and refresh all checks, including the complete managed Feature Board reported by `npm run verify:agent-contract`.
4. Open one public page and complete one safe test conversion; verify Analytics shows first-party activity and the canonical funnel shows the associated opportunity once it is created.
5. Connect Google, save only approved Drive folder IDs, and run Workspace sync.
6. Create a small campaign, inspect its dry run, activate the version, then pause it before a second step becomes due.
7. Send a test proposal and verify view, accept, and decline receipts.
8. Confirm the Vercel cron jobs have terminal `job_runs` and `source_runs` receipts.

For local Command Center verification, run `npm run test:admin-recovery`, `npm run test:features`, `npm run test:contact-imports`, and `npm run test:admin-parity`. These authenticated Playwright journeys cover shared dialogs, Email Studio, Contact Import review/approval, collapsed/mobile navigation, Feature Board movement, and document-level overflow across every registered admin route. A source review or in-app browser check is not a substitute for these repository journeys.
