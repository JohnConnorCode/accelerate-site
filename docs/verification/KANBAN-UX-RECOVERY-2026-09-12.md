# Shared Kanban recovery evidence

Card: `universal-kanban-ux-standards` (`52260cd3-0d37-49d6-89bb-4ca79e8ca349`).
Frozen acceptance remains AC1–AC6, with local application browser verification.
Remote CI runs the locally served production application with fictional data;
this is not production verification or deployment.

## Reproduction

QA-only commit `32e9d073eb914be8c76dc6a68c1047cbc7629455` retained the exact
application source of published `49ddf2da90f09fca90f993731a5989e9be7088c1`.
[CI 34707960125](https://github.com/JohnConnorCode/accelerate-site/actions/runs/34707960125)
built successfully and reproduced 168 computed failures across 63 combinations:
Feature Board, Pipeline and Content Calendar, at 390/768/1440px, in all seven
registered appearances. Failures were exclusively enabled native snapping,
missing explicit board focus, and hidden tablet/desktop column controls.
Computed column/card spacing and overflow checks passed. The retained artifact
contains `admin-polish-qa/board-geometry.json` and viewport screenshots; the
Feature Board phone, Pipeline tablet and Content desktop screenshots were opened
and inspected. Prior submission branch `agent/universal-kanban-ux-standards` at
`36e37561` remains preserved.

## Shared changes and required final proof

The shared board removes snap behavior, exposes column controls at every width,
and restores explicit keyboard focus. Horizontal history restoration registers
stable board keys with the existing NavigationRuntime and its bounded numeric
receipt cache. Current 340px maximum columns and appearance styling are retained;
the stale 320px contract statement is corrected.

Existing polish geometry, interaction and navigation journeys cover the frozen
consumer/viewport matrix, all-theme read states, actual keyboard/pointer moves,
manual scroll retention and Pipeline detail/Back restoration. Tasks & approvals
at `/admin/work` is a list/action consumer and does not use KanbanBoard; the
canonical `KANBAN_BOARD_KEYS` registry has exactly the three reviewed boards.
These checks use the same page and read-region owners as authenticated routes,
with controlled fictional responses. Connected database behavior is unchanged.

Final exact-source CI and screenshot inspection remain required before submission.
No passing acceptance is inferred from this implementation or the baseline run.

## Documentation and inventory review

Reviewed and updated the Pipeline board and Content Calendar guides, shared UX
and navigation contracts, public changelog, responsive feature description and
keyboard-navigation FAQ. Existing Pipeline and Command Center overview links
still direct readers to the updated guides; their task descriptions remain
accurate. No route, mutation or AI business operation changes. Both existing
route inventories pass without a fingerprint refresh because their owned source
set is unchanged. Shared runtime source receives the navigation contract check
and browser history/retention proof.
