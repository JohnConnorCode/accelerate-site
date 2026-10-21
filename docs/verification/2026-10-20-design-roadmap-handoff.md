# Design roadmap implementation handoff

John requested takeover of the eight passes in
`docs/planning/DESIGN-ROADMAP-2026-10-20.md`. Source implementation is committed
on `design/roadmap-20261020`. Rendered acceptance remains pending; this is not a
release-readiness or deployment receipt. The integrator owns the release
candidate, final CI, visual acceptance, merge and deployment through
[PR #296](https://github.com/JohnConnorCode/accelerate-site/pull/296).
That PR and its external verification receipts are the authority for the final
result; this document records the pre-release handoff.

## Source and ownership

- Base: `a2675f5a`, the integrated brand candidate.
- Implementation: `69049a93`.
- Strict activity lookup checks and successful application build: `c021510f`.
- Tooling corrections: `a526c266` and `fcb939ae`. These correct Work QA's
  populated default, isolate analytics, settle captured content and reserve
  published documentation images for their canonical producer.
- Corrections from image review: `a0b5cfaa` contains the style-guide flow and clears
  its fixed header; `504774a3` adds the planned activity stream to the bespoke
  Nonprofits route, which does not use `VerticalPage`. The integrator accepted
  them as `9d5f3fed` and `2562ee4c`, respectively.
- Isolated checkout: `.agent-worktrees/design-roadmap-20261020`.
- The integration owner accepted the implementation for integration and cloud
  verification. Its release candidate and the original shared checkout remain
  separately owned.
- First full CI candidate: `d1283a9e912f4ce9865c60f3d1705a2609044416`,
  tree `57b324b4f7a64a53b727f35119d2c346b4a4ac7c`. It includes the two page
  fixes, 56 reviewed public images and the restored Modules guide figure.
  [CI 39527535567](https://github.com/JohnConnorCode/accelerate-site/actions/runs/39527535567)
  passed the application build, but its checks already report failures. It
  must not be cited as a green release run.
- Subsequent integrator corrections include neutral-export dependency and
  generated-reference repair (`6ae3d414`), checkout screenshot readiness
  (`7c33d907`) and the shared flow animation fallback (`3b63484e`). The latter
  preserves the homepage's timing and supplies the global easing elsewhere;
  the guide's QA now checks a real pulse with ordinary motion enabled.
  Final CI and rendered acceptance of the complete candidate remain pending.

## Changes

| Pass                    | Before                                                                                                          | After                                                                                                                                                                                                                                                                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Industry proof          | Trade heroes had no activity stream.                                                                            | All 20 trade pages have a fictional six-event inquiry-to-outcome story with people and system events. `VerticalPage` renders the shared pages; the bespoke Nonprofits page receives the same `ActivityStream` beneath its photo hero. The industry index is separate.                                                                         |
| Retired code and colors | Unused consoles, effect layers and a channel palette remained; live consumers depended on legacy color aliases. | Nine unused effect/content files and `MagneticButton` are removed. Live consumers use the equivalent neutral tokens; legacy gold, aurora, mesh and glow color aliases are removed. No Three dependencies were present to remove.                                                                                                              |
| Buttons                 | Component styles, CSS buttons and magnetic wrappers differed.                                                   | `Button` uses the shared `.btn` recipe with existing variants, sizes and ref/props support. Booking links retain conversion handlers and booking attributes. Magnetic hover and tag/ghost blur are removed. Final CTA links use native links without nested buttons.                                                                          |
| Style guide             | The reference described retired accents and typography.                                                         | `/style-guide` shows runtime color/type values, current font faces, shared buttons, the activity stream, the labeled flow and the four modes. Follow-ups clear the fixed header, contain the desktop flow, remove its phone gap and supply its animation easing. It remains noindex.                                                          |
| Product page            | Real captures were referenced but missing, and cross-module activity was absent.                                | The real-capture catalog has dedicated refresh filenames, and Command Center has a six-event stream across Conversations, Contacts, Pipeline, Invoicing and Work. Shared product headings use type tokens. The integrator imported seven genuine product captures with source/hash receipts.                                                  |
| Admin tokens            | Four large raw-palette budgets, white tints, a line-limited header guard and a marketing color bridge remained. | Conversations, Contact imports, Campaigns and Analytics budgets are zero; Integrations falls from 44 to 32. Forty-one white tints use admin tokens. Header checking spans multiline JSX. Shared fields/notifications have semantic local roles supplied by admin tokens; the old bridge is removed.                                           |
| Module identity         | Plugins and Integrations maintained separate card layouts and discovery lists.                                  | One `ModuleCard` renders all 13 current extension manifests and the core registry consistently, with status, owner, autonomy and receipt context. Configuration-only modules link to Integrations. Missing owner/history is explicit; only a supplied system receipt fills the signal mark. A new-manifest fixture renders without page code. |
| Smaller polish          | Contact rows had separate history buttons; seven metrics were handmade; Work QA expected retired controls.      | Contacts use `AdminRecordRow` with a native focusable link. Pipeline and Clients use compact `StatCard` metrics, preserving active-client filtering and mobile truncation. Work QA preserves My work, tests unmatched search and clearing, and uses the canonical production start command.                                                   |

## Passed evidence

- `npm run build` at `c021510f`: compiled, typechecked and generated 585 pages
  in the default neutral distribution profile. This was source/build evidence;
  neutral builds intentionally omit branded documentation figures.
- `npm run typecheck`: passed after adding explicit missing-activity checks.
- `npm run verify:agent-contract`.
- `npm run verify:guardrails`, including brand, positioning and Work portfolio.
- `npm run verify:admin-tokens`: all tokens defined, four target budgets zero,
  no duplicate control/radius recipes, four theme contracts and public CSS
  variable resolution passed.
- `node scripts/admin-ai-inventory.mjs --check`: 142 routes, 124 mutation
  handlers and 21 semantic operations.
- `npm run test:admin-route-inventory`: 68 pages, 436 source fingerprints and
  seven inventory regression cases. Changed boundaries were reviewed before
  refresh; no API or domain writer changed.
- `npm run test:design-roadmap`: 20 streams, 13 manifest cards, new-manifest
  rendering and multiline header enforcement.
- `node --import tsx scripts/test-chicago-industries.tsx`.
- `npm run test:plugin-modules`: 35 modules, including 13 extension manifests.
- `npm run test:admin-themes`: four modes, contrast, portable definitions,
  density and stored appearance compatibility.
- Full lint and strict application/test-source typechecking passed in
  `39527535567`. Formatting failed; the integrator committed corrections.
  The complete candidate still requires final CI confirmation.
- `git diff --check` and fast offline commit checks passed.

The first production build caught strict unchecked-index errors in the new
activity lookup and fixture test. These were corrected in `c021510f`; the next
production build passed. No local browser or server was started on this branch.

## Integrated cloud evidence

[Cloud run 39522935695](https://github.com/JohnConnorCode/accelerate-site/actions/runs/39522935695)
built `2bef924d1570df7d336cc2e4c1df6d29c58bc11d` with
`NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded`. Its production build passed.
The overall run failed and is not final acceptance.

- The canonical producers captured seven product images, six demo-chooser
  images, forty generic documentation images (including the new module-card
  view) and three customer-workflow guide images: 56 validated captures.
  JSON receipts record the source commit, capture time and SHA-256 hashes.
  The integration owner completed image review, import and guide restoration
  in `d1283a9e`. The later public-page and flow-timing fixes do not change
  the admin visual rules represented by those images.
- The customer workflow, ten representative core routes and the four-mode
  accessibility/keyboard groups passed.
- The matrix passed 205 of 288 cases. Of 83 failures, 76 were an uppercase
  presentation versus case-sensitive label assertion, three were Calendly
  storage-access denials, and four exposed the missing Nonprofits stream.
  The integrator corrected the assertion and records only the exact provider
  denial as a warning when a Calendly frame exists. Other errors still fail.
- Work's updated search, clear, edit and completion steps ran before a stale
  Pipeline layout-button selector stopped the journey. The actual controls
  are List and Board in the Workflow layout group; the integrator corrected
  those selectors without changing the application controls.
- All ten PNGs in the focused review artifact were opened: the four Work
  appearances, the Work desktop overview, the Paper New Lead dialog and four
  style-guide width/mode captures. Work and the corrected shared dialog
  buttons were visually sound. The guide exposed two genuine defects: the
  title was behind the fixed header, and the flow overlapped color swatches.
  Both are corrected in `a0b5cfaa`; new rendered evidence is still required.

The initial branded run caught a missing module-card documentation image that
the neutral build could not see. The integrator deferred that figure, captured
the genuine image and restored the figure with the verified file in
`d1283a9e`. No placeholder or validation bypass was introduced.

In `39527535567`, the application production build, both full-product forks,
lint, strict typechecking, design/token guards, route inventories and
documentation checks passed. Formatting, a stale generated Collections label
and missing neutral-export dependencies failed. The core suite stopped at
the generated-reference mismatch, so later tests in that chained command
cannot be counted as run. The integrator corrected those inputs and reported
passing design-roadmap regression and all nineteen record-permission checks.
These focused results do not replace the final full CI run.

## Integrator-owned acceptance

The shared machine reservation is held by another release. All owned build
processes exited; the existing preview was preserved. The integration owner
is handling cloud capture and QA. Repository resource locks do not grant the
separate machine reservation. No local retry is queued.

The integrator will finish the following coverage in PR #296. Do not start a
second build or capture job from this handoff. Final acceptance belongs in the
PR and its external receipt, so this tracked document need not change after
the release source is frozen.

1. Finish the integrated immutable candidate and start its production server
   using `npm run start`. When a tooling/docs commit follows the build, supply
   `NEXT_DEPLOYMENT_ID` from `.next/required-server-files.json`'s
   `config.deploymentId`.
2. Confirm the final source and image checks pass with the imported cloud
   captures and restored Modules documentation figure. The final guide and
   public-page and flow-timing corrections do not alter those admin visual rules.
3. Re-run `npm run qa:design-roadmap`. It covers 288 cases: 28 marketing routes
   at two widths and two appearances, and 22 admin route/states at two widths
   in all four modes. It records console errors, streams, signal placement,
   module anatomy, metrics, contact keyboard navigation and a report receipt.
   Output: `output/playwright/design-roadmap/results.json` and route PNGs.
   The corrected guide must clear the fixed header and contain its desktop
   flow within its own stage; the phone stage must take no space. Nonprofits
   must satisfy the same six-event stream assertion as the other nineteen
   trade URLs. The guide must also demonstrate an animated wire pulse under
   ordinary motion, then return to reduced motion for its still capture.
4. The integrator's single docs producer owns
   `public/images/docs/workspace/module-cards-20261020.png` from
   `/demo/command-center/northline-roofing/plugins`, 1440 by 1000, Accelerate.
   The matrix writes diagnostic images only. `DESIGN_ROADMAP_QA_OUTPUT` can
   select its artifact directory. It skips storage initialization in child
   frames and waits for finite main animations and row opacity before photos.
5. Complete `qa-marketing-positioning.mjs` with `QA_BASE`, and `qa-admin-demo.mjs`,
   `qa-workspace-layout.mjs` and `qa-home-hero-timing.mjs` with
   `PLAYWRIGHT_BASE_URL`. Use the fictional demos, inspect all captures and
   check keyboard, reduced-motion and error states. Browser checks require the
   machine reservation or a cloud runner; no local retries are queued.
6. Capture files must exist before final `verify:docs`, docs search/LLMS and
   image-reference checks. The docs text and changelog were updated; public
   descriptions and FAQ reflect module inspection. Regenerate the LLMS index
   if integration changes the docs again.

Source/static success is not browser acceptance. A before/after image comparison
for dead-code removal has not been performed. Do not claim visual completion
until the integration evidence establishes it.

## Preserved boundaries

- About's resume block is unchanged and still requires John's decision.
- Demo-launcher `*-20261020-r2.png` assets remain the integrator's existing
  capture/import work. The new product capture names avoid competing ownership.
- No schema, provider, authentication or business-operation API changed.
- No merge or deployment was performed from this implementation branch.
