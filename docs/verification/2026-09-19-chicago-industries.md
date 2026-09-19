# Chicago services and small-business industry expansion

Card: `chicago-small-business-industries`

Base: `agent/public-platform-value-recipes` at `b4a3a3e1aa7585855110b93b4e8ca88e80c9f96a`
The earlier public-platform submission remains a separate review candidate. This follow-up does not accept, merge or deploy it.

## Content and presentation changes

| Before | After |
| --- | --- |
| Ten industry pages with broad service claims and an ungrouped directory | Twenty industry pages in five business categories, with distinct inquiry context, responsibilities and next steps. The shared template uses the existing product typography, cards and theme tokens. |
| Long industry pages included unsupported response guarantees, automatic booking claims and generic operational activity | Industry pages show labeled illustrative workflows, practical recipes, current platform capabilities, custom integration boundaries, support and FAQs. Three-step layouts align on desktop; FAQ controls support keyboard focus and touch targets. |
| Twenty workflow recipes | Forty complete guides. New recipes combine forms, contacts and pipeline; onboarding and work; or calendar context and meeting commitments. Each includes setup, a worked example, actual shared screenshots, instructions, verification, extension scope and recovery. |
| Counts embedded in entry-page copy and tests | Registry-derived directory and Chicago counts, count-neutral documentation entry copy, and two-recipes-per-industry contract assertions. Six existing fictional demos remain unchanged. |
| No Chicago services hub | `/chicago` explains consulting, custom systems, managed execution and training for Chicago and suburban small businesses. It links to concrete industry projects, recipes, the platform and contact. |
| Headquarters absent from the public pages | A shared verified headquarters source and component appear on Chicago, About, Contact and the bundled branded footer, with directions and a Ferris link. Published Site Studio footers retain ownership; neutral mode omits headquarters. The neutral export excludes the Chicago route and replaces the headquarters component with an empty component; reusable recipe and fictional-demo metadata remain available to the product docs. |
| Chicago article included unsourced statistics and implied customer outcomes | The existing URL now contains a practical project guide: choose a workflow, compare implementation options, set a pilot baseline and agree on cost and ownership. Examples are illustrative. |
| Missing local discovery and incomplete route coverage | Chicago navigation and search, a bounded featured-industry menu with All industries, unique route metadata and canonicals, Service/breadcrumb data, Organization address/location, dated sitemap entries and the Site Studio route inventory. |
| Generic industry CTA attribution | Industry slug and Chicago placement identifiers use the existing conversion tracking. No new analytics provider. |
| Floating call dock used spring movement even with reduced motion | The shared dock respects the motion preference and uses immediate transitions in reduced mode. |
| No regression or visual evidence for the expanded set | A focused content/discovery/isolation test and a production-browser QA script cover the expanded routes, themes, viewports and SEO output. |

## Headquarters grounding

The founder explicitly identified Ferris as Accelerate's headquarters. [Ferris publishes its address](https://ferrischicago.com/) as **1 W Monroe Street, Chicago, IL**; verified on September 19, 2026. The implementation adds no suite, ZIP code, opening hours, visitation promise, rating, endorsement or organizational affiliation.

## Verification

| Check | Result |
| --- | --- |
| `npm run verify:agent-contract` | Passed. |
| `CIRCLE_NODE_TOTAL=3 npm run build -- --webpack` | Passed, including TypeScript and 532 generated routes. |
| `npm run lint` | Passed. |
| `npm run verify:docs -- --strict` | 123 pages; zero errors or warnings; full strict coverage passed. |
| `npm run docs:llms:check` | Passed. |
| `npm run verify:articles` | All 42 articles passed. Word-count recommendations remain advisory. |
| `test:house-style-copy`, `test:positioning-copy`, `test:no-fabricated-claims` | Passed. |
| `test:search` | Passed; all 20 industries and Chicago are discoverable. |
| `test:admin-demo-contract`, `test:command-center-demo-contract` | Passed; six demo scenarios preserved and two complete recipes per industry. |
| `test:site-studio` | Passed, including route inventory, rendering, publication and isolation checks. |
| `test:neutral-runtime-distribution`, `scripts/test-neutral-export.mjs` | Passed. |
| `scripts/test-chicago-industries.tsx` | Passed: registry parity, discovery, route ownership and headquarters isolation. |
| Actual neutral export | Chicago route and headquarters facts omitted; headquarters component replaced; all 40 recipes and reusable metadata retained. Export file/identity checks passed; a second production build of the exported starter was not run. |
| `scripts/qa-chicago-industries.mjs` | Passed: 97 grouped checks, including 96 route/viewport/theme captures at 1440, 768 and 390 pixels; all 20 industries and 40 guides; keyboard menus, Escape focus restoration, skip link and FAQ activation; reduced and normal motion; visible images, console errors, overflow, canonical URLs, schemas, sitemap, internal links and unknown-route 404. |
| `git diff --check` | Passed. |

All heavy jobs ran sequentially through the repository resource gate. The final application build retains existing Next middleware/Edge Runtime deprecation warnings. Earlier local output-cleanup failures were resolved by deleting only this worker’s generated `.next` directory.

## Inspected presentation

The screenshots below are crops from full-page local production captures. Reviewed desktop, tablet and mobile typography, wrapping, spacing, contrast, workflow cards, documentation figures, headquarters and footer. The shared dock now respects reduced motion. The browser script waits for the menu’s content visibility and scroll rendering to settle before keyboard activation.

- [Chicago, desktop light](assets/chicago-industries/chicago-desktop-light.png)
- [Chicago, mobile dark](assets/chicago-industries/chicago-mobile-dark.png)
- [Industry workflow, desktop dark](assets/chicago-industries/industry-desktop-dark.png)
- [Industry workflow, mobile light](assets/chicago-industries/industry-mobile-light.png)
- [Grouped directory, tablet light](assets/chicago-industries/directory-tablet-light.png)
- [Recipe documentation, desktop dark](assets/chicago-industries/recipe-desktop-dark.png)

[Complete browser report](2026-09-19-chicago-industries-browser.json).

Full local evidence: `/tmp/accelerate-chicago-qa/` and `/tmp/accelerate-chicago-tests/`.

## Boundaries

These are public content and discovery improvements. No business runtime, provider integration, database schema, demo scenario or dependency was added. Custom industry systems remain separately scoped work. Local browser QA stubs the database-backed analytics endpoint; it does not establish live provider execution or conversion delivery. Search rankings and organic performance are not measured by local checks. Published Site Studio content retains precedence over bundled pages and footers; review that content when preparing a production release.

Review submission, merge and deployment are separate actions. This work is intended for review, with no production changes authorized by this task.
