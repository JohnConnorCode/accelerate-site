# Public platform polish follow-up

This pass follows `80d16a522a0cfb6a6a693df65230f3ff56d31449` and the founder’s request to improve professional presentation, demo usefulness, buying clarity and industry-specific recipes. The original scope, guide review ledger and acceptance mapping remain in [the first-pass report](2026-09-19-public-platform-value.md).

## Changes reviewed

| Before                                                                          | After                                                                                                                                                                                                             |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Product page spreads the buying explanation across a long reference-heavy page. | `CommandCenterPage.tsx` leads with customer work, three guided examples and four illustrated feature jobs in a two-column desktop grid.                                                                           |
| Full capability catalog occupies the main reading path.                         | Native keyboard-accessible disclosure keeps search and all capability details available on demand.                                                                                                                |
| Product page repeats the entire growing FAQ list.                               | Six buying questions appear on the page and in matching FAQ structured data, with a direct question about controlling AI actions.                                                                                                                                      |
| Demo cards preview broad dashboards rather than their advertised tasks.         | Six screenshots captured from the actual fictional workspaces show conversations, pipelines, task results and invoice receipts.                                                                                   |
| Demo visitor must invent a useful task to try.                                  | Shared `WorkflowShowcase` offers inquiry, onboarding and invoice instructions, a direct screen link, a saved result to check and a setup recipe.                                                                  |
| Six demo cards use a long two-column desktop list.                              | A three-column desktop grid, two-column tablet grid and single-column mobile list preserve readable previews and controls.                                                                                        |
| Implementation and self-hosting responsibilities are implicit.                  | Two buying paths identify scope, handoff, training, operations, provider costs and builder responsibilities.                                                                                                      |
| Product explanation lacks relevant published work.                              | Existing WORK+SHELTER and SuperDebate project descriptions and relationship labels link to their case studies, without invented results or customer metrics.                                                      |
| Twenty recipes repeat four general descriptions and boilerplate examples.       | Twenty unique discovery descriptions and worked examples explain industry inputs, decisions, owners and completion evidence.                                                                                      |
| Workflow guide uses general approval wording and incomplete intake fields.      | Task recipes use current button labels; inquiry recipes require name and email; invoice recipe explains preparation before collections.                                                                           |
| Documentation entry path predates guided demos.                                 | First-workflow guide points to the new examples; generated docs index and public changelog reflect the changes.                                                                                                   |
| Verification checks only recipe structure and generic demo launches.            | Contracts cover three implemented workflow destinations and unique recipes; browser QA exercises keyboard selection and exact launch/recipe links, records page height, and captures saved outcomes after reload. |

## Source and action review

Reviewed the existing Conversations composer and confirmation in `src/app/admin/conversations/page.tsx`, task preparation/history in `src/components/admin/TaskWorkflowWorkspace.tsx`, and invoice draft/send controls in `src/app/admin/invoicing/page.tsx`. The guided controls reuse these screens unchanged. Fictional mutations are handled by the existing demo runtime; screenshot capture aborts external and API transport.

The capture exercise sends an inquiry reply, creates an onboarding checklist, completes a specifically named new task, and creates and sends the same newly prepared invoice. Reload assertions verify saved browser-session results. The meeting example also creates and completes a named task. Screenshots show fictional data and simulated execution, not customer results.

The portfolio cards reuse existing descriptions and disclose Accelerate’s relationship to each project. They demonstrate implementation experience, not measured product adoption or a market-leadership claim.

## Verification

Scoped tests passed: agent contract, lint, strict documentation verification (103 guides), generated documentation index parity, house style, positioning, unsupported-claim checks, search, admin demo, Command Center recipe/demo contract, demo business workflows, task workflows, report plugins, plugin documentation and form builder. The admin-demo link check now accepts the exact launcher route with its optional `#workflows` fragment.

The production build passed using `CIRCLE_NODE_TOTAL=3 npm run build -- --webpack`, with TypeScript and 501 generated pages inside the existing resource gate. A final small FAQ wording change is being reverified.

The first final browser pass passed 145 checks across desktop (1440px) and mobile (390px), light and dark themes, seven representative page types, all 103 guide routes, ten industry pages and six scenario launches. Keyboard workflow selection, capability search, native disclosure, documentation search, reduced motion and public/demo appearance isolation passed. The screenshot pass is being repeated with all lazy images decoded after scrolling through each page.

Measured initial Command Center page height, before opening reference disclosures: desktop 14,912 to 9,322 pixels (37.5% shorter); mobile 24,581 to 13,639 pixels (44.5% shorter). Full feature information remains in the native disclosure and dedicated reference guide.

Opened and inspected the six newly captured real demo screenshots and the revised product, chooser and recipe layouts. Test logs live in `/tmp/accelerate-platform-polish-tests`; captures and browser evidence live in `/tmp/accelerate-platform-polish-qa`.

Public visual QA stubs only analytics ingestion with a local 204 because this credential-free checkout has no connected analytics database. No production integration, payment, email, deployment or live customer result is claimed. Published Site Studio page override ownership remains intact.

## Release status

Implementation and review submission are separate from integration and deployment. This follow-up does not merge or deploy the site.
