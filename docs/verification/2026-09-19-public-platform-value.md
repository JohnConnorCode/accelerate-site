# Public platform value and workflow recipes

Reviewed 2026-09-19. Scope: public Command Center product page, fictional demo chooser, documentation and all ten industry pages. Implementation uses the existing brand, routes, demo runtime and published-site override boundary.

## Presentation changes

| Before                                                                             | After                                                                                                                                    |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Product sections primarily enumerated platform internals                           | Connected customer workflow, four illustrated business jobs, extension path and clear next steps for business users and builders         |
| Dense capability interactions obscured their value                                 | Visible outcome summaries, searchable descriptions, category buttons, native keyboard disclosures and useful empty state                 |
| Demo chooser used a separate visual treatment and simulated story                  | Shared editorial typography, neutral theme tokens, six real screenshots, recognizable tasks and direct workspace links                   |
| Docs entry relied on directory browsing                                            | Equal business and builder starting paths, featured recipes, real workspace illustration and retained full directory                     |
| Industry pages lacked composed platform workflows                                  | Two concrete recipes on every industry page, with shared metadata and links to the complete guides                                       |
| No cross-industry recipe library                                                   | Twenty guides with ingredients, setup, numbered steps, saved result, adaptation and recovery, plus a searchable library                  |
| Several screen guides had no visual reference                                      | Added existing verified fictional captures and five new local captures for missing views                                                 |
| Documentation mixed architecture, setup and promises of automation                 | Task-oriented introductions, clearer setup and result checks, corrected plugin defaults, tool counts, source coverage and approval rules |
| Mobile recipe ingredients inherited prose list bullets                             | Scoped chip layout that preserves wrapping and removes conflicting list styling                                                          |
| Product section rail ignored reduced motion                                        | Immediate reduced-motion state changes and an accessible current-section marker                                                          |
| Old demo marketing QA assumed the retired story                                    | Existing QA entry delegates to the comprehensive public-page and demo-launch verification                                                |
| Public search metadata and generated docs listing described the previous structure | Updated product description, recipe discovery, sidebar icons, MDX components, changelog and regenerated docs index                       |

## Accuracy review

The review distinguishes modules, plugin behavior and provider connections. It removes fixed tool counts, blanket automatic trust promises, guaranteed historical ingestion, automatic transcripts and other capability wording unsupported by the current source. It corrects Site Studio's default enablement, contact review behavior and revenue terminology. External effects retain human approval and separate execution/delivery evidence.

The full conceptual guide now follows a connected business workflow and the platform's reusable building blocks. Technical references retain their source paths and supported implementation contracts. Planned in-app App authoring stays explicitly planned. Recipes use manual composition of available features; they do not claim one-click installation or industry-specific connectors.

## Verification

- Production build and TypeScript: `CIRCLE_NODE_TOTAL=3 npm run build -- --webpack`, passed, 501 static pages generated. Webpack is required by this checkout's reused dependency symlink; no dependency changes were made. Next.js uses two static-generation workers for this check; existing middleware/Edge warnings remain.
- Lint, agent contract, strict documentation validation and generated-index parity passed.
- Copy checks: house style, positioning and fabricated claims passed.
- Search, admin demo and Command Center demo contracts passed. The Command Center contract also checks twenty unique recipes, two per industry, required guide sections and valid ingredient links.
- Demo business workflows, composed business workflows, report plugins, plugin documentation and Form builder tests passed.
- `npm run resources:run -- node scripts/qa-public-platform-value.mjs`: 141 checks passed. Seven representative routes at 1440px and 390px in light/dark; capability search, filters, empty state, keyboard disclosure and docs search; all ten industry recipe sections; all six launches; scenario/public appearance isolation; all 103 MDX routes render successfully.
- Screenshots inspected: product desktop, demo mobile/light and desktop/dark, docs desktop/light and mobile/dark, recipe mobile/light, industry recipe desktop/dark, feature section desktop/light and mobile/dark and new fictional app captures. No horizontal overflow or broken loaded images in the browser matrix.
- Resource gate used sequentially; servers and browsers closed after checks.

Browser artifacts: `/tmp/accelerate-platform-value-qa/` (`results.json`, screenshots and server log). Scoped command logs: `/tmp/accelerate-platform-value-tests/`. New published illustration assets are under `public/images/docs/` and `public/images/demo/`.

