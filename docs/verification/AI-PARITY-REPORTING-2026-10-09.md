# Shared AI reporting and coverage foundation

This implementation lets an authenticated workspace operator read Revenue and
Analytics through Ask AI or MCP using the dashboard services. It also establishes
reviewed operation mappings and an inventory gate. It does not complete the full
universal administration plan or establish live external-client acceptance.

## Implemented behavior

Revenue and Analytics reads accept named sections, strict filters and bounded
drilldowns. JSON and field/value CSV exports contain the requested section or
page, source information and continuation metadata. CSV strings cannot become
spreadsheet formulas. Recorded contracts, proposals, won values and forecasts
retain their original meanings; no collected-payment or currency conversion
claim is inferred.

Primary analytics reads refuse incomplete data. Auxiliary history, communication
and website inputs disclose degradation, and unavailable communication counts
are unknown rather than zero. Website freshness comes from an observed event.
Website reports use the day window only and refuse opportunity filters; their
read does not depend on unrelated opportunity storage.

The generated inventory projects versioned operation definitions from the existing
tool registry. Conflicting definitions or service owners, missing evidence paths,
missing entrypoints and newly introduced unreviewed tools, handlers or discovered
source operations fail the gate. Existing gaps remain explicit. Static discovery
does not establish business semantics or complete coverage of indirect writes.

The capability screen supports search, empty-result recovery and retry. Its API
reports module registration separately from operational readiness, which remains
unevaluated until dispatch. Standing-permission results preserve partial outcomes;
the agent does not restage an incomplete receipt as a new proposal or describe it
as completed work.

## Verification evidence

- Reporting acceptance compares real shared services through route adapters,
  registered internal tools and MCP dispatch using isolated memory fixtures.
  It covers tenant isolation, strict inputs, pagination, safe exports, evidence
  size, source completeness, module disable and membership revocation.
- Inventory tests cover AST exports, TSX routes, fingerprints, recursive discovery,
  operation conflicts, exact source bindings and rejection of new coverage gaps.
- Permission outcome tests retain actual receipts and refuse missing member
  identity, required human review and missing record permission. Agent-loop tests
  verify incomplete-outcome wording alongside proposal approval wording.
- The core suite reached the generated permission-reference check, which exposed
  a stale reference for new tools. After regeneration, the remaining core checks
  passed. Relevant reporting, agent-loop, analytics, revenue-read, discovery,
  AI-operations, OAuth and documentation checks were also run separately.
- Type checking, lint, house-style copy, open-source statistics, agent contract,
  documentation source coverage and inventory freshness passed. The final production
  build passed compilation, TypeScript and page generation.

These are local controlled tests, not live provider, production or installed-client
proof. No production data, OAuth grants or release state were changed.

## Browser acceptance gap

The desktop/mobile capability check could not open Chromium. The launcher exited
with `SIGTRAP` after `bootstrap_check_in` reported macOS Mach-port error 141.
Search interaction, keyboard focus, retry and responsive layout therefore remain
unverified in a browser. The check is retained as `qa-ai-capabilities.mjs`, available
through `QA_FOCUS=capabilities npm run qa:admin-polish`. No native browser fallback
or repeated launcher attempt was used.

## Remaining approved plan

Remaining domain CRUD, import/export, content creation/deletion/reordering and
their reviewed operation mappings still need shared writers and the full failure
matrix. Expanded standing permissions require corresponding database admission
checks, not just additional tool names. Founder administration needs a separately
authenticated resource and protection against platform data appearing in tenant
queues, traces or MCP catalogues. Secure OAuth consent and secret entry remain
human handoffs.

Native live-client acceptance and the browser journey remain independent release
requirements. Review, merge and deployment have not occurred. The canonical
[parity contract](../contracts/ADMIN-AI-PARITY.md) and generated inventory describe
the current boundary; registration counts are not a coverage percentage.
