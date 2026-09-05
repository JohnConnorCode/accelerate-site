# Workshelter reuse implementation contract

This is the shared engineering standard for the Workshelter adoption cards, not
a second roadmap. Scope, dependencies, priority and acceptance live in
`scripts/feature-backlog-data.mjs` and its Feature Board projection. The founder
selected reuse first, campaigns before Support, with other agents implementing.
Creating this handoff does not mean those features have been implemented.

## Start every card the same way

1. Read `AGENTS.md`, `docs/NORTHSTAR.md`, the claimed card and its dependency
   evidence. Claim through `npm run agent:next -- --card <seed_key>`; do not edit
   live owner/status fields. Renew long claims with `agent:heartbeat`.
2. Use the integration commit recorded by `workshelter-reuse-baseline`. It must
   contain the previously completed plugin, branding and five-business demo work
   and the current tenant/action-executor contracts. Do not assume a card marked
   shipped means its code is already in your checkout. Never merge unfinished
   work or discard another agent's changes.
3. Read this contract, the engineering and tenancy contracts, and the exact
   source files in the card. UI work also reads the navigation and demo contracts.
4. Record the implementation boundary before editing: domain owner, schema/API
   changes, callers, impact tier, approval, idempotency key, receipts, failure and
   retry behavior. Follow the numbered implementation steps in the card.
5. Run `npm run verify:agent-contract` before implementation. If a prerequisite
   is missing, record the exact dependency and release the card rather than
   building a second service to work around it.

## Source provenance and reuse rules

- Source checkout: sibling `workshelter-next/` under the common GitHub parent.
  Every path under “Workshelter references” in a card is relative to that root.
  Accelerate paths are relative to the active app-root checkout.
- Inspected source commit: `05eddae3e76e6067ef75bd364e37cc9b6ca692f4`.
  If the sibling has moved, compare the relevant files with that commit. Record
  the source revision actually adopted and the destination files in evidence.
- Read Workshelter's `AGENTS.md` and `docs/PROJECT_CONTEXT.md`. It is a reference
  repository for these cards; do not change it or use its operational data.
- Preserve the applicable MIT copyright and license notice for copied code.
  Record copied/adapted helpers and their provenance in the implementation PR.
  Do not copy company branding, customer content, credentials or environment files.
- Prefer pure validators, compilers, fixtures and interaction patterns. Adapt
  them to Accelerate's existing components, query layer, navigation, theme,
  identity and domain services. Do not add Workshelter's parallel framework stack.
- References are evidence of an implementation pattern, not proof of correctness.
  Its campaign launch route performs enrollment and activation in separate writes;
  its chat-settings revert route performs unchecked writes. Borrow the observable
  workflow and implement transactional, revision-safe services in Accelerate.
- Its collection registry implements grid and kanban. Calendar, gallery and
  timeline currently render a coming-soon placeholder. Do not expose those as
  supported views. Do not copy roster-wide in-memory queries into scalable APIs.

## One runtime, consistent interfaces

- Core owns identity, communications, permissions, knowledge/evidence, activities,
  approvals, budgets and durable work. A plugin composes those capabilities; it
  does not create another CRM, agent, sender, approval queue or memory store.
- Follow the canonical path: authenticate/validate → resolve tenant and identity
  → claim/idempotency → domain service → receipt/activity → audit → operator UI.
  UI, AI, MCP, provider adapters and scheduled work call the same service.
- Reuse existing Campaigns and Email Studio module IDs, routes and document
  renderer. Add compatible schema versions; old saved/published documents and
  immutable provider history must survive.
- New plugin modules are disabled by default in live tenants. Check enablement,
  capabilities and authorization at API/tool boundaries and again before queued
  execution. Disabling preserves history and stops new work; it cannot cancel a
  provider effect already accepted. Explain missing capability and uncertain state.
- Use canonical contact/company/member IDs with explicit tenant scope and RLS.
  AI output and external text are untrusted data. Filter fields/operators, source
  access and tool permissions are enforced by deterministic software.
- Approved campaign versions freeze membership, content, sender, schedule, limits
  and stop conditions. Material edits require reapproval. Send-time eligibility
  can exclude approved recipients but cannot silently add new ones. Segments do
  not grant marketing permission; unresolved consent is an exclusion.
- Side effects require stable keys and truthful outcomes. Accepted by a provider
  is not delivered. Acceptance followed by failed receipt persistence is an
  explicit reconciliation state, not a safe blind retry. Analytics use exact
  provider/message identities; missing data is not zero and opens are advisory.
- Shared views may render only registered fields and named business actions.
  They cannot accept arbitrary SQL, mutable provider facts or caller-supplied
  mutation endpoints. Bound queries, pagination, context size and work budgets.
- Keep common conversation obligations in core. Support's optional automation
  may stop, while operators retain access to unanswered customers and history.
- AI generates drafts, summaries and proposals. It never invents authoritative
  prices, assets, promises or permissions. Feedback becomes reviewed knowledge or
  a curated regression case, never automatically trusted instructions.

## Required evidence on every implementation card

The card's acceptance criteria and scoped tests are mandatory in addition to:

- **Repository checks:** agent contract, typecheck, lint, appropriate scoped tests
  integrated into `test:core`, production build and `git diff --check`.
- **Domain failure matrix:** authorized happy path, invalid input, cross-tenant
  denial, duplicate/replay, concurrent/stale state, database/provider failure,
  truthful receipt, safe retry or explicit reconciliation. Include disabled
  module and revoked capability tests at direct API and AI/MCP entrypoints.
- **Migration evidence:** ordered additive migration, rerun safety, existing-data
  compatibility, indexes/constraints, two-tenant RLS checks and execution receipts
  in the intended authorized environment. Do not claim a SQL file alone is done;
  follow the repository migration contract and keep production authority explicit.
- **UI evidence:** actual admin pages, desktop and mobile, all five appearances,
  keyboard/focus, reduced motion, loading/empty/error/partial/success states,
  console and overflow checks. Open and inspect screenshots; source presence is
  not rendered proof. Avoid copy-pasting a dedicated page for each scenario.
- **Demo evidence:** coherent fictional identities and `.example` data for all
  five businesses, shared admin components and session-local transport, explicit
  simulated AI/provider actions, persistence/reset, scenario isolation and zero
  protected/provider traffic even with an authenticated founder session.
- **Provider evidence:** fixtures prove local contracts only. Record controlled
  provider results separately when required. Never send to uncontrolled contacts,
  launch a live campaign or enable a new provider as routine QA.

Complete through `agent:complete` only after every acceptance item has evidence.
The handoff records the exact commit, commands and outcomes, schema/setup impact,
source attribution, screenshots/receipts and any remaining dependency. A blocked
card retains truthful status. Production deployment requires a separate explicit
founder instruction.

## Ownership and sequencing

Existing campaign and quality cards remain the authoritative owners of their
services. The new cards reference them by dependency; do not implement both sides
in parallel copies. In particular, `ai-quality-control-plane` owns versioned
policies/exemplars, while `support-knowledge-corrections` owns the concrete review
workflow that consumes them. `proposal-lifecycle-service` is already claimed;
the later presentation card extends its result without changing its current scope.

The campaign browser gate is an intentional delivery-order prerequisite for
Support. The shared-view and vertical cards stay Later until those business
workflows establish a proven need. Only baseline reconciliation is added to Next;
no active owner is reassigned and no implementation card is claimed by this
backlog-organizing task. Deferred provider choices become explicit dependency
cards rather than guesses made during implementation.
