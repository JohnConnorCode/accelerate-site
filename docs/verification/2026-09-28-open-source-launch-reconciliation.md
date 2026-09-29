# Open-source launch reconciliation, September 28, 2026

## Published baseline and agent work

The reviewed `origin/main` is `765a747ff31543d336078d83fc8ccef69dff3267` (PR #176). The GitHub repository is public. It has no GitHub Release. The maintainer preflight passed against this main commit and the configured work-board protocol responded without claiming a card.

There were 40 registered worktrees before this review and 41 after creating its isolated integration checkout. Sixteen pre-existing worktrees have tracked changes. A different tree from main is not evidence of missing work: old branches often predate a squash merge and include later-superseded files. No existing branch, claim, dirty checkout or checkpoint was reset or deleted.

| Candidate                                                    | Disposition                                                                                                 | Evidence                                                                                                                                                                                                         |
| ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PR #174, runtime dependencies and public browser QA          | Integrate after correcting its failing image-load check and rerunning required CI                           | Its five package updates include PR #173's updates. The last #174 build failed while decoding a demo image; its source PNG is valid.                                                                             |
| PR #173, Dependabot production dependencies                  | Close as superseded only after the verified integration tree contains the same package and lockfile updates | #174 includes the same five updates plus QA repair. Both PRs currently have failing build checks.                                                                                                                |
| PR #81, source authority and decision memory                 | Keep draft and excluded                                                                                     | The recorded review found missing row-level security, non-tenant-composite decision lineage and unsafe supersession concurrency.                                                                                 |
| `agent/admin-coherence-20260923`                             | Already integrated in PR #140                                                                               | PR #140 explicitly rebased the useful Work, Contacts and saved-view changes; its migration and routes exist on main. The older branch has 44 files different from today's main and must not be merged wholesale. |
| `fix/step-budget-forced-wrapup`                              | Already integrated in PR #149                                                                               | PR #149 included the reviewed step-budget work and verified the combined tree.                                                                                                                                   |
| Architect review/simulation and generated-operation branches | Excluded pending ownership and current-scope review                                                         | PR #140 recorded their deliberate exclusion. Both branches are based on older main and have no ready PR.                                                                                                         |
| Dirty PWA, theme, AI Readiness and primary checkouts         | Retained, not accepted for integration                                                                      | Their uncommitted changes and/or active ownership need a handoff and exact-tree verification before inclusion. Existing PWA and theme capabilities were released separately.                                     |

Recent agent branches with PRs #159 through #176 were checked against GitHub merge records. Closed or uncommitted branches were not treated as ready solely because their names sound complete. The integration owner should refresh this ledger if main or any candidate head advances during review.

## Public story and first-use path

The agency homepage is the broader strategy, build, execution and improvement offer. Command Center is one product inside it. The current public pages describe many features but delay the concrete result a new reader can understand. This candidate puts a customer inquiry, the linked record, the next action and its result in the first screen of Command Center, open source, docs and README. It keeps the existing visual system and routes.

The four-command README path starts a neutral site and fictional demo. A connected workspace additionally requires the owner's Supabase project, Auth setup and migration/application verification. Public copy must keep those paths distinct. MCP clients likewise require installation-specific connection and, for ChatGPT web, OAuth configuration.

## Launch acceptance still open

The repository's `docs/contributing/LAUNCH-ACCEPTANCE.md` is the release gate. A public repository and a production deployment do not complete it. Before tagging `v0.1.0`, record:

1. Required CI, open-source hygiene, dependency/security review and a pinned exact integration tree.
2. A fresh isolated connected installation with real Auth and persisted fictional records, plus grounded AI, reviewed learning, plugin operation, tenant-denial, load and backup/restore evidence. Existing native PostgreSQL and controlled transport checks have narrower scope.
3. One independent technical install from the release candidate's clean clone, including sign-in, sign-out, password recovery, saved contact/task and every place the installer needed help. Marcin was nominated in the acceptance procedure; no completed trial receipt is present in this review.
4. Browser review of the changed public pages at desktop and mobile widths, including keyboard, reduced motion, links, screenshots and published-page overrides. Verify the live release identity after a separately authorized deployment.

If a required connected or independent trial cannot be completed, report a release candidate with the exact missing proof. Do not publish a final tag or claim launch acceptance on the strength of the fictional demo.
