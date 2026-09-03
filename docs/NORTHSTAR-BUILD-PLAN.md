# Northstar Build Plan

> **Auto-generated — do not hand-edit.** Produced by `npm run report:build-plan`
> from `scripts/feature-backlog-data.mjs`. Every number below is computed
> from live card data; `npm run verify:build-plan` (wired into
> `verify:agent-contract`) fails if this file drifts from the generator's
> output. To update it after a manifest change, run
> `npm run report:build-plan` and commit the result.
>
> This replaces a hand-maintained second roadmap that AGENTS.md's own rule
> forbids ("do not create a second roadmap") and that nothing verified —
> see `docs/contributing/AGENT-TICKET-RUNBOOK.md` for the actual pickup
> procedure (`npm run agent:next`), and `docs/NORTHSTAR.md` for the vision
> this board tracks against.

## Status by phase

| Phase | Backlog | Planned | In progress | Blocked | Shipped | Total |
|---|---|---|---|---|---|---|
| A — A (Complete Loop One — See + Remember) | 0 | 0 | 0 | 1 | 18 | 19 |
| B — B (Agent Runtime foundation — Notice + Act primitives) | 22 | 22 | 4 | 4 | 25 | 77 |
| C — C (Reference coworker — Sales end-to-end loop) | 20 | 6 | 1 | 0 | 9 | 36 |
| D — D (Plugin SDK + MCP) | 5 | 4 | 0 | 1 | 12 | 22 |
| E — E (Additional coworkers/plugins + documentation) | 45 | 3 | 1 | 0 | 6 | 55 |

**Board total:** 92 backlog, 35 planned, 6 in progress, 6 blocked, 70 shipped (209 managed cards).

## Dispatchable now (`npm run agent:next` picks from this set)

- `gmail-thread-idempotency` [high] — Preserve Gmail threading and message idempotency
- `gmail-record-association` [high] — Associate Gmail threads with canonical revenue records
- `second-brain-see` [high] — Phase A: give the system eyes
- `drive-folder-boundary` [high] — Enforce selected-folder Drive access boundaries
- `drive-content-indexing` [medium] — Extract and index approved Drive documents
- `drive-provenance-retrieval` [medium] — Ground AI retrieval in Drive provenance and citations
- `legacy-api-adapters` [high] — Back legacy admin reads with canonical adapters
- `admin-settings-consolidation` [medium] — Consolidate Settings and connection ownership
- `admin-shell-design-system` [high] — Complete the shared professional admin system
- `de-vertical-inbound` [high] — Turn the roofing ingestion path into a configurable playbook
- `command-palette-tools` [medium] — Connect the command palette to real Revenue OS actions
- `proposal-lifecycle-service` [high] — Complete the proposal lifecycle and version rules
- `webhook-cron-api-defense` [high] — Harden webhook, cron, replay, validation, and rate-limit defenses
- `ai-model-job-registry` [medium] — Route every AI job through an audited model registry
- `booking-mode-contract-reconciliation` [high] — Reconcile booking activation and health truth
- `system-health-report` [high] — Build the system-health report and freshness thresholds
- `identity-review-workbench` [high] — Build the identity review workbench
- `open-source-release-readiness` [urgent] — Prepare the repository for a safe public launch
- `stage-history-analytics-reconciliation` [high] — Reconcile analytics with canonical stage history
- `operating-goals-scorecards` [high] — Add operating goals and scorecards
- `won-to-delivery-handoff` [high] — Create the won-to-delivery handoff
- `guided-first-run-setup` [medium] — Guide first-run setup inside the product, not the terminal
- `csv-hubspot-importers` [low] — Ship CSV and HubSpot contact/deal importers
- `roles-and-permissions` [high] — Add real roles, record ownership, and per-object agent permissions
- `entity-registry-and-link-graph` [high] — Add an open entity registry and a polymorphic link graph
- `unified-action-executor` [high] — Route every write through one executor with reversibility and compensators
- `docs-site-infrastructure` [high] — Build the documentation site infrastructure at /docs

## In progress

- `conversations-operator-inbox` — Finish Conversations as the unified communication inbox (Antigravity)
- `ai-bounded-context` — Enforce bounded AI context and grounding rules (Codex)
- `playwright-inbound-pipeline` — Add Playwright journey for inbound capture and pipeline progression (OpenCode)
- `feature-board-interaction-rebuild` — Rebuild Feature Board drag, details, and mobile interaction (OpenCode)
- `integration-adapter-contract` — Define the provider integration adapter contract (Claude)
- `integration-adapter-registry-resolution` — Make the integration adapter registry the real resolution point (Claude)

## Blocked

- `communication-sender-service` — Finish one auditable communication sender
- `google-oauth-first-sync` — Connect Google OAuth and complete the first Workspace sync
- `gmail-incremental-sync` — Import Gmail incrementally with cursor recovery
- `calendar-sync-association` — Synchronize Calendar events and associate revenue records
- `email-studio-runtime` — Restore Email Studio, sent history, and live template publishing
- `site-capacity-visual-rebuild` — Rebuild the public site around capacity liberation and editorial visuals

## Dependency-ready but outside the dispatch horizon

Should always be empty — a non-empty list here means the same defect
`findDispatchDeadlock` in `scripts/lib/feature-board-graph.mjs` catches:
dependency-ready work exists that no milestone label makes claimable.

_None — every dependency-ready card carries milestone:now or milestone:next._
