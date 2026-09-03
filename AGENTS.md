# Accelerate Revenue OS agent contract

This file is the mandatory starting point for every implementation agent. The
goal is repeatable delivery by agents with different capability levels, without
rediscovering architecture or inventing new write paths.

If the repo isn't running yet, none of this is reachable: some of the docs
below assume a deployed or locally running instance with migrations applied
and a founder account. Follow
[docs/self-hosting/SELF-HOSTING.md](docs/self-hosting/SELF-HOSTING.md) first, then come back here.

## Pick up work

```
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run agent:next
```

This atomically claims one dependency-ready Feature Board card (advisory
lock + lease, `migrations/20260903-feature-request-claims.sql` — two
concurrent claims on the same card, exactly one wins), creates an isolated
git worktree + branch at `../.agent-worktrees/<seed-key>` so you don't
collide with other agents working this same repo right now, and prints the
card's full context in one call: description, acceptance criteria, and the
notes block carrying dependencies/starting points/guardrails/verification —
no need to hand-read `scripts/feature-backlog-data.mjs`. Only the two
Supabase env vars are required; this needs no browser session because the
Feature Board is platform-global, not tied to a tenant account.

`npm run agent:status` lists what's actually claimable right now.
`npm run agent:heartbeat -- --card <id>` renews your lease if a ticket runs
long. `npm run agent:complete -- --card <id> --evidence "<what you
verified>"` ships it and removes the worktree. `npm run agent:release --
--card <id>` abandons it back to backlog without shipping, leaving the
worktree in place for inspection. Pass `--card <seedKeyOrId>` to any of
these to name a specific card instead of auto-picking.

To claim a specific card you already know by title, find its `seed_key` in
`scripts/feature-backlog-data.mjs` or `/admin/features` first, then
`npm run agent:next -- --card <seed_key>`.

## Read in this order

1. `docs/NORTHSTAR.md` for the platform vision: agent-native business runtime,
   Coworkers, WorkItems, capability graph, autonomy ladder, and implementation phases.
2. The claimed card in `/admin/features` and its matching entry in
   `scripts/feature-backlog-data.mjs`.
3. `docs/contributing/AGENT-TICKET-RUNBOOK.md` for the pickup, execution, evidence, and handoff
   procedure.
4. `docs/contracts/FEATURE-BOARD-TAXONOMY.md` before adding, relabeling, promoting, or
   reorganizing backlog cards.
5. `docs/contracts/REVENUE-OS-ENGINEERING-CONTRACT.md` for data, automation, AI, security,
   and failure invariants.
6. `docs/contracts/MULTI-TENANCY-CONTRACT.md` before changing schema, authorization,
   admin routing, public intake, integrations, jobs, or tenant configuration.
7. `src/lib/revenue-os/README.md` for authoritative modules and callers.
8. `docs/self-hosting/REVENUE-OS-SETUP.md` when the ticket touches schema, providers, secrets,
   health, or production activation.
9. `docs/contracts/MARKETING-POSITIONING-CONTRACT.md` before changing any public marketing
   copy, metadata, search description, public assistant positioning, or CTA.
10. `docs/contracts/NAVIGATION-RUNTIME-CONTRACT.md` before changing links, history,
    scroll restoration, route focus, loading states, or page transitions.
11. `docs/contracts/ADMIN-DEMO-CONTRACT.md` before changing either demo, the admin runtime,
    admin navigation, demo fixtures, or demo QA.
12. `docs/contracts/WORK-MOTION-CONTRACT.md` before changing Work pages, public reveal
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
- Claim work with `npm run agent:next` (see "Pick up work" above), never by
  hand-editing `owner`/`status` in the manifest — those became live-managed
  columns once the atomic claim RPC landed, and `npm run seed:features --
apply` deliberately no longer reconciles them, so a manifest edit to those
  two fields is silently ignored. Everything else about a card (title,
  description, acceptance, labels, dependencies) is still manifest-owned:
  edit it there and reconcile with `npm run seed:features -- --apply`.
- Do not create a second roadmap. Newly discovered work becomes a detailed card
  with a stable key, dependencies, starting points, guardrails, acceptance, and
  verification evidence.
- Keep managed labels inside `docs/contracts/FEATURE-BOARD-TAXONOMY.md`: one milestone,
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
  files back for manual dashboard work. Run
  `npm run db:migrate -- <migration.sql>` only after the resolved project and
  pooler host match the intended environment. Database credentials belong in an
  approved local secret manager or environment, never in the repository or
  command output. Public contributors must use a project they control.
- Platform administration is founder-only and fail-closed through `ADMIN_EMAIL`.
  Tenant workspaces require an authenticated active membership and explicit
  tenant context in both middleware and API authorization. Never weaken either
  boundary for testing.
- Secrets remain in environment configuration or encrypted server-only storage.
  Never log or return tokens, service keys, raw customer messages, or prompts.
- Calendly remains optional and disabled unless a card explicitly activates it.
- Shared-database multi-tenancy is the chosen product shape under
  `shared-database-multi-tenancy-contract`: one application and Supabase database,
  explicit tenant ownership on every operational row, tenant-composite identity
  and idempotency, membership-plus-context RLS, and tenant-bound provider/public
  execution. The former instance-per-client card is historical evidence only.
- Do not introduce another analytics, email, AI, or scheduling provider when the
  card can use the existing first-party/Supabase, Resend, configured AI, or Google
  Workspace paths.

## Release authority and repository reconciliation

- Production deployment is founder-controlled. Never deploy, alias, promote,
  roll back, or otherwise change the live site unless the founder explicitly
  instructs that production action. Completing, committing, or verifying work is
  not deployment authorization, and an earlier deployment instruction is not
  standing permission for a later release.
- When the founder explicitly requests a release, inspect every repository
  worktree and local branch before building. Reconcile all completed, in-scope
  agent work into the release branch, preserve incomplete or unrelated work, and
  stop when ownership or readiness cannot be established safely.
- Commit and verify the complete release tree before building it. Deploy that
  exact immutable commit only; if the tree changes after verification, repeat the
  required verification before deployment.
- A release handoff records the commit SHA, deployment receipt, canonical alias,
  verification evidence, and final repository status. Never claim that all agent
  work shipped from a clean primary worktree alone; the worktree and branch audit
  is required evidence.

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

## Outcome acceptance for visual work

- Translate feedback into observable acceptance before editing. Preserve the
  user's actual outcome, not a convenient proxy. “Use icons intelligently” means
  every icon must communicate a distinct object, action, or state; it does not
  mean swapping one repeated glyph for another or enforcing an arbitrary count.
- Shared behavior belongs in a shared primitive or contract. A route, appearance,
  demo scenario, viewport, or loading path must not need a local patch to receive
  the same motion, field, surface, or navigation behavior.
- Verify the states the user can see: first/direct load, prefetched navigation,
  slow streamed navigation, committed content, mobile, desktop, reduced motion,
  empty, populated, and error states when applicable.
- Never treat source presence as visual evidence. Browser QA must assert the
  intended computed behavior and screenshots must be opened and inspected.
- Do not mark visual work complete because the implementation exists. Completion
  requires evidence that the requested outcome is perceptible, coherent, and
  consistent in the rendered product.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
