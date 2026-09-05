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
npm run agent:next
```

Read [the work protocol](docs/contracts/UNIVERSAL-WORK-BOARD.md) first. Configure
`WORK_BOARD_URL` and a project-scoped `WORK_BOARD_TOKEN` issued by the founder.
The CLI uses HTTP and needs no database credentials. `agent:next` atomically
claims ready work and prints the full live contract. A worktree requires the
card's approved repository base branch and exact commit. Never guess a base or
fall back into another agent's checkout.

Use `agent:status`, `agent:heartbeat -- --card <key>`, and
`agent:release -- --card <key>`. `agent:complete -- --card <key>
--evidence-file <path.json>` submits named passing checks and the exact commit
for review. It preserves the worktree. Completion, review, merge, cleanup and
production deployment are separate facts/actions. Keep claim session files
private and renew within the 30-minute lease; expired work requires explicit
operator recovery. There is no force bypass.

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

## The live board owns work truth

- `/admin/features` and the shared work service own card definitions, UUID
  dependencies, revisions, claims, decisions and immutable execution events.
- Git contains schemas, card templates and explicit dated exports. Edit a live
  card through the UI, scoped HTTP/MCP API, or a reviewed import plan. Never use
  an old checkout to overwrite newer specifications or archive unlisted cards.
- `npm run seed:features -- --plan /tmp/work-plan.json --cards key1,key2` creates
  a proposal. Review its full diff before `--apply --plan /tmp/work-plan.json`.
  Revision conflicts require refresh and review; retry identical requests with
  the same request key. See the work protocol for exports and reconciliation.
- Newly discovered work becomes a detailed card with a stable key, explicit
  prerequisites, scope, references, acceptance and verification. No second roadmap.
- Keep labels inside `docs/contracts/FEATURE-BOARD-TAXONOMY.md`: one milestone,
  category, phase, and one or two reusable capabilities. Never add one-off labels.
- Submit implementation evidence for review only after every acceptance item is
  verified. Local success cannot satisfy an item that requires production proof.
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
