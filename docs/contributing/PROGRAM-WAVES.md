# Program waves: dependency-ordered execution plan

## Purpose and authority

This document is the dependency-ordered execution program for a coordinated
multi-agent implementation effort — any coding agent, not a specific model or
vendor. It is not a second roadmap and never owns a card's status, owner,
priority, order, or evidence; it exists to give `npm run agent:next` and any
agent skimming the board a wave ordering finer-grained than milestone:now/next
alone, so "what's dependency-ready" and "what actually matters to do first"
stay distinguishable.

The live Feature Board is the authoritative work record. Git holds templates
and dated exports. `seed:features -- --apply --plan <reviewed.json>` applies
explicit revision-checked changes and never archives unlisted work. When this
guide disagrees with the board, repair this guide before dispatching work.
See `docs/contracts/UNIVERSAL-WORK-BOARD.md` for the current protocol.

The program is revenue-core-first. It finishes a truthful revenue loop, gives
the system connected memory, expands the founder cockpit, and only then widens
automation, delivery, client success, and optional providers. The intended
horizon is twelve months, but dependencies and verified outcomes—not dates—move
work between milestones.

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

Use `npm run agent:next` with scoped WORK_BOARD_URL and WORK_BOARD_TOKEN.
Readiness, UUID dependencies, six-card WIP limit, revision and session fencing
are enforced by the shared service. No implicit expired-claim reassignment,
force bypass, caller-HEAD worktree base or automatic worktree deletion.
Completion submits exact commit and passing checks for founder review.
The execution order below remains a planning aid, not a second roadmap.

## Mandatory ticket packet

Before an agent edits product behavior, its claimed Feature Board card must
answer every item below — `npm run agent:next` prints the card's description,
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

Only dependency-ready cards are eligible for dispatch. The order inside each
wave is intentional; two agents may run in parallel only when they do not
share an unmet dependency or overlapping files.

### Gate 0: restore execution truth

1. `card:feature-board-dependency-integrity` makes dependency, milestone, roll-up,
   and documentation drift machine-checkable.
2. Complete or explicitly park the currently claimed slices before opening new
   WIP. Use `card:route-state-resilience`, `card:email-studio-runtime`, and
   `card:admin-shell-design-system` as their only status authorities.
3. Reconcile the manifest to the live board only after owners confirm the intended
   transition and any managed drift has been reviewed.

Exit gate: contract verification and live board verification agree, no active
card has an unmet dependency, and each in-progress card has one explicit owner.

### Wave 1: execution safety and activation truth

Implement in this order:

1. `card:atomic-execution-claims`
2. `card:communication-sender-service`
3. `card:setup-control-plane`
4. `card:secret-storage-hardening`
5. `card:booking-mode-contract-reconciliation`
6. `card:audit-ledger-coverage`
7. `card:revenue-os-tests`
8. `card:api-contract-tests`

Close evidence-heavy foundations rather than rebuilding them. Review
`card:cloneable-command-center-contract`, `card:tenant-config-seam`,
`card:openrouter-ai-gateway`, and `card:founder-note-capture` against their
acceptance, then ship, narrow, or record the exact remainder.

Exit gate: material work claims before side effects, retries reuse a logical key,
receipts terminate truthfully, Setup reports behavior rather than configuration,
and provider or database failure never looks like success.

### Wave 2: one canonical founder cockpit

1. `card:task-operator-workspace` adds the missing all-commitments workspace and
   repairs record links without creating another task writer.
2. `card:legacy-api-adapters` and `card:additional-tools-canonical-parity` make
   Activity, Inbox, Revenue, and retained source tools projections of canonical
   services while compatibility remains reversible.
3. `card:identity-review-workbench` gives ambiguous or unmatched source records
   explicit link, create, or no-match decisions. Merge and delete are excluded.
4. `card:data-quality-repair-center` turns warnings into exact records and safe
   service-owned repair actions.
5. `card:stage-history-analytics-reconciliation` makes funnel, furthest-stage,
   time-in-stage, regression, and forecast facts derive from stage events.
6. `card:command-palette-tools` makes search and commands operate on canonical
   contacts, companies, opportunities, tasks, proposals, and campaigns.
