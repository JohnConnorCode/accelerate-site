# Admin appearance and Kanban verification

Work: `admin-shell-design-system` (`8b5bbaac-0f75-4818-bace-739420dc57ef`).
Worker: `agent/admin-polish-themes`, based on the recorded application checkpoint
`36e2909a3f8c0f19c4f57f13e6225a8fe842d057`. The old dirty worktrees remain intact.
This is local implementation evidence; production release requires separate review.

## Changes

| Before                                                                           | After                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public square radius utilities leaked into admin cards and controls.             | Shared radius utilities resolve appearance tokens. Retained pages, Today lists, dialogs and controls follow the same surface rules.                                                             |
| Signal mixed public text colors and OS-based dark utilities.                     | Semantic aliases cover the shell and portals; the selected theme's mode determines dark utilities. Muted text, placeholders, counts and status colors remain readable.                          |
| Theme additions required coordinated CSS and picker edits.                       | One JSON registry generates built-in CSS, picker entries and the verification matrix.                                                                                                           |
| Users could only choose built-in appearances.                                    | Branding previews and saves a bounded portable theme, imports/exports JSON, and opens the existing governed AI branding proposal flow. Validation rejects unreadable or executable definitions. |
| Workspace appearance state could share a cache across contexts.                  | Branding/theme queries are scoped by workspace or demo scenario; custom themes propagate to portals and persist through the existing branding service.                                          |
| Loading waited for sequential exit/entrance effects.                             | Delayed regional placeholders skip fast reads; cached content stays mounted, refresh failures retain the last snapshot, and reveals use short opacity/translation transitions.                  |
| Kanban toolbar controls wrapped awkwardly and cards became too narrow.           | Container-based columns, readable card titles, compact internal grips, wrapping filters and a phone column pager support swipeable columns with the next column visible.                        |
| Drag overlays were clipped by container contexts and changed card geometry.      | A themed body portal preserves card geometry, isolates overlay controls and settles with a short reduced-motion-aware transition.                                                               |
| Hover reordering oscillated and keyboard targeting could choose column frames.   | A stable insertion model shows a placement marker, targets cards/empty columns, and computes keyboard placement from logical order when scrolling.                                              |
| Failed stage/order writes could roll back an already committed stage.            | Separate commit results reconcile authoritative state. An unresolved read blocks further movement and provides a refresh action.                                                                |
| Dismissal used native confirmation and reused discarded form state.              | Shared themed confirmations and fresh editor sessions preserve cancelled drafts, discard explicitly, restore opener focus and retain exit animation.                                            |
| Demo Pipeline/Content writes could report success without retaining order/edits. | Scenario state persists those changes, validates moves and reuses terminal-stage policy. Content errors stay visible and retryable.                                                             |
| Visual verification depended on manual spot checks.                              | Repeatable theme, mouse/keyboard, touch, editor and navigation journeys run in the existing CI browser job and retain artifacts.                                                                |

## Rendered evidence

`/tmp/admin-polish-qa/results.json` records five distinct appearances at 1440×1000,
with 322.656px Pipeline cards and radii of 16, 14, 14, 11 and 20px. Phone captures
use 390×844 and assert no document overflow. Axe reported zero color-contrast
violations on Pipeline, Today, Work and Content in each appearance (20 audits).

Opened and inspected captures include all five desktop and phone appearances,
Signal Today and Work dialogs, mouse overlays, touch movement, and custom-theme
preview/dialogs. The folder also contains the individual contrast reports and
interaction, touch, editor and navigation receipts.

The interaction suite proves same-column and cross-column saves, cancellation,
partial stage/order failure reconciliation, reload persistence, keyboard order,
card detail/back navigation, unsaved edit confirmation and content editing.
The touch suite uses native touch events with normal and reduced motion; it
proves handle dragging, card-body swiping and the stage control alternative.
Theme tests prove save/reload, exact JSON export, invalid import rejection,
portal inheritance and scenario isolation. AI branding tests include the custom
definition in the actual preview/propose/approve/readback contract and retain
its existing stale/replay/tenant-denial coverage.

Navigation sampling covers a 750ms content read and a delayed route response,
with the page heading retained, then a cached return without a visible skeleton.
Reduced-motion repeats the same flow. Failure recovery keeps usable cards visible.

## Verification results

The complete core contract suite, full lint (after adding the stable dialog setter
as a shortcut effect dependency), navigation source contract, theme/token contract,
agent contract, copy guardrails, public docs validation and generated docs index pass.
Local API contract checks ran against `http://localhost:3045`; unknown-token reads
used the configured service and all mutation probes were rejected before writes.
Those API checks do not cover a second authenticated user; tenant/approval denial
and stale transitions are covered by the service fixtures named above.

All changed files pass formatting. The full-repository formatting check reports
17 untouched pre-existing files, primarily Site Studio and generated backlog source.
They remain unchanged. The original Turbopack build cannot resolve the reused
`node_modules` symlink outside its root; the final production validation uses the
supported `--webpack` build option with the same source and type checking enabled.

## Verification scope

The refreshed admin AI route inventory includes three Site Studio routes already
present in the recorded base. Their handlers were read and use existing guarded
services. No Site Studio business behavior or new mutation route was introduced;
this inventory is a source inventory, not a new semantic-parity claim.

Resource-gate stops caused by unrelated builds exhausting disk/memory are retained
in the local logs. They are failed attempts, not passing verification. Only the
successful final checks belong in the board submission. Servers and browsers
started by this work are closed by the gated runner.

Final command results and the exact candidate SHA are attached to the live work
card at submission. No production deployment or self-review is part of this work.
