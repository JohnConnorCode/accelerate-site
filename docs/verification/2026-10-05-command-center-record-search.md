# Command Center record search

## Scope

Extend the existing Cmd/Ctrl+K palette to tasks, opportunities, clients and proposals, with grouped results and direct detail links. Preserve people lookup, local pages/actions, retry and stale-response cancellation. This follows the shared interaction work in PR #208 and does not establish connected-provider readiness for the entire suite.

## Access and read contract

The route authenticates before reading and uses the actor's tenant-bound database. Core tasks/opportunities are always available; clients/proposals are queried only when their modules are enabled. Each new source returns at most five matches and selects only identity, display context and status. Query syntax/wildcards are sanitized, underscores remain literal and input is capped at 100 characters. A failed enabled source returns a safe 503 instead of an empty or partial success. Result destinations are validated against each record's existing detail route.

Connected and fictional workspaces share result formatting. Fictional lookup reads the same scenario records and current local task/client/opportunity overrides used by their screens. Proposal status filtering is honored, and selecting a proposal outside that filter reads its detail independently. No mutation, provider, credential or migration path changes.

## Verification

- `test:admin-search`: canonical-person deduplication, all four record destinations and context, tenant isolation across nine sources, module-disabled reads skipped, literal underscores, wildcard/injection cleanup, query cap, unnamed captures, safe destination parsing, all nine read failures, recovery and authorization.
- `test:admin-demo-contract`: all six scenario contracts passed.
- Agent contract, generated docs index and refreshed admin-route inventory passed.
- Extended `qa-command-center-interactions.mjs` checks all four search-to-detail journeys, a filtered-out proposal, accessible keyboard selection, visible selected rows, desktop/phone widths, reduced motion, failure/retry, late responses, console errors and zero protected/provider requests.
- Local desktop search captures were opened and inspected. The first complete browser run was interrupted by the machine resource gate when free disk fell below its reserve. This is incomplete local browser evidence, not a passing full journey. Build, lint and complete browser verification must pass on the exact PR head in CI before handoff acceptance.

Local capture directory: `/Users/johnconnor/.local/share/accelerate/reviews/20261005-command-record-search/`.

## Documentation

Updated Command Center overview, feature description and both changelogs. Reviewed agency FAQs; they do not describe workspace search and need no change. Regenerated docs index and route fingerprints; update source statistics for the shared browser-safe formatter.
