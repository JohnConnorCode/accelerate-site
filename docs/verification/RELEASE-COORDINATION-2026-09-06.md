# Release coordination checkpoint — 2026-09-06

This is a bounded release audit and navigation repair, not a deployment receipt
or a replacement for the live Feature Board. Other agents are actively advancing
branches; the commit IDs below define this snapshot. No other worktree, branch,
claim, PR review state or production setting was changed.

## Integration findings

| Candidate                 | Inspected commit                         | Relationship to public candidate 473cb017                                                                                      |
| ------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Public site / PR 32       | 473cb017d6d98b328d9c42824f45243357975eef | Build, checks and verify passed in CI 34009102736                                                                              |
| Runtime / PR 33           | 8485caa77c2ef5c8b1be8c9c36e95e9a8276758e | Build, checks and verify passed in CI 34009944955; merge conflicts in CI workflow, package.json and src/content/open-source.ts |
| Developer handoff / PR 34 | 353690e5e0df5bc48749b410d05d396552335901 | Current CI pending at inspection; same three merge-conflict paths                                                              |
| Sales handoff / PR 31     | 254965f8f58c58faa1e629824f8e17dcef6f11de | Non-mutating merge-tree check merges cleanly; this does not prove integrated runtime behavior                                  |
| Docs task clarity / PR 35 | 3405b005cefe7071d07b67945568c8931ba9188b | Contains public candidate 473cb017; branch advanced again to 2d87b17 during inspection, confirming ongoing work                |

Used `git merge-tree --write-tree` to inspect integration without changing an
index, branch or worktree. The resulting trees containing conflict markers are
not release candidates. Final reconciliation must preserve both branches' CI
coverage and scripts, regenerate measured public statistics, and rerun checks on
the complete immutable release commit. A series of independently green PRs is
not equivalent to that proof.

Dirty work remains in the primary checkout, booking-mode-contract-reconciliation,
de-vertical-inbound, proposal-lifecycle-service, system-health-report and
workshelter-reuse-baseline. Dirty state establishes neither readiness nor ongoing
ownership. Preserve it pending its owner's handoff; do not sweep it into release.
No shared dispatch credentials are available to this session: `agent:status`
refused because WORK_BOARD_TOKEN is absent. No live status or claim was fabricated.

## Confirmed public and hosting gaps

Direct HTTP checks returned 404 for `/docs` and `/docs/start/daily-path`; the
canonical demo, contact page, robots.txt and sitemap.xml returned 200. These are
route checks, not evidence of successful inquiry storage or provider delivery.
Vercel checks on the current PRs still report `Account is blocked.` Hosting
account resolution and an explicitly authorized release remain necessary.

The runtime agent has now delivered the cold-loader follow-up at 8485caa with
passing CI. Preserve that follow-up when integrating; do not open duplicate work
based only on the earlier failing performance receipt. Hosted installation,
provider activation and recovery acceptance remain distinct from fixture CI.

## Navigation repair delivered in this checkpoint

| Before                                                                                      | After                                                                                    |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Source checks fail on valid multiline CSS and the resource-wrapped build                    | Checks tolerate CSS formatting and explicitly require both resource and release wrappers |
| Legitimate branding refresh is rejected as route navigation                                 | Narrow refresh-only allowance; other raw router operations remain forbidden              |
| Conversations uses a raw Next Link to `/admin/pipeline`, escaping demo/tenant route context | The existing AdminLink resolves the current demo or workspace prefix                     |
| Navigation source contract is absent from routine CI                                        | Dedicated lightweight CI step prevents these regressions from being silently skipped     |

The navigation source contract and touched-file formatting pass locally.
Application build/typecheck, strict lint and browser evidence for this repair
must come from its exact-commit remote CI, linked in PR 32. Earlier browser
receipts remain evidence for their original commit, not a claim for this change.
No additional local server, browser or heavy verification job was started.
