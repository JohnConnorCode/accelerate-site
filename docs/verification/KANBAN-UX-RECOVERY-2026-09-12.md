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

Candidate `309f4ace` in CI `34713384023` passed the complete interaction
journey, including pointer and keyboard moves for every board and all nine
consumer/viewport retention cases with actual Pipeline detail/Back restoration.
The controlled read-state matrix then reproduced mobile Feature Board loading
overflow: fixed-width skeleton bars exceeded the three metric cells. The shared
skeleton now constrains bars to their containing width and permits metric cells
to shrink. State measurements and screenshots are retained before assertions.
The same run separately hit the unchanged supervisor concurrency test's five-second
SQLite lock timeout. Its unchanged rerun passed in `34715258126` at `94d2dee9`.
That candidate also passed all 441 read-state measurements (seven appearances ×
three boards × seven states × three widths), with zero overflow or browser errors.
Representative screenshots were opened across all seven appearances: mobile
Feature loading and retained-error, tablet Pipeline initial-error and empty,
desktop Content retained-refresh/recovery and Feature ready. The loading bars
remain contained; errors retain readable retry guidance; retained data stays visible.

The remaining failed Content keyboard fixture sent ArrowRight before dnd-kit's
deferred keyboard listener attached (the screenshot shows native 40px scrolling).
The fixture now yields that setup turn and requires the target insertion marker
before dropping, preserving the saved-column assertion. Final exact-source CI
remains required before submission; partial suite success is not full acceptance.

## Documentation and inventory review

Reviewed and updated the Pipeline board and Content Calendar guides, shared UX
and navigation contracts, public changelog, responsive feature description and
keyboard-navigation FAQ. Existing Pipeline and Command Center overview links
still direct readers to the updated guides; their task descriptions remain
accurate. No route, mutation or AI business operation changes. The shared loading
skeleton remains a presentation-only route dependency; its reviewed route-inventory
fingerprint is refreshed. The AI inventory remains current. Shared runtime source
receives the navigation contract check and browser history/retention proof.