## Verification boundaries and recovery

The first browser run exposed the existing analytics endpoint's missing-database error in a credential-free environment. The final QA stubs only `/api/analytics/events` with a local 204 response; live analytics is not tested. The initial dev attempt used Turbopack, which cannot follow this worker's external dependency symlink; subsequent checks use Webpack. A capture initially used an incorrect Site Studio route and one Forms capture showed loading; both were corrected and recaptured.

The first production build passed. After the final FAQ corrections, a nine-worker rebuild exceeded the unchanged 3 GiB resource gate during static generation. Its process group was confirmed stopped. The final build uses Next.js’s existing `CIRCLE_NODE_TOTAL=3` input, which selects two workers, while retaining the same 2 GiB per-process heap and 3 GiB group ceiling. No resource limit was raised.

No provider calls, production data changes, migrations, persistent environment changes or new dependencies are required by this patch. Published Site Studio documents still own explicitly overridden routes. Local source verification does not prove which routes a connected production installation has overridden. Recipes for industries without dedicated demos identify that boundary. Clinical, legal, insurance and inventory systems are adaptation work, not claims of bundled specialist software.

Review, merge and production deployment are separate from this implementation handoff. Reverting this scoped commit restores the previous public presentation; no business-state migration is involved.

## Guide review ledger

All 82 existing guides were reviewed for task clarity, current terminology, setup, result interpretation, links and extension boundaries. Seventy-five existing guides received edits; seven retained their current task instructions. The 21 new files comprise twenty recipes and their overview. “Revised” includes focused copy or screenshot improvements; it does not claim a live-provider test of each guide.

