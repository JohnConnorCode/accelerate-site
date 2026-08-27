# Accelerate Revenue OS agent contract

This file is the mandatory starting point for every implementation agent. The
goal is repeatable delivery by agents with different capability levels, without
rediscovering architecture or inventing new write paths.

## Read in this order

1. The claimed card in `/admin/features` and its matching entry in
   `scripts/feature-backlog-data.mjs`.
2. `docs/AGENT-TICKET-RUNBOOK.md` for the pickup, execution, evidence, and handoff
   procedure.
3. `docs/FEATURE-BOARD-TAXONOMY.md` before adding, relabeling, promoting, or
   reorganizing backlog cards.
4. `docs/REVENUE-OS-ENGINEERING-CONTRACT.md` for data, automation, AI, security,
   and failure invariants.
5. `src/lib/revenue-os/README.md` for authoritative modules and callers.
6. `docs/REVENUE-OS-SETUP.md` when the ticket touches schema, providers, secrets,
   health, or production activation.
7. `docs/MARKETING-POSITIONING-CONTRACT.md` before changing any public marketing
   copy, metadata, search description, public assistant positioning, or CTA.
8. `docs/NAVIGATION-RUNTIME-CONTRACT.md` before changing links, history,
   scroll restoration, route focus, loading states, or page transitions.
9. `docs/ADMIN-DEMO-CONTRACT.md` before changing either demo, the admin runtime,
   admin navigation, demo fixtures, or demo QA.
10. `docs/WORK-MOTION-CONTRACT.md` before changing Work pages, public reveal
   primitives, scroll behavior, or portfolio animation QA.

Run `npm run verify:agent-contract` before implementation. If it fails, repair
the contract or card detail before changing product behavior.

## One operating path

Every capability follows this sequence:

`entrypoint -> authenticate/validate -> resolve identity -> claim/idempotency -> domain service -> immutable receipt/activity -> audit -> operator surface`

- Route handlers, UI components, cron routes, webhooks, and AI tools are adapters.
  They do not own business rules.
- Domain writes belong in `src/lib/revenue-os/` and must be reused by UI, AI,
  integrations, and automation.
- External effects require a deterministic idempotency key and a truthful
  terminal receipt. HTTP 200 alone is never proof of success.
- AI reads bounded live context. AI writes and external actions enter
  `action_queue` and use the same validated service as the normal UI after the
  required founder confirmation.
- Canonical IDs win over email joins. Ambiguous identities are review work, not
  permission to guess.
- Provider facts and audit history are immutable. Human notes and configuration
  are editable through explicit services.

## Ticket state is source-controlled

- `scripts/feature-backlog-data.mjs` is the durable definition of every managed
  card. `/admin/features` is its operational projection.
- Claim work by setting a specific Owner and `in_progress` state in the manifest,
  adding current evidence, then intentionally reconciling with
  `npm run seed:features -- --apply`.
- Do not create a second roadmap. Newly discovered work becomes a detailed card
  with a stable key, dependencies, starting points, guardrails, acceptance, and
  verification evidence.
- Keep managed labels inside `docs/FEATURE-BOARD-TAXONOMY.md`: one milestone,
  category, phase, and one or two reusable capabilities. Never add one-off labels.
- Do not mark a card `shipped` until every acceptance item has attached evidence.
  Local success cannot satisfy an acceptance item that explicitly requires
  production proof.
- Never delete source tables or compatibility routes until the reconciliation
  card proves field and row-count parity in production.

## Safe change rules

- Preserve unrelated worktree changes. Inspect `git status --short` before edits.
- Use additive, ordered, idempotent migrations. Never silently mutate production
  schema from an application request.
- Migration delivery includes execution and live verification. Do not hand SQL
  files back to the founder for manual dashboard work. For Accelerate, run
  `npm run db:migrate -- <migration.sql>`; it reads the project-specific database
  password from macOS Keychain service `accelerate-supabase-db-password` and
  targets only project `skjypuwkceoiunyhhqlm`. Store database credentials in
  Keychain or an approved secret manager, never in the repository or command
  output.
- Admin access is founder-only and fail-closed through `ADMIN_EMAIL` in both
  middleware and API authorization. Never weaken it for testing.
- Secrets remain in environment configuration or encrypted server-only storage.
  Never log or return tokens, service keys, raw customer messages, or prompts.
- Calendly remains optional and disabled unless a card explicitly activates it.
- Do not introduce another analytics, email, AI, or scheduling provider when the
  card can use the existing first-party/Supabase, Resend, configured AI, or Google
  Workspace paths.

## Verification minimum

For every code ticket:

1. `npm run verify:agent-contract`
2. `npx tsc --noEmit`
3. `npm run lint`
4. The closest scoped unit, API, or Playwright journey named by the card
5. `npm run build` before a shipped handoff
6. `git diff --check`

Visual and interaction work additionally requires repository Playwright at the
affected desktop and mobile widths, opened screenshots, console-error checks,
keyboard coverage, and reduced-motion coverage where motion is involved.

Data, job, webhook, send, or integration work additionally proves happy path,
duplicate/replay, invalid input, provider failure, truthful receipt, and safe
retry behavior. Never test destructive behavior against uncontrolled production
records.
