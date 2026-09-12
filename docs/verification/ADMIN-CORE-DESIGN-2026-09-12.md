# Admin core design verification — September 12, 2026

Task: `admin-core-coherent-design`. Base: `d6d9831ef80040bc9be29092a4f31fda2fdc68ef`.
This is local implementation evidence; review, integration and deployment remain
separate. All browser records belong to the fictional Hearthline Realty demo.

## Result

| Before                                                                | After                                                                                                                                        |
| --------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin recipes embedded in public globals, repeated control dimensions | `admin-foundations.css` owns scale and timing; `admin-components.css` owns shared recipes, with a guard against new admin recipes in globals |
| Fixed page tracks and Today spans could leave unused columns          | Five route compositions plus wrapping primary/support modules reclaim absent panels without changing saved order                             |
| Different field, action and table sizing across older pages           | Native consumers adopt the same field, action and table recipes; semantic status colors inherit the selected theme                           |
| Appearance and spacing had no common independent control              | Comfortable/Compact preference persists independently of seven existing theme IDs and custom version-1 theme definitions                     |

Paper now uses a warm canvas, charcoal navigation, cobalt actions and layered
surfaces. All seven presets remain available. This delivery establishes the core;
it does not claim a completed redesign of Material or macOS identity.

## Browser evidence

The repository Playwright runner owns its server and browser through the shared
resource gate. Compilation runs in sequential route batches to stay inside the
machine resource budget. The main final run passed 84 route/viewport checks
(42 routes at 1440px and 390px), recording document and main-area overflow,
composition ownership and browser errors. Supplemental checks cover proposals,
client/contact detail navigation. Website editor verification is recorded separately below.

The development-only component preview was captured at 390, 768, 1440 and 1920px
for all seven themes and both densities: 56 combinations. Fourteen focused axe
reports at desktop width found no contrast, label or button-name violations.
These are scoped audits, not a claim of complete WCAG conformance.

Assertions cover optional-panel removal, density persistence after reload,
cross-tab synchronization, unavailable local storage, empty content, dialog
Escape and focus restoration, and reduced-motion context. The preview uses
production primitives and is unavailable outside development.

Opened and inspected screenshots include Today desktop, contacts mobile,
conversations mobile, settings desktop, contact detail mobile, Paper mobile,
Night desktop, Material desktop, macOS desktop, Studio tablet and Frost wide.
The inspected pages retain clear hierarchy and no viewport-wide horizontal
scroll. Tables retain internal scroll where required.

Local artifacts:

- `/tmp/admin-core-qa/results.json` and `batch-0` through `batch-6`
- `/tmp/admin-core-qa/batch-6/preview-*.png` and `accessibility-*.json`
- `/tmp/admin-core-supplement/results.json` and CRM detail screenshots
- `/tmp/admin-core-editor/site-website-1440.png` (intermediate editor inspection)
- `/tmp/admin-core-final-tree-qa.log`, `/tmp/admin-core-supplement.log`,
  `/tmp/admin-core-editor-final.log`, `/tmp/admin-core-editor-only.log`

## Recovery observed during verification

An initial preview autofocus assertion exposed use of native autofocus where the
shared dialog expects `data-admin-autofocus`; the preview now follows that
contract. A long single-compiler route sweep hit Next's development restart, so
the runner now releases the compiler between bounded batches. A sandboxed email
iframe intentionally denies storage; fixture initialization now handles that
restriction without suppressing product console errors. Resource-gate refusals
were retained and other workers were allowed to finish; no resource limit or
ownership bypass was used. Two supplemental editor runs stopped when system-wide
memory availability fell below the gate threshold; their passing desktop portion
is not counted as a completed desktop/mobile run. Inspection also caught an overly
strong editor button recipe, corrected to secondary tools, primary Save draft and
explicit selected-tab styling with a computed-style regression assertion.

## Scope and remaining limits

No database schema, business service, API authorization or public marketing
redesign is included. Existing Today saved layouts and local view density remain
compatible. Tenant and demo paths share the same route-stage classifier and core
components; connected tenant data and production behavior were not exercised.
Public workspace guides, changelog, Command Center descriptions and generated
LLM documentation index describe the new density control. The contributor guide
records the owning tokens and compositions for future work.

## Source checks

Passed on the final relevant source tree:

- `npm run verify:agent-contract`
- `npm run lint` (through the resource gate)
- `node scripts/verify-admin-tokens.mjs`: 65 used tokens, seven presets, color and radius guards
- `node --import tsx scripts/test-admin-core.ts`: route composition normalization
- `node --import tsx scripts/test-admin-themes.ts`: contrast, round trips, invalid definitions and legacy compatibility
- `node --import tsx scripts/test-admin-demo-contract.ts`
- `node --import tsx scripts/test-navigation-runtime.ts`
- `NODE_OPTIONS=--conditions=react-server node --import tsx scripts/test-today-workspace.ts`
- `npm run verify:docs`: 77 pages, no errors or warnings
- `npm run docs:llms:check`: generated index current
- `git diff --check`

The Today validation is its scoped source contract, not the PostgreSQL integration
suite; this change does not alter its persistence service or schema.

## Production build

The local `npm run build -- --webpack` attempt was stopped by the shared resource
monitor at 15% system memory availability before compilation completed. It is not
a successful build receipt. Remote CI verification is required before handoff;
its existing website-editor journey now asserts primary/secondary and selected
section differentiation on the rendered production application.

The GitHub runner successfully built and typechecked implementation commit
`7a4ddc00df2992b2386b72147e797ca7f58d8fa7` in
[CI run 34702667808](https://github.com/JohnConnorCode/accelerate-site/actions/runs/34702667808).
That run also identified stale admin source fingerprints and open-source counts.
The route boundary review found no new business operations or changed adapters;
the refreshed inventory covers 56 pages and 337 sources. Recomputed public stats
now reflect 235 checks and 875 TypeScript source files (167K lines). Both scoped
inventory checks pass after correction. The final handoff evidence pins the
subsequent commit and its CI receipt.

The first broad production browser run exposed a duplicate helper declaration in
the newly added editor assertion, preventing that journey from starting. The
assertion now appears once; both `qa-website-editor.mjs` and `qa-admin-core.mjs`
pass `node --check`. The affected later CI attempt was superseded by the corrected
script. Product source is unchanged by this QA-only correction.