| Guide                                | Review disposition                      |
| ------------------------------------ | --------------------------------------- |
| `command-center/activity`            | Revised copy and/or illustration        |
| `command-center/approvals`           | Revised copy and/or illustration        |
| `command-center/ask`                 | Revised copy and/or illustration        |
| `command-center/capabilities`        | Revised copy and/or illustration        |
| `command-center/inbox`               | Revised copy and/or illustration        |
| `command-center/overview`            | Revised copy and/or illustration        |
| `command-center/today`               | Revised copy and/or illustration        |
| `command-center/work`                | Revised copy and/or illustration        |
| `contacts/import`                    | Revised copy and/or illustration        |
| `contacts/overview`                  | Revised copy and/or illustration        |
| `conversations/overview`             | Revised copy and/or illustration        |
| `conversations/reply`                | Revised copy and/or illustration        |
| `customize/overview`                 | Revised copy and/or illustration        |
| `delivery/bookings`                  | Revised copy and/or illustration        |
| `delivery/clients`                   | Revised copy and/or illustration        |
| `delivery/content`                   | Revised copy and/or illustration        |
| `delivery/overview`                  | Revised copy and/or illustration        |
| `delivery/resources`                 | Revised copy and/or illustration        |
| `extend/adapters`                    | Revised copy and/or illustration        |
| `extend/ai-authoring`                | Reviewed; current instructions retained |
| `extend/apps`                        | Reviewed; current instructions retained |
| `extend/custom-ui`                   | Reviewed; current instructions retained |
| `extend/first-change`                | Revised copy and/or illustration        |
| `extend/mcp-clients`                 | Reviewed; current instructions retained |
| `extend/mcp`                         | Revised copy and/or illustration        |
| `extend/modules`                     | Revised copy and/or illustration        |
| `extend/overview`                    | Revised copy and/or illustration        |
| `extend/plugins`                     | Revised copy and/or illustration        |
| `extend/tools`                       | Revised copy and/or illustration        |
| `extend/webhooks`                    | Revised copy and/or illustration        |
| `extend/work-primitives`             | Revised copy and/or illustration        |
| `follow-up/overview`                 | Revised copy and/or illustration        |
| `intelligence/learning-inbox`        | Revised copy and/or illustration        |
| `intelligence/opportunity-radar`     | Revised copy and/or illustration        |
| `intelligence/overview`              | Revised copy and/or illustration        |
| `intelligence/tools`                 | Revised copy and/or illustration        |
| `intelligence/workspace`             | Revised copy and/or illustration        |
| `outreach/campaigns`                 | Reviewed; current instructions retained |
| `outreach/collections`               | Revised copy and/or illustration        |
| `outreach/email-studio`              | Revised copy and/or illustration        |
| `outreach/overview`                  | Revised copy and/or illustration        |
| `outreach/recovery`                  | Revised copy and/or illustration        |
| `pipeline/board`                     | Revised copy and/or illustration        |
| `pipeline/overview`                  | Revised copy and/or illustration        |
| `pipeline/revenue`                   | Revised copy and/or illustration        |
| `plugins/business-pulse`             | Revised copy and/or illustration        |
| `plugins/client-onboarding`          | Revised copy and/or illustration        |
| `plugins/commitment-watch`           | Revised copy and/or illustration        |
| `plugins/example-inventory`          | Revised copy and/or illustration        |
| `plugins/form-builder`               | Revised copy and/or illustration        |
| `plugins/meeting-commitments`        | Revised copy and/or illustration        |
| `plugins/meeting-prep`               | Revised copy and/or illustration        |
| `plugins/opportunity-radar`          | Revised copy and/or illustration        |
| `plugins/overview`                   | Revised copy and/or illustration        |
| `plugins/pipeline-watch`             | Revised copy and/or illustration        |
| `plugins/receivables-collections`    | Reviewed; current instructions retained |
| `plugins/site-studio`                | Revised copy and/or illustration        |
| `plugins/social-marketing`           | Reviewed; current instructions retained |
| `plugins/stripe-invoicing`           | Revised copy and/or illustration        |
| `plugins/stripe-subscriptions`       | Revised copy and/or illustration        |
| `proposals/overview`                 | Revised copy and/or illustration        |
| `proposals/send`                     | Revised copy and/or illustration        |
| `recipes/appointment-follow-through` | New recipe guide                        |
| `recipes/buyer-follow-up`            | New recipe guide                        |
| `recipes/consultation-commitments`   | New recipe guide                        |
| `recipes/consultation-intake`        | New recipe guide                        |
| `recipes/customer-kickoff`           | New recipe guide                        |
| `recipes/delivery-commitments`       | New recipe guide                        |
| `recipes/engagement-onboarding`      | New recipe guide                        |
| `recipes/insurance-inquiry`          | New recipe guide                        |
| `recipes/insurance-onboarding`       | New recipe guide                        |
| `recipes/invoice-follow-up`          | New recipe guide                        |
| `recipes/job-start`                  | New recipe guide                        |
| `recipes/overview`                   | New recipe guide                        |
| `recipes/practice-admin`             | New recipe guide                        |
| `recipes/practice-inquiry`           | New recipe guide                        |
| `recipes/program-commitments`        | New recipe guide                        |
| `recipes/quote-request`              | New recipe guide                        |
| `recipes/roofing-inquiry`            | New recipe guide                        |
| `recipes/sales-follow-up`            | New recipe guide                        |
| `recipes/supporter-interest`         | New recipe guide                        |
| `recipes/vehicle-handoff`            | New recipe guide                        |
| `recipes/vehicle-inquiry`            | New recipe guide                        |
| `self-hosting/installation`          | Revised copy and/or illustration        |
| `self-hosting/overview`              | Revised copy and/or illustration        |
| `sources/leads`                      | Revised copy and/or illustration        |
| `sources/overview`                   | Revised copy and/or illustration        |
| `start/agencies`                     | Revised copy and/or illustration        |
| `start/business-owners`              | Revised copy and/or illustration        |
| `start/core-concepts`                | Revised copy and/or illustration        |
| `start/daily-path`                   | Revised copy and/or illustration        |
| `start/first-value`                  | Revised copy and/or illustration        |
| `start/how-it-works`                 | Revised copy and/or illustration        |
| `start/modules`                      | Revised copy and/or illustration        |
| `start/overview`                     | Revised copy and/or illustration        |
| `start/receipts`                     | Revised copy and/or illustration        |
| `start/troubleshooting`              | Revised copy and/or illustration        |
| `start/workspace`                    | Revised copy and/or illustration        |
| `workspace/customer-billing`         | Revised copy and/or illustration        |
| `workspace/integrations`             | Revised copy and/or illustration        |
| `workspace/overview`                 | Revised copy and/or illustration        |
| `workspace/settings`                 | Revised copy and/or illustration        |
| `workspace/setup`                    | Revised copy and/or illustration        |
