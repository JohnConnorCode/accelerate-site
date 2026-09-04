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
| B — B (Agent Runtime foundation — Notice + Act primitives) | 21 | 20 | 0 | 4 | 32 | 77 |
| C — C (Reference coworker — Sales end-to-end loop) | 20 | 3 | 2 | 1 | 10 | 36 |
| D — D (Plugin SDK + MCP) | 5 | 3 | 0 | 1 | 13 | 22 |
| E — E (Additional coworkers/plugins + documentation) | 40 | 5 | 0 | 0 | 10 | 55 |

**Board total:** 86 backlog, 31 planned, 2 in progress, 7 blocked, 83 shipped (209 managed cards).

## Dispatchable now (`npm run agent:next` picks from this set)

- `drive-content-indexing` [medium] — Extract and index approved Drive documents
- `ai-bounded-context` [high] — Enforce bounded AI context and grounding rules
- `drive-provenance-retrieval` [medium] — Ground AI retrieval in Drive provenance and citations
- `admin-shell-design-system` [high] — Complete the shared professional admin system
- `admin-settings-consolidation` [medium] — Consolidate Settings and connection ownership
- `feature-board-interaction-rebuild` [high] — Rebuild Feature Board drag, details, and mobile interaction
- `additional-tools-canonical-parity` [high] — Modernize and canonically integrate every additional admin tool
- `gmail-reply-actions` [high] — Finish reply, local archive, and follow-up actions in Conversations
- `de-vertical-inbound` [high] — Turn the roofing ingestion path into a configurable playbook
- `command-palette-tools` [medium] — Connect the command palette to real Revenue OS actions
- `proposal-lifecycle-service` [high] — Complete the proposal lifecycle and version rules
- `api-contract-tests` [high] — Add authenticated API contract and failure tests
- `booking-mode-contract-reconciliation` [high] — Reconcile booking activation and health truth
- `unified-action-executor` [high] — Route every write through one executor with reversibility and compensators
- `plugin-isolate-host` [high] — Run plugin code in an isolate with no ambient authority
- `stage-history-analytics-reconciliation` [high] — Reconcile analytics with canonical stage history
- `operating-goals-scorecards` [high] — Add operating goals and scorecards
- `won-to-delivery-handoff` [high] — Create the won-to-delivery handoff
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

- `ai-model-job-registry` — Route every AI job through an audited model registry (claude-code:johnconnor:97666)
- `system-health-report` — Build the system-health report and freshness thresholds (claude-code:johnconnor:9960)

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
