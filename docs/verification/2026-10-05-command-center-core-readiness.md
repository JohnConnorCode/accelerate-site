# Command Center core readiness audit

The Accelerate workspace is not operationally ready for unattended work. This
audit combines a read-only live snapshot from October 5, 2026, source review and
controlled local verification. It does not activate workers, grant provider
access, send messages or establish readiness for another workspace. Existing
Feature Board cards remain the authority for acceptance and follow-on work.

## Operational blockers

| Priority | Confirmed finding                                                                                                                                                                                             | Work needed                                                                                                                                                                                                                                         |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1        | Recent work-engine runs woke successfully but deferred every claimed item. Seventeen waiting items include Finance work blocked on `crm.write` and Roofing work blocked on CRM, Gmail and Calendar readiness. | Repair the affected coworkers through the supported setup and readiness path. The native CRM writer already exists; the workspace capability registration is missing. Recheck a bounded controlled work item before enabling unattended processing. |
| 2        | Accelerate has no connected Google integration or recorded Google source runs. Gmail read/send and Calendar read are unavailable.                                                                             | Connect the intended account through secure consent, verify scopes and source receipts, then check coworker readiness.                                                                                                                              |
| 3        | Four failed items stopped on timeouts and report an unknown effect outcome.                                                                                                                                   | Inspect their artifact and provider receipts before deciding whether to retry. Preserve the original history and idempotency checks.                                                                                                                |
| 4        | A connected inquiry-to-approved-reply journey and the complete qualification-to-booking-to-follow-up journey lack accepted end-to-end proof.                                                                  | Complete the controlled journeys and record actual provider receipts, failure handling and replay evidence against the existing Phase A and Phase C proof cards.                                                                                    |
| 5        | Universal AI/admin parity remains incomplete. The commerce acceptance card is blocked despite the shipped Collections policy slice.                                                                           | Finish the remaining governed proposal, invoice publication/revocation and Collections refresh coverage against the existing parity cards.                                                                                                          |

At the snapshot, work totals were 52 pending, 17 waiting and four failed. The
scheduler and health snapshot job were active; these findings do not establish a
scheduler outage. One old outbound failure was a controlled send-verification
fixture with an invalid key, not proof that the current sending key is invalid.
No production records were changed during this audit.

## Source fixes prepared for review

- Operational health includes uncertain outbound outcomes and all actual active
  work states: pending, waiting, claimed and in progress. Completed and cancelled
  work remain excluded.
- Demo run details open no-tool answers safely. The trace retains actual tool
  successes, failures and staged proposals, rather than inventing a receipt or
  an unrelated opportunity. Older saved runs disclose missing evidence.
- AI history retains missing token usage as unknown and displays **Not recorded**.
  It no longer crashes on a missing aggregate or turns missing usage into zero.
- AI operations tests join the normal core suite. The full admin browser script
  uses current launcher links, navigation disclosures, contact names and actual
  generated runs. Its representative desktop/mobile pass joins CI and retains
  screenshots.

These changes are in draft [PR 211](https://github.com/JohnConnorCode/accelerate-site/pull/211).
They are not merged or deployed.

## Verification and its limits

- The final application source passed full lint, TypeScript validation and the
  72-suite core run in CI. AI operations, conversational-agent and demo contract
  regressions also passed locally. A no-tool trace regression reproduced the original
  crash before the runtime fix.
- Isolated PostgreSQL runtime, Phase B, Today and work completion proofs passed,
  including concurrent claims, replay, tenant isolation and completion races.
- All six fictional business workflows passed at desktop and mobile widths on
  the published core baseline: twelve journeys. Invoice screenshots were opened
  and reviewed. Those journeys do not prove connected provider delivery.
- Documentation checks, generated index, route inventory and agent contract
  passed. The current source inventory has 66 admin pages and 398 fingerprints;
  those counts do not establish complete AI parity.
- The final trace/usage source passed production build, full lint, TypeScript
  validation and route inventory in CI run `37315522167`. The full core and database
  checks also passed. The restored admin browser receipt is pending.
  Local heavy verification was deferred because another active worktree held the
  shared resource slot. Full final CI success is not claimed.

Baseline: `c2b090e51ec74c0433d368adde9c150686686b2f`. Health fix:
`72dce1ddaf374f870526badc1598bfc14093f211`. Final application changes:
`78bfc735bedfa23e5dc96af384fcfd1421c47aed`.

Local audit receipts are under
`/tmp/accelerate-command-center-core-audit-20261005`. The live metadata file is
private and is not committed. The homepage preview at port 3014 remains intact;
it does not contain the final trace fix.
