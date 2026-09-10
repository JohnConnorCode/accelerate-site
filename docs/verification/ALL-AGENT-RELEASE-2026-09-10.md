# Agent release reconciliation, 10 September 2026

The founder explicitly requested all relevant agent work committed, integrated and live, plus removal of old worktrees and clear live cards for unfinished work. The integration candidate starts from published main `de21220effde24c358560ad4f60d9b1a5e7c330f`. Existing public docs from PR 68 are preserved; Site Studio descriptions now explain its implemented publishing controls.

## Included source

| Work                                                                              | Exact source                               | Disposition                                                                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Installation website authoring, current AI catalogue and compact Work controls    | `0ef8134b0a989c911b6b5e8e5302e4d37980cafb` | Integrated, preserving the explicit Muse Spark 1.3 default and current model browsing.                         |
| Admin clarity, demo launcher, contact review, cross-tab appearance and new themes | `004f341`                                  | Integrated. Includes the equivalent contact-review and theme-revert patches in their source branches.          |
| Editorial icons, error page and plan PDF colors                                   | `98a2bd3fc90dd03bfe5f3cbb9450461f36e90783` | Integrated with its preceding icon commit.                                                                     |
| Earlier runtime, campaign, bulk-contact, delivery and theme work                  | Main PRs 59 through 66                     | Already integrated; source handoffs and corrections are documented in the September 8 reconciliation receipts. |

Integration fixes formatting, regenerates route fingerprints and public source counts, and adds the three new contact-review/demo-marketing/theme-persistence journeys to required CI. Local lint and shared token checks pass. Exact final CI and deployment receipts belong in the integration PR and live card delivery events; this source document does not assert a deployment before it happens.

## Unfinished source preserved and linked

Every dirty source tree was captured using a temporary Git index, committed to a named recovery branch, and pushed. Originals were also committed without discarding the saved source. These checkpoints are not assertions of product readiness.

| Original checkout                 | Recovery branch                                                 | Commit                                     | Live card / disposition                                                       |
| --------------------------------- | --------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| accelerate-site                   | `archive/unfinished-20260910-accelerate-site`                   | `e6344c705c1944a04fcf5150113c3e0924f37a69` | workspace-blueprint                                                           |
| admin-shell-design-system         | `archive/unfinished-20260910-admin-shell-design-system`         | `0a325b8132ed7b84f11e527adc5e6624f05f9e30` | admin-shell-design-system                                                     |
| machine-agent-resource-supervisor | `archive/unfinished-20260910-machine-agent-resource-supervisor` | `05b42bf82f4dc741f18fd0f20c34bf46fbf129ce` | machine-agent-resource-supervisor                                             |
| services-strategy-rebuild         | `archive/unfinished-20260910-services-strategy-rebuild`         | `c5edb9360136051fd9d573323848dd25b643cdc0` | services-strategy-rebuild                                                     |
| unified-action-executor           | `archive/unfinished-20260910-unified-action-executor`           | `a6aa2b85222ab8402569537cfa872eea5d794dab` | unified-action-executor                                                       |
| accelerate-site-docs-rewrite      | `archive/unfinished-20260910-accelerate-site-docs-rewrite`      | `5dd4b506d3b01f19162007d263744543b2f51f8c` | historical-acceptance-reconciliation; dependency-only lockfile drift excluded |

The live cards carry exact source references, affected files and remaining verification. Blueprint still needs integration, schema, isolation, rollback and browser proof. Executor deletion/compensation changes need current tenant-bound service reconciliation and native transactional tests. The earlier supervisor scratch implementation must not overwrite the SQLite implementation already merged in PR 62. Services requires public copy, anchor and desktop/mobile review. Old admin-shell changes must be compared with the current shared surfaces instead of blindly reapplied.

The installation editor card also remains open for complete source-page/collection import, asset uploads, richer collection ordering and governed general AI/MCP parity. Release of the working editor does not assert acceptance of those larger requirements.

## Worktree audit and cleanup

The initial audit covered 91 registered worktrees plus all local branches, open PRs and merged PR receipts. Exact tree parity with merged squash heads, followed by ancestry checks, proved 63 original heads integrated. Older source commits that were adapted rather than merged verbatim are tracked by the previous reconciliation receipts and the historical-acceptance-reconciliation card. Branch ancestry alone is not an unmerged-work count.

Clean integrated checkouts are removed only after rechecking status and excluding active process working directories and shared dependency providers. Environment symlinks can be removed with their old checkout; their external target is preserved. Hosting configuration and dependency providers remain until separately relocated safely. Git branches and recovery commits are retained. The dated cleanup receipt records every removed path and its exact head; the final PR records the final count.

Routine Kanban administration now explicitly uses the repository DB-backed service/CLI. It does not require generic Supabase documentation searches, UI automation, direct lifecycle row updates or repeated authorization questions.
