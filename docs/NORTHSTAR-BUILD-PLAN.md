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

| Phase                                                      | Backlog | Planned | In progress | Blocked | Shipped | Total |
| ---------------------------------------------------------- | ------- | ------- | ----------- | ------- | ------- | ----- |
| A — A (Complete Loop One — See + Remember)                 | 0       | 0       | 0           | 1       | 18      | 19    |
| B — B (Agent Runtime foundation — Notice + Act primitives) | 21      | 21      | 0           | 4       | 35      | 81    |
| C — C (Reference coworker — Sales end-to-end loop)         | 21      | 5       | 0           | 1       | 10      | 37    |
| D — D (Plugin SDK + MCP)                                   | 6       | 4       | 0           | 1       | 13      | 25    |
| E — E (Additional coworkers/plugins + documentation)       | 59      | 5       | 0           | 0       | 13      | 77    |

**Board total:** 107 backlog, 35 planned, 0 in progress, 7 blocked, 89 shipped (239 managed cards).

## Dispatchable now (`npm run agent:next` picks from this set)

- `drive-content-indexing` [medium] — Extract and index approved Drive documents
- `ai-bounded-context` [high] — Enforce bounded AI context and grounding rules
- `drive-provenance-retrieval` [medium] — Ground AI retrieval in Drive provenance and citations
- `workshelter-reuse-baseline` [high] — Reconcile the reusable business-plugin baseline before Workshelter adoption
- `admin-shell-design-system` [high] — Complete the shared professional admin system
- `feature-board-interaction-rebuild` [high] — Rebuild Feature Board drag, details, and mobile interaction
- `additional-tools-canonical-parity` [high] — Modernize and canonically integrate every additional admin tool
- `de-vertical-inbound` [high] — Turn the roofing ingestion path into a configurable playbook
- `proposal-lifecycle-service` [high] — Complete the proposal lifecycle and version rules
- `admin-settings-consolidation` [medium] — Consolidate Settings and connection ownership
- `ai-model-job-registry` [medium] — Route every AI job through an audited model registry
- `system-health-report` [high] — Build the system-health report and freshness thresholds
- `gmail-reply-actions` [high] — Finish reply, local archive, and follow-up actions in Conversations
- `booking-mode-contract-reconciliation` [high] — Reconcile booking activation and health truth
- `won-to-delivery-handoff` [high] — Create the won-to-delivery handoff
- `unified-action-executor` [high] — Route every write through one executor with reversibility and compensators
- `plugin-isolate-host` [high] — Run plugin code in an isolate with no ambient authority
- `api-contract-tests` [high] — Add authenticated API contract and failure tests
- `stage-history-analytics-reconciliation` [high] — Reconcile analytics with canonical stage history
- `operating-goals-scorecards` [high] — Add operating goals and scorecards
- `governed-bulk-operator-actions` [medium] — Add governed bulk operator actions
- `integration-adapter-contract` [high] — Define the provider integration adapter contract
- `guided-first-run-setup` [medium] — Guide first-run setup inside the product, not the terminal
- `csv-hubspot-importers` [low] — Ship CSV and HubSpot contact/deal importers
- `roles-and-permissions` [high] — Add real roles, record ownership, and per-object agent permissions
- `integration-adapter-registry-resolution` [high] — Make the integration adapter registry the real resolution point
- `generic-record-merge` [medium] — Add foreign-key-safe generic record merge with supersession
- `report-recipe-engine` [high] — Make server-computed report recipes a registrable primitive
- `docs-module-coverage-gate` [high] — Make a module that ships without documentation a red build

## In progress

_None._

## Blocked

- `communication-sender-service` — Finish one auditable communication sender
- `google-oauth-first-sync` — Connect Google OAuth and complete the first Workspace sync
- `gmail-incremental-sync` — Import Gmail incrementally with cursor recovery
- `calendar-sync-association` — Synchronize Calendar events and associate revenue records
- `second-brain-see` — Phase A: give the system eyes
- `email-studio-runtime` — Restore Email Studio, sent history, and live template publishing
- `site-capacity-visual-rebuild` — Rebuild the public site around capacity liberation and editorial visuals

## Dependency-ready but outside the dispatch horizon

Should always be empty — a non-empty list here means the same defect
`findDispatchDeadlock` in `scripts/lib/feature-board-graph.mjs` catches:
dependency-ready work exists that no milestone label makes claimable.

_None — every dependency-ready card carries milestone:now or milestone:next._
