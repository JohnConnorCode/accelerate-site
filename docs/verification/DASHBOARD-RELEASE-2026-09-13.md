# Dashboard and completed-work integration

## Scope and source receipts

The founder requested a compact, actionable dashboard and production release of
completed agent work. Integration starts at published main
`c5ed4f55b7f693de4e180f010271b9d273810b55`. Existing worktrees and unfinished edits
remain intact. The read-only inventory covered 98 registered worktrees; its local
receipt is `/tmp/dashboard-release-worktrees.json`. The canonical board export is
`/tmp/dashboard-release-board.json`.
The local-branch inventory covers 324 branches, including 137 retained archive or
checkpoint refs and 44 direct historical PR receipts, in
`/tmp/dashboard-release-branches.json`.

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
- Combined production build and TypeScript passed on `e71ef0124b1e`; 469 static
  pages generated. The subsequent change only updates the operator browser test
  to use the new View actions control and adds this evidence.
- Combined theme sweep passed 56 preview combinations, 14 desktop/mobile
  workspace captures and 21 focused accessibility audits with zero violations.
  Keyboard, Escape/focus return, density persistence, blocked storage and reduced
  motion passed. Representative desktop/mobile screenshots inspected.
- The broad route run hit the 3 GiB process-group limit. Remaining routes passed
  in smaller three-route batches without raising or bypassing the resource cap.
- Production-build operator journey passed shared task edits, snooze/completion,
  exact approval inspection, source-linked activity, desktop/mobile, keyboard
  Escape and fictional isolation for two businesses.

The integration PR carries the final SHA-specific CI receipt. Merge tree parity,
schema application and canonical hosted release identity must be recorded after
their respective operations; this source report alone does not claim deployment.

## Initial production receipt and live verification follow-up

PR 100 merged as `a284d8d47c0ee8e79a6d42e02211321e69d12ea0`, with exact tree
parity to verified candidate `1e6546e37085e668f84fc35ca9b5f8188e07b321`.
CI 34737586399 passed every prerequisite. Its aggregate runner stalled for more
than 17 minutes; the supported single-job retry passed on the same SHA, retaining
the passing prerequisite results. No protection or check was bypassed.
Postiz service CI 34737586400 passed. PR 94 was closed as proven incorporated;
all worktrees and unfinished branches remain intact. Nine completed board items
were accepted with revision-checked canonical review receipts.

The production-configured webpack artifact deployed as
`dpl_9L9a7HHn6wnRJZMjcLZBGaENRPGG`, READY at `https://www.acceleratewith.us`.
The canonical document returned only release ID `1e6546e37085`. All three pending
migrations were applied through the checksum ledger after compatible source was
live; all 95 are present. Schema verification passed 775 requirements and
recorded receipt `19f67e51-825a-4d2c-9aba-e72c4e8be6e3`.
The authenticated Firefox session rendered the compact dashboard with real
workspace data. Existing missing-coworker/automation warnings remained visible.
The canonical demo passed all 15 initial dashboard cases.

Real sparse data exposed a remaining presentation defect: ordinary flex rows
reserved a large gap below a short primary card when its neighboring support
card was tall. The release follow-up uses native independent desktop stacks,
separated by full-width modules. Narrow layouts retain saved DOM and keyboard
order. There is no measurement engine, layout dependency, data migration or
change to saved documents. A retry outcome already present in its reason is
shown once, and the mobile default view label has room to render completely.
The Today guide now describes the current controls and layout.

The expanded dashboard regression includes uneven column heights, exact desktop
section gaps, narrow-screen module order, repeated-outcome suppression and mobile
view-label width, alongside the existing saved-view and inspector journeys.
Final follow-up CI and deployment receipts belong to its PR; the initial release
receipt above is not proof that the follow-up is live.

## Content-first replacement and shared motion

The founder rejected the equal-weight card composition and approved an
action-first plan, using Linear's priority inbox and Shopify's task-oriented
Home as interaction references. The replacement keeps canonical actions and
saved documents. Untouched built-in views lead with decisions and follow-up,
followed immediately by business changes and separately labeled operational
alerts. Two pipeline facts, upcoming commitments and automation are supporting
context. Current automation is bounded to three visible records, with full
details and completed results disclosed separately. Duplicate AI prompts and
empty App promotions are absent from the standard layout. Distinct section
icons do not become repeated list icons. Customized views retain their order.

The reported sparse/error-heavy state is now an explicit browser fixture.
The production-build dashboard passed 28 state/viewport combinations, including
1100px and the reported one-task/two-alert/four-pending/one-completed case.
Production screenshots were opened at desktop and mobile sizes; task editing,
snooze/completion, approvals, source context and fictional isolation passed.
The guide screenshot is generated from that production-build fixture.

Shared motion inspection found nearly opaque entrance keyframes (92–94%), an
arbitrary wrapper-depth stagger, and an async entrance conditional on a visible
placeholder. AdminRouteStage now registers semantic groups before paint and
newly inserted content during mutation delivery. One CSS sequence provides a
true fade and six-pixel rise, with 60ms stagger capped at 180ms. A WeakSet keeps
existing sections from replaying on refresh. Semantic CSS also covers markup
before hydration; no full-route blur or imperative animation engine was added.

The first navigation verification server was mistakenly started without the
artifact's deployment ID. This caused full document reloads, lost in-page
instrumentation and incorrect focus handoffs. Those failed receipts remain
available. Subsequent runs must pass the identity read from the built server
configuration; changing application caching or weakening navigation assertions
is not a remedy. Final frame, persistent-profile, CI and release receipts remain
separate from the implementation evidence above.

With the correct server identity, the persistent-profile sweep passed 120
navigations with zero document reloads, stale cached RSC responses or runtime
errors. The focused Back journey also identified an actual Today lifecycle
defect: the mount-time scope reset discarded an already-cached snapshot. Today
now initializes from the scoped cache and resets only when its scope changes.
The browser regression waits for committed content before recording scroll and
checks that Back returns to usable data at the saved reading position.

The exact f8cdb523a8de production build passed all 28 Today cases and the
operator journeys. The five-case animation filmstrip and navigation runtime
checks passed, including slow reads, mobile throttling, reduced motion and Back
scroll restoration. The 120-navigation persistent-profile sweep also passed with
zero document reloads, stale RSC responses or runtime errors. The filmstrip's
desktop target was corrected to the existing Admin navigation landmark (Primary
navigation belongs to the mobile dock). Local production checks load the linked
production environment as well as the artifact deployment ID; a missing runtime
service credential correctly fails closed and is not an application regression.
These receipts are in `/tmp/dashboard-final`, `/tmp/dashboard-final-operator`,
`/tmp/accelerate-navigation-filmstrip`, `/tmp/accelerate-navigation-runtime`,
and `/tmp/accelerate-persistent-profile-qa`. Merge and delivery still require the
final SHA-specific CI and production receipts.

The broad route sweep caught a hydration warning at the AI workspace's nested
Suspense boundary: parent entrance registration had added attributes before the
child hydrated. Registration now writes only a route-scoped CSS stylesheet and
retains delays in a WeakMap. It never mutates React-owned content attributes.
The failing route and complete route matrix must be rerun against this fix.
