# Program waves: dependency-ordered execution plan

## Purpose and authority

This document is the dependency-ordered execution program for a coordinated
multi-agent implementation effort — any coding agent, not a specific model or
vendor. It is not a second roadmap and never owns a card's status, owner,
priority, order, or evidence; it exists to give the natural-language pickup
runner and any agent skimming the board a wave ordering finer-grained than
milestone:now/next alone, so "what's dependency-ready" and "what actually
matters to do first" stay distinguishable.

The live Feature Board is the authoritative work record. Git holds templates
and dated exports. `seed:features -- --apply --plan <reviewed.json>` applies
explicit revision-checked changes and never archives unlisted work. When this
guide disagrees with the board, repair this guide before dispatching work.
See `docs/contracts/UNIVERSAL-WORK-BOARD.md` for the current protocol.

The request “pick up work from the backlog and follow protocol” is the default
agent execution trigger; the internal runner chooses the dependency-ready card
and carries it through commit and evidence submission.

The program prioritizes useful business journeys and allows independent phases
to progress together. The live board records the exact next work. Phase gates in
NORTHSTAR.md require accepted outcome evidence; no elapsed time or card count
closes them. The generated NORTHSTAR-BUILD-PLAN.md is an explicitly dated report.

## Program outcomes

The program is successful when the founder can:

1. Capture an inquiry once and inspect one canonical identity, opportunity,
   attribution trail, next action, communication receipt, and audit history.
2. Work from Today, Tasks, Pipeline, Conversations, Analytics, Setup, and
   recovery surfaces that reconcile because they call the same services.
3. Ask what is known about a person, company, or opportunity and receive a
   bounded answer with source, date, confidence, and openable provenance.
4. Review what automation did, declined, failed, and recovered without reading
   database tables or treating configuration as health.
5. Turn a won opportunity into delivery and client-success work without losing
   the original revenue context.
6. Stand up a separate client installation from configuration and migrations,
   export it without secrets, and prove a scratch restore.

## Claiming and coordination

Use the plain-language request described in [Natural-language agent
execution](NATURAL-LANGUAGE-AGENT.md), which invokes the internal `agent:go`
runner. The configured private transport (scoped WORK_BOARD_URL and WORK_BOARD_TOKEN
for remote workers, or an owner-authorized named-project local profile), readiness, UUID
dependencies, six-card WIP limit, revision and session fencing are enforced by
the shared service. No implicit expired-claim reassignment, force bypass,
caller-HEAD worktree base or automatic worktree deletion. Completion submits
the exact commit and passing checks for founder review.
The execution order below remains a planning aid, not a second roadmap.

## Mandatory ticket packet

Before an agent edits product behavior, its claimed Feature Board card must
answer every item below — the natural-language pickup runner prints the card's description,
acceptance criteria, and notes (dependencies/starting points/guardrails) in
one call, so this is what to check that output against. If an answer is
missing, improve the card rather than inventing policy in code.

- **Outcome:** one observable founder, customer, or operating result.
- **Current behavior:** the concrete gap, failure, or unavailable capability.
- **Canonical owner:** the entity and authoritative Revenue OS service.
- **Entrypoints:** exact UI, API, webhook, cron, provider, and AI callers.
- **Contract:** bounded inputs, outputs, authorization, and identity rules.
- **Impact:** read, internal write, external action, or destructive action.
- **Execution boundary:** deterministic idempotency key, atomic claim, replay,
  stale/concurrent state, and uncertain-provider treatment.
- **Evidence:** canonical state, immutable activity/receipt, audit entry, and the
  operator surface that exposes success, partial, skipped, failed, degraded, and
  not-configured states.
- **Demo:** scenario data, simulated mutations, receipts, and assertions, or a
  documented capability exclusion with a business reason.
- **Acceptance:** two to five observable items, including recovery when the work
  mutates data or calls a provider.
- **Verification:** exact commands and environments; never "run all tests."
- **Stop conditions:** new provider, destructive migration, weakened auth,
  uncontrolled production data, broader recipients, or a different canonical
  owner.

Prefer one vertical slice: at most one additive migration, one authoritative
service contract, its thin adapters, one operator surface, and its scoped tests.
Split a card when it combines multiple providers, unrelated domain services,
provider activation plus rollout, or broad route modernization plus new business
behavior.

## Architecture law

Every capability follows:

```text
entrypoint
  -> authenticate / validate / authorize
  -> resolve canonical identity
  -> claim / idempotency / confirmation
  -> Revenue OS domain service
  -> canonical state + immutable receipt/activity
  -> audit
  -> operator and recovery surface
```

