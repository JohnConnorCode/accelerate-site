# Collections AI and MCP integration receipt

Verified application commit: `adda05be78a73f8c92c7a22d262b03b23fa0de76`.
Live child: `receivables-agent-tools` (`f916aee7-6e20-44ec-817c-25b6b270884f`).
Baseline: main `86c68cf561f42ce90f652403f0f67a7fc0f424f7`.

## Delivered behavior

Internal AI and tenant MCP share three typed tools: `get_collection_cases`,
`preview_collection_reminder`, and `propose_collection_reminder`. They reuse
canonical workspace reads and the existing verified reminder services. Reads
show recorded observations; previews refresh provider facts; proposals create
pending, digest-bound actions with actor and WorkItem provenance. No tool
approves or sends a reminder.

Context defaults to five cases, permits at most ten, and filters before database
reads. Invoice details and histories are explicitly bounded with truncation
indicators, while summary balances use all returned cases' stored references.
Missing invoice evidence fails closed. Results are capped at 48,000 UTF-8 bytes;
HTML and action payloads remain outside model context. Agents cannot provide
billing amounts, recipients, links or approval state.

Manifest ownership governs discovery and execution. Internal model tool lists
and MCP discovery omit disabled tools; capability screens explain availability.
Preview/proposal metadata identifies host-verified connection requirements.
Admin and all five demos now share registry version `revenue-os-tools.v6` and
Collections metadata, with demo capability availability following module toggles.
The demo assistant remains a clearly labelled simulation.

## Acceptance and verification

All six child acceptance items have local evidence:

- AC01: shared registry, core/outreach packs, typed schemas, module/MCP discovery,
  provider requirement metadata and same service targets.
- AC02: query-window limits, canonical case/contact/invoice/observation/WorkItem
  IDs, observed timestamps, missing evidence, foreign tenant refusal, truncation
  and 48 KB refusal tests.
- AC03: exact host preview parity and private-payload exclusion; recipient,
  balance, tenant and approval injection are refused.
- AC04: pending queue status, exact digest, actor/work provenance and replay
  deduplication across registry and MCP. No send or approval tool exists.
- AC05: paid/disputed/paused/suppressed/changed-recipient, disabled/suspended
  tenant, stale context and provider-failure refusals, no queue growth on refusal,
  and zero sends in the new controlled fixture sequence.
- AC06: documented contracts and limits; successful exact-commit production
  build including TypeScript; strict lint and architecture checks.

Commands and local receipts:

- Resource-gated `npm run test:core && npm run test:collections-reminders &&
npm run test:ai-operations && npm run lint -- --max-warnings=0`:
  `/tmp/collections-agent-final-suite.log` (exit 0).
- `verify:agent-contract`, `verify:module-contract`, `verify:runtime-boundaries`,
  `verify:guardrails`, `verify:docs`, `docs:llms:check`, `test:open-source-stats`
  and `git diff --check` passed. Module contract: 30 modules, 50 AI tools.
- `npm run build`: `/tmp/collections-agent-build.log` (exit 0), using the normal
  shared resource limits and reused compatible dependencies. Existing Next
  middleware/Edge deprecation notices remain non-failing warnings.
- `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3036 npm run resources:run -- node
scripts/qa-collections-workspace.mjs`: `/tmp/collections-agent-browser.log`
  (exit 0). All five scenarios passed at 1440 and 390 pixels, including keyboard
  actions, reduced motion, stale payment cancellation, successful simulated
  receipts, persistence/reset, customer/Today links and plugin toggle retention.
  Added capability checks prove all three tools' ready/disabled/restored states
  and connection labels at both widths. No console errors or escaped API/provider
  requests occurred.
- Screenshots in `/tmp/accelerate-collections-workspace/`: enabled/disabled
  capability cards and Paper/Night Collections screens were opened and inspected.

## Handoff limits

This child closes the Collections AI/MCP entrypoint gap. The parent remains open:
scheduled WorkItem handlers, grounded AI wording, explicit dispute reasons,
disabled-plugin history access, remaining lifecycle/write-off decisions, plugin
conformance/contributor proof and production-only acceptance are still required.
No SQL changed in this child; earlier native database evidence is not represented
as a newly executed database test. Controlled provider fixtures are not production
proof. No Docker, real message send, hosted business migration or deployment ran.

Review is transparent founder-authorized agent self-review, not independent
review. Merge delivery is recorded separately on the live board after the actual
main merge. Other agents' branches and uncommitted work remain outside this slice.
