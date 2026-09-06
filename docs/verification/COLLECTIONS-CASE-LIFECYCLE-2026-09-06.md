# Collections case lifecycle

Card: `receivables-case-lifecycle`. Base: `5552fe707abf2a42ac972be9ec8985d2d550a73d`.

The case host accepts canonical invoice-creation action IDs, loads invoices through the existing tenant-bound Stripe service, and checks operation, contact, customer, account, currency, mode and credential version. It refuses incomplete provenance and provider failures before any batch write. Observations use provider remaining balances; missing invoices do not imply payment. The scope is explicitly tracked platform invoices, not an entire Stripe account scan.

The optional module defaults off. Two service-role domain RPCs use a shared tenant lock, current activation/connection checks, tenant-composite references and command receipts. They persist provider observations, case policy revisions and immutable events, alongside canonical activity/audit entries and WorkItems. Disputes and indefinite pauses cancel pursuit; promises and timed pauses schedule another check. Only paid observations with zero remaining balance for every tracked case invoice settle a case. Settlement, disabling and upgrades preserve history.

## Acceptance evidence

- AC01: ordered migration creates tenant-owned cases, references, observations, immutable events and command receipts; schema contract includes tables and RPCs. Actual business migrations execute on native PostgreSQL.
- AC02: host suite exercises the canonical Stripe reader with controlled responses, verifies source identity and partial balances, and rejects malformed/foreign/provider-failure inputs with zero writes. Database RPC rechecks current connection identity/version.
- AC03: native PostgreSQL proves command replay, request identity conflicts, concurrent creation/ingestion and one open case per contact/currency.
- AC04: revision-conflicting edits fail; dispute, pause, owner, promise and next-action edits create event/activity/audit receipts. Protected tables reject direct mutation; immutable evidence rejects update/delete.
- AC05: promises schedule canonical WorkItems at the next UTC day; holds cancel active pursuit; partial payment leaves the case open; complete verified settlement cancels remaining pursuit and preserves the closed case.
- AC06: two-tenant native PostgreSQL exercises RLS, foreign input rejection, concurrent workers, disabled/re-enabled writes and repeat migration with preserved history. Host tests cover partial provider failure before writes.

Command: `npm run test:collections-lifecycle`. It combines controlled provider tests and a disposable native PostgreSQL cluster, with no Docker. The SQL harness excludes the Supabase-only cron/vault/network migration and supplies Auth database interfaces; it does not claim hosted Auth or provider delivery verification.

Module generation, module contract, runtime boundaries, TypeScript, strict lint and commit hooks accompany this change. No UI, reminder send, production migration or deployment is claimed. The approved-reminders and workspace/demo cards deliver those subsequent operator-facing capabilities.
