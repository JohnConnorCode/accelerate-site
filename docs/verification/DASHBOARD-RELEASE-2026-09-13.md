# Dashboard and completed-work integration

## Scope and source receipts

The founder requested a compact, actionable dashboard and production release of
completed agent work. Integration starts at published main
`c5ed4f55b7f693de4e180f010271b9d273810b55`. Existing worktrees and unfinished edits
remain intact. The read-only inventory covered 98 registered worktrees; its local
receipt is `/tmp/dashboard-release-worktrees.json`. The canonical board export is
`/tmp/dashboard-release-board.json`.

Included completed sources:

| Work                                                            | Pinned source                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Core admin composition, professional themes, spacing and motion | `3da21235ba3a1dfd0f322b392860552c2aab3d06` (includes `7c9ab57` and `251a0d78`) |
| Generic autonomy-policy write recovery                          | `d12bec6d0b7de48ee004cfbfb0f49528e47fa7f9`                                     |
| Optional bundled Postiz service                                 | `b9ec834717d73ff61b05c1af5e51bbcfaec8c08b` (PR 94)                             |
| Actionable Today dashboard                                      | `0857f922832274880be68623c1e6cffd9b99b559`                                     |

Published main already contains the completed unified task-write work (PR 99),
proposal decisions and neutral runtime (PR 98), Social Marketing adapter (PR 89),
retained checkpoints (PR 88), and advisory WIP policy (PR 84). Older squash-merged
branches are not remerged merely because their source SHAs differ from main.

Excluded unfinished or rejected work: installation editor, unfinished command
center redesign, Architect generated operations and review simulation, source
authority and decision memory, phase-B proof, roles/permissions, and the active
checkout's form-builder edits. PRs 81 and 82 remain separate. Postiz is opt-in;
real LinkedIn authorization and publishing are not claimed by this release.

## Dashboard decisions

Following [NN/g's visual hierarchy principles](https://www.nngroup.com/articles/principles-visual-design/),
the dashboard leads with operator decisions and actionable business facts.
One title replaces the three-line introduction. View selection, customization,
secondary actions, refresh and Help share the available heading space. The first
card uses the same surface as other cards, with four linked business measures.
Lists have no repeated decorative icons. Existing data warnings, approval paths,
custom layouts, keyboard behavior and tenant boundaries remain.

The combined theme work owns shared composition, spacing, motion and surfaces.
Conflict resolution retains newer main's contextual Help positioning and Kanban
scroll behavior. Compact dashboard styling lives in `admin-components.css`, not
a competing global override. The production build also exposed invalid extra
Next route exports in the proposal adapter; existing handlers are now exported
as GET/POST and reused by the tenant adapter without changing business logic.

## Verification before release

- Dashboard worker: production webpack build and TypeScript passed; proposal
  lifecycle passed 17 checks; lint, runtime boundaries, docs and Today contracts
  passed.
- Integrated dashboard: all 15 combinations of 1440/820/390px and busy, sparse,
  one-item, empty and partial data passed. No overflow, page errors or protected
  demo requests. View editing, persistence, duplication, keyboard and inspector
  interactions passed. Screenshots inspected at desktop and mobile sizes.
  Receipt: `/tmp/dashboard-integrated/results.json`.
- Integrated native PostgreSQL suite passed, including policy duplicate
  reproduction before migration, concurrent writes, reapproval, immutable
  history, hard floors and tenant/role isolation.
- Integrated verification-workflow suite passed 15 cases and 64 aggregate states.
- Theme and token contracts passed. Public repository counts were reconciled to
  95 migrations, 242 check scripts and 895 TypeScript source files.

The integration PR carries the final SHA-specific CI receipt. Merge tree parity,
schema application and canonical hosted release identity must be recorded after
their respective operations; this source report alone does not claim deployment.