7. `card:admin-a11y-keyboard-mobile` verifies equivalent critical work on desktop,
   mobile, keyboard, and reduced motion.

Exit gate: the same record and metric agree across Today, Tasks, Pipeline,
Activity, Inbox, Revenue, Analytics, search, and AI reads.

### Wave 3: connected senses and memory

1. `card:google-oauth-first-sync`
2. `card:gmail-incremental-sync`
3. `card:gmail-thread-idempotency`
4. `card:gmail-record-association`
5. `card:conversations-operator-inbox`
6. `card:calendar-sync-association`
7. `card:drive-folder-boundary`
8. `card:drive-content-indexing`
9. `card:ai-tool-registry`
10. `card:ai-bounded-context`
11. `card:ai-confirmation-system`
12. `card:drive-provenance-retrieval`
13. `card:second-brain-see`
14. `card:second-brain-remember`

Google activation and production receipts require founder-controlled credentials
and consent. Agents may finish safe local service work while activation is
unavailable, but must leave production acceptance open and move to another
dependency-ready card rather than fabricate evidence.

Exit gate: Gmail, meetings, approved Drive material, and founder notes resolve to
canonical records; retrieval cites source/date/confidence and refuses unsupported
answers.

### Wave 4: revenue execution and planning

Campaign sequence:

1. `card:campaign-policy-versioning`
2. `card:campaign-dry-run`
3. `card:campaign-enrollment-personalization`
4. `card:campaign-jit-executor`
5. `card:campaign-stop-conditions`
6. `card:campaign-unsubscribe`
7. `card:resend-webhooks`
8. `card:campaign-performance-exceptions`
9. `card:campaign-workspace-ui`

Proposal and meeting sequence:

1. `card:proposal-lifecycle-service`
2. `card:proposal-public-decisions`
3. `card:proposal-delivery-receipts`
4. `card:proposal-pdf-expiry-followup`
5. `card:proposal-workspace-ui`
6. `card:calendar-confirmation-flow`
7. `card:precall-briefs`
8. `card:postmeeting-workflow`
9. `card:autonomous-inbound-responder`

Planning sequence:

1. `card:operating-goals-scorecards`
2. `card:forecast-scenario-planner`

Exit gate: campaign and proposal external effects have exact previews, approvals
or approved policy versions, stop rechecks, provider receipts, uncertain-outcome
reconciliation, and safe recovery. Targets and forecast scenarios are visibly
separate from recorded revenue facts.

### Wave 5: operations, delivery, and productization

1. `card:system-health-report`
2. `card:notification-dispatch-preferences`
3. `card:operations-alerting`
4. `card:incident-receipt-recovery-console`
5. `card:setup-behavioral-tests`
6. `card:won-to-delivery-handoff`
7. `card:client-success-lifecycle-workspace`
8. `card:governed-bulk-operator-actions`
9. `card:de-vertical-inbound`
10. `card:install-runbook`
11. `card:client-instance-portability`

Exit gate: a founder can follow an incident to its receipt and bounded recovery;
a won opportunity creates one receipted delivery handoff; client commitments and
renewal risk remain linked to canonical history; and a scratch client instance
can be installed, exported without secrets, and restored.

### Wave 6: initiative, learning, and trust

1. `card:proactive-operator-intelligence` implements the behavior summarized by
   `card:second-brain-notice`.
2. `card:automation-policy-registry` supplies the shared versioned trigger,
   envelope, guardrails, eval, approval, and kill-switch primitive summarized by
   `card:second-brain-act`.
3. `card:agent-learning-feedback-loop` supplies per-tool outcome attribution and
   governed signals summarized by `card:second-brain-learn`.
4. `card:ai-model-job-registry` and `card:ai-quality-control-plane` gate model and
   policy changes with evals, cost, rollback, and curated exemplars.
5. `card:second-brain-trust` renders a receipt-linked account of actions,
   declines, failures, corrections, and measured outcomes.
6. `card:mcp-ai-tool-bridge` is last and derives from the same tool registry; it
   never bypasses confirmation or the action queue.

Exit gate: adding a policy is configuration plus fixtures rather than a bespoke
agent; changes are evaluated, outcomes are attributed, and the founder can answer
"what has the system been doing?" from one accountable surface.

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
