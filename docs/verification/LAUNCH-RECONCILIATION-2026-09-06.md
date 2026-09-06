# Launch reconciliation — 2026-09-06

Prepared in an isolated `agent/launch-reconciliation` worktree at the founder's
request. This is a review candidate, not production authorization or a release
receipt. Source branches and their active worktrees were preserved.

## Pinned inputs

- Public site and merged docs rewrite: `626c86cb94946a4d8646a641d4eff3ff28375157`
  (PR 32, including merged PR 35; CI 34010854902 passes).
- Runtime, plugin cold loader and host-policy fingerprints:
  `ff5045afe05c3b17bb7e73407440a4aa7307fecb`
  (PR 33; CI 34011030604 passes).
- Developer onboarding and live-board execution contracts:
  `79f14747e719bca8f8973ab30e3145c637a9abfa`
  (PR 34; CI 34010356883 passes).
- Sales qualification handoff: `254965f8f58c58faa1e629824f8e17dcef6f11de`
  (PR 31; CI 33986741474 passes).

All inputs are ancestors of this candidate. These source receipts do not replace
combined-commit CI, which is linked in the reconciliation PR.

## Resolutions

Kept every package script and every input branch's core-suite command. CI retains
public/docs/Work browser evidence alongside Collections, work-board, first-use,
real business demos, PostgreSQL, developer handoff, cold-start samples and the
deployable plugin-package check. Kept the single loopback origin and the repaired
navigation source gate. Recomputed public statistics from the combined tree:
66 migrations, 193 named checks, 710 TypeScript files and 131706 source lines
(132K displayed). No runtime conflict required choosing one implementation over
another; conflicts were in CI, package command additions and derived statistics.

Local agent contract, navigation source contract and source-statistics checks
pass. Full application verification runs remotely; no additional local build,
browser or server was started. Dependencies are reused through a symlink.
The initial preflight in the empty worktree reported a missing Prettier dependency;
reusing the existing installation resolved it and the contract then passed.

## Worktree preservation snapshot

Containment describes committed HEAD only. A contained dirty worktree can still
have unfinished edits; no dirty changes were copied, removed or declared ready.
The reconciliation worktree itself was still being finalized at this snapshot.

| Worktree                             | HEAD         | Candidate ancestry | Dirty paths |
| ------------------------------------ | ------------ | ------------------ | ----------- |
| accelerate-site                      | 89617ecbe80e | not contained      | 21          |
| admin-ai-parity                      | e4f6ada803f9 | contained          | 0           |
| ai-approved-branding                 | ce9a4163266e | contained          | 0           |
| ai-bounded-context                   | d2333506e099 | not contained      | 0           |
| ai-module-controls                   | faf18c1e9fa9 | contained          | 0           |
| ai-tool-discovery                    | ab8be75c0db1 | contained          | 0           |
| backlog-execution-quality            | 7dac45d68606 | contained          | 0           |
| booking-mode-contract-reconciliation | d3d70f6c6c8e | contained          | 21          |
| ci-demo-origin                       | 811a61d327e4 | contained          | 0           |
| collections-agent-tools              | 57e5ef3728e2 | contained          | 0           |
| collections-approved-reminders       | 58ec552064b9 | contained          | 0           |
| collections-case-lifecycle           | 05a754dcf913 | contained          | 0           |
| collections-workspace-demo           | 86c68cf561f4 | contained          | 0           |
| de-vertical-inbound                  | d3d70f6c6c8e | contained          | 6           |
| developer-baseline                   | d1d2d31a7d8b | not contained      | 23          |
| developer-handoff-readiness          | 79f14747e719 | contained          | 0           |
| docs-command-center                  | 5d67fece02cc | contained          | 0           |
| docs-task-clarity                    | 9de5834e7bb0 | contained          | 0           |
| launch-reconciliation                | be158b8e9cc8 | contained          | 1           |
| main-reconciled                      | ff5045afe05c | contained          | 0           |
| merge-integration                    | 5965b879e0a4 | contained          | 0           |
| northstar-runtime-consolidation      | 30a6f7b5a953 | contained          | 0           |
| plugin-cold-start                    | 8485caa77c2e | contained          | 0           |
| plugin-data-boundary-hardening       | c7da31ba2d74 | contained          | 0           |
| plugin-isolate-hardening             | 943a66241b62 | contained          | 0           |
| plugin-manifest-generator            | 318b11dd00e9 | contained          | 0           |
| plugin-manifest-grants               | ff5045afe05c | contained          | 0           |
| plugin-tool-registration             | ff5045afe05c | contained          | 0           |
| production-integration               | 254965f8f58c | contained          | 0           |
| proposal-lifecycle-service           | d3d70f6c6c8e | contained          | 8           |
| receivables-collections              | 0ed03f0c119f | contained          | 0           |
| release-readiness                    | 84721c531a81 | contained          | 0           |
| release-style                        | 4a6c130dab4a | contained          | 0           |
| system-health-report                 | 7bf524770596 | contained          | 9           |
| turnkey-installation                 | 5552fe707abf | contained          | 0           |
| universal-work-board                 | 50f3aa671751 | contained          | 0           |
| verification-workflow-efficiency     | 31b14eaaa547 | contained          | 0           |
| work-completion-truth                | 1bbc1e976091 | contained          | 0           |
| workshelter-reuse-backlog            | 70d9c692a985 | contained          | 0           |
| workshelter-reuse-baseline           | 89617ecbe80e | not contained      | 192         |
| workspace-installer                  | e600bae2a579 | contained          | 0           |

## Release gates still separate

Vercel reports an account deployment block. Hosted customer intake, enabled
providers, migration readiness and recovery/restore acceptance require their own
receipts before activation. Old queued workflow proposals require fresh preview
and approval after the host-fingerprint upgrade, as documented by PR 33.

This session has no scoped WORK_BOARD_TOKEN and cannot establish live claim
ownership. The founder explicitly requested this isolated reconciliation; no
board state, review approval, source PR merge or production action was fabricated.
New commits made by other agents after the pinned inputs are outside this
candidate until their owner supplies verification and they are reconciled.
