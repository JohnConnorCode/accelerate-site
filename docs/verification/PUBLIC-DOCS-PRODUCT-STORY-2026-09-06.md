# Public docs product story and plugin examples

Ticket: `public-docs-product-story`. Implementation base:
`b5bb32152d1ffe207d6785566dfc400d193134cf`. This is a local documentation
review by the implementing agent, not a deployment or provider certification.

## Delivered journey

The documentation landing, introduction, AI, integration and extension overviews
explain the open-source Command Center through ownership, connected context and
concrete workflows. The README and writing contract use the same positioning.
The broader agency offer remains distinct.

`/docs/plugins` introduces ten bundled examples with individual public pages.
Each guide covers purpose, a fictional example, setup, authority, cost,
disabling/recovery, current limits and the extension pattern. Source references
remain available. All ten manifests and their generated module records point at
these public pages. The docs verifier now rejects a bundled plugin with a generic,
external or missing individual guide; its regression is in the existing CI suite.

## Screenshot provenance

New PNGs under `public/images/docs/plugins/` were captured from this checkout's
actual admin components through `/demo/command-center/northline-roofing/` at
1440 × 1000 with reduced motion. They contain fictional scenario data only.
The capture browser blocked external origins and native `/api/` requests.
The development-tools overlay was hidden for the published captures; business UI
and fixture content were not edited. Existing Today and AI screenshots are reused
with explicit fictional-demo captions.

| Asset                     | Demo route / state                                                               |
| ------------------------- | -------------------------------------------------------------------------------- |
| `collections.png`         | `collections`: initial case workspace and last-observed balances                 |
| `radar.png`               | `radar/today`: supplied fictional opportunities and reviewed estimates           |
| `client-onboarding.png`   | `client-onboarding`: source selector and seeded task history                     |
| `meeting-commitments.png` | `meeting-commitments`: source selector and seeded task history                   |
| `reports.png`             | `plugins`: Business pulse enabled, Run report selected, simulated result visible |

The task history screenshots show seeded results, not a newly executed live
workflow. Captions state this. No provider action or real customer communication
was performed. Images use intrinsic dimensions, alt text, contextual captions and
full-size links. Published image assets and desktop/mobile docs captures were
opened for visual inspection.

## Validation

- `npm run verify:agent-contract`: passed.
- `npm run build:extensions` and `npm run verify:extensions`: ten manifests in sync.
- `npm run verify:docs`: 68 registered pages, zero source errors or warnings.
- `npm run docs:llms:check`: generated documentation index is current.
- `npm run test:docs-coverage`: all 17 tests passed, including individual plugin guide enforcement.
- Browser QA: 17 changed routes at 1440px and 390px, 34 successful route/viewport
  checks, image decoding and nonempty alternative text, no page overflow or page
  errors on the final run. Keyboard navigation from the landing reached the plugin
  index, which links to all ten individual examples. Reduced motion was enabled.
- Full ESLint and final whitespace/format checks are attached to the ticket.

Local QA artifacts are in `/tmp/docs-story-qa/`, with structured results in
`results.json`. The lint log is `/tmp/docs-story-lint.log`. The preview server was
run through `scripts/resource-run.mjs` and stopped after browser verification.
The first webpack compilation transiently returned a 500; the subsequent request
and final complete browser run passed. No production build was run, so
`verify:docs -- --strict` correctly reports missing build evidence. Production
prerender coverage and deployment remain unverified.

## Separately tracked existing failure

The invoice demo page failed before a usable capture: an operation result with
`invoiceId` but no currency reaches `money(result.amountRemaining, result.currency)`
in `src/app/admin/invoicing/page.tsx`. The browser reports that currency is required.
This is tracked in `invoice-demo-missing-currency`. No invoice screenshot was
published, and its new guide explicitly states that the current demo journey did
not pass this review. Repair and full provider/workflow verification belong to
that ticket, not to a claim that documentation proves the business operation.
