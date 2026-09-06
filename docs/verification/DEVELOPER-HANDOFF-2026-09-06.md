# Developer handoff readiness

This candidate integrates committed application `e600bae2a579648e8612c29d599793c05af3c576` and backlog implementation `7dac45d68606e2d27913135f5694b0a9cb6b6432` without modifying their existing worktrees or deploying production. It provides a publishable development entrypoint on `agent/developer-handoff-readiness`.

## Findings and fixes

| Handoff gap                                                                | Result                                                                                                                                                              |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unpublished backlog branch and newer local application changes             | Integrated candidate combines both committed histories; publish it for review and clone-based verification.                                                         |
| Contributor instructions named Git templates as live authority             | README, CONTRIBUTING, AGENTS and the runbook point to the canonical live board and developer start guide.                                                           |
| No reliable distinction between local demo readiness and shared assignment | `dev:doctor` checks local prerequisites; `--board` makes authenticated GETs and reports protocol, worker scopes and strict-write enforcement separately.            |
| Claims preceded repository/base validation                                 | Pickup validates matching origin, exact approved ancestry and target ownership before POST; published base branches can be fetched explicitly from matching origin. |
| Worktree paths depended on the checkout used to run the CLI                | Paths derive from the shared Git directory; retained dirty or mismatched worktrees are preserved and refused.                                                       |
| `--json` could include a prose worktree prefix                             | One JSON packet now includes `worktree`; retry diagnostics go to stderr and never include tokens.                                                                   |
| Retry could reconstruct a different claim request                          | The private pending session retains endpoint, card, exact body, revision, request key and claim token for replay.                                                   |
| Clean install omitted execution-packet schema                              | The ordered migration catalog includes the packet-quality migration; CI exercises installation and developer handoff regressions.                                   |

[Developer start](../contributing/DEVELOPER-START.md) specifies the development ref, scoped board credential, isolated test environment, reviewer, exact acceptance evidence and release owner required for a complete handoff.

## Observed shared-service boundary

On 2026-09-06, an authenticated read-only probe of `https://www.acceleratewith.us/api/agent/work-board?connection=1` returned HTTP 404. No packet protocol or strict-write readiness was established. The temporary read-only credential was revoked immediately. This task does not deploy or enable production enforcement.

Unattended team dispatch remains blocked until the maintainer releases the compatible adapters, verifies strict canonical writes, publishes every approved ticket base and issues individual scoped access plus an isolated test environment. The developer doctor reports these as actionable blockers; a local-demo pass is deliberately narrower.

## Verification record

The controlled developer suite passes fresh-clone fetch, missing base, wrong origin, unsafe key, occupied/dirty worktree preservation, consistent cross-worktree paths, pure JSON, token secrecy, exact replay, incompatible endpoint and read-only scope/enforcement checks. Migration catalog and agent contract checks pass. Integrated compilation, migration execution and browser receipts are attached to the candidate's CI and the live implementation card; pending checks must not be described as passing.

Local heavy verification was deferred while another agent's resource-gated server owned the shared job lock. The lock and its process were preserved. The versioned offline hook remains active in this worktree; CI owns the complete integrated build and browser proof.