Routes, React components, cron handlers, webhooks, provider adapters, and AI tools
do not own business rules. Canonical IDs win over email; ambiguous identity is
review work. An HTTP response or provider acknowledgement is not proof that the
intended action completed. AI mutations use the registered tool and action queue
path; destructive AI tools stay unavailable.

## Dependency-ordered program

Use the live Ready view and `agent:status`; use `agent:show -- --card <key>` to
inspect a full packet without claiming. Now precedes Next, then priority and board
order. Later is deliberate even when dependencies are satisfied. Phase and
initiative filters explain contribution without imposing a global phase lock.

The generated [build plan](../NORTHSTAR-BUILD-PLAN.md) reports phase proof cards,
ready work, specification gaps, blockers, review and unrecorded delivery. It owns
no status. The [backlog audit](../planning/BACKLOG-AUDIT.md) records historical
dispositions and linked corrective/verification work.

## Optional provider lane

`card:integration-adapter-contract` must ship before any provider below. These
cards stay Later and unavailable until the founder separately authorizes the
named provider, scopes, credentials, production data classes, and rollout:

- `card:microsoft-365-workspace-parity`
- `card:stripe-revenue-reconciliation`
- `card:slack-notification-approval-surface`
- `card:notion-knowledge-source`

Provider adapters translate into canonical identity, communication, scheduling,
knowledge, notification, revenue, run, and audit services. They never create a
parallel CRM, task ledger, payment truth, approval ledger, or knowledge store.

## Verification matrix

Every implementation card runs:

```bash
npm run verify:agent-contract
npx tsc --noEmit
npm run lint -- --max-warnings=0
git diff --check
```

Before Shipped, also run `npm run build` and the exact scoped commands recorded by
the card.

- UI: explicit local `PLAYWRIGHT_BASE_URL`, desktop/mobile, keyboard/focus,
  reduced motion, console errors, overflow, and opened screenshots.
- Internal mutation: founder auth, validation, audit before/after, duplicate,
  stale/concurrent state, truthful receipt, and safe retry.
- External action: exact confirmation or approved policy, deterministic key,
  provider failure, uncertain outcome, reconciliation, and no duplicate effect.
- Cron/webhook/sync: auth or signature, replay ID, cursor/backlog, partial/failed
  terminal state, and recovery.
- Analytics: window/cohort fixtures, unknown attribution, stage-history
  reconciliation, and agreement across screens.
- Migration: additive ordered SQL, idempotent execution, schema verification
  receipt, compatibility behavior, and additive corrective recovery.

Some verification scripts create controlled Supabase fixtures. Read the script
and use its documented cleanup. `test:api-contracts` and
`verify:webhook-cron-defense` require an explicit local base URL when production
is not the intended target. Never use uncontrolled production records for
destructive or replay testing.

## Evidence and worker handoff

Every worker returns:

- Card key, unique owner, and resulting status.
- Commit SHA and exact authoritative services, adapters, UI, tests, migrations,
  and documentation changed.
- Exact command results and environment, opened screenshot paths, and redacted
  receipt or deployment identifiers.
- Schema, environment, provider, setup, compatibility, and recovery impact.
- Decisions and guardrails preserved.
- Unmet production acceptance, known limitations, and exact remaining work.
- Follow-up card keys and final `git status --short`.

Shipped means every acceptance item has evidence. Local mocks cannot satisfy a
production receipt requirement. A partially complete card remains in progress or
is explicitly parked with the remaining slice and owner cleared or transferred.

## Release gate

Production release is founder-authorized per named release. It is never an
automatic final step and earlier authorization is not standing permission.

After explicit release authorization, the coordinator audits every worktree and
unmerged local branch, reconciles completed in-scope work, commits the complete
release tree, reruns all required verification, and deploys that exact immutable
commit. Any later change reopens verification. The release handoff records the
commit SHA, deployment receipt, canonical alias, authenticated live checks, and
final repository synchronization evidence.

## Permanent non-goals

- A second database-per-client architecture alongside the active shared-database
  tenant contract; custom domains, billing, tenant-managed membership roles, and
  cross-tenant customer analytics remain separately authorized work.
- A second identity resolver, pipeline transition service, sender, priority
  formula, analytics formula, AI runtime, policy engine, or execution ledger.
- Destructive AI tools, autonomous prompt mutation, unrestricted document
  ingestion, blind provider retry, or hidden external effects.
- New providers activated because they appear in this plan.
- Deleting compatibility tables or routes before production reconciliation.
- Public-site or marketing redesign unless a separately claimed Feature Board
  card explicitly places it in scope.
