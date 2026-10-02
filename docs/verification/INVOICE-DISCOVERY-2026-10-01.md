# Invoice discovery and creation

The operator could not find invoices or start an invoice in Command Center.
Invoices were nested inside the collapsed Records group, while the invoice
page emphasized plugin management and offered a section anchor for creation.
That anchor had no target when Stripe was disconnected.

The verified application source is `e1ed4f638c259c772d7e9d1ede934d427a43340d`.
Its local production build uses deployment ID `e1ed4f638c25`. The final
documentation screenshot and this evidence packet are added after that build;
application, manifest, public-copy and browser-test sources remain identical.

| Before                                                                                  | After                                                                                                                                                           |
| --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invoices nested in Records                                                              | Enabled invoicing has a top-level Invoices destination, including collapsed desktop navigation and the mobile Menu.                                             |
| Creation buried below account history                                                   | A primary Create invoice action opens `/admin/invoicing?view=create`, with the customer field in the first mobile screen.                                       |
| Search had no creation action                                                           | Invoice, invoices, invoicing, billing, new invoice and create invoice find the existing destination; creation opens through the palette.                        |
| Disabled invoicing disappeared without a searchable recovery path                       | Set up invoicing opens the shared disabled notice, then the filtered enable switch in Apps without module totals above it.                                      |
| Disconnected creation had a broken anchor; pending connection reads looked disconnected | Creation shows the connection step, while pending reads show Checking your Stripe connection.                                                                   |
| Guides used the older starting path                                                     | The public guide, plugin README, Command Center description, FAQ, changelog, generated index and screenshot describe the current task.                          |
| No scoped first-screen regression journey                                               | Eight production-browser cases assert actual field/control geometry, keyboard behavior, approval entry and desktop/mobile rendering; CI retains their evidence. |

## Verification

Passed locally:

- `npm run verify:agent-contract`
- `npm run lint`, including the final relevant source tree
- `npm run build`, including TypeScript validation of the final application source
- `npm run verify:extensions`
- `npm run test:admin-breadcrumbs`
- `npm run test:plugin-modules`
- `npm run test:stripe-workflow`
- `npm run test:route-gating`
- `npm run test:admin-demo-contract`
- `npm run test:plugin-documentation`
- `npm run verify:guardrails`
- `npm run test:house-style-copy`
- `npm run test:no-fabricated-claims`
- `npm run verify:docs`, with zero source-coverage errors or warnings
- `npm run docs:llms:check`
- `npm run test:search`
- `PLAYWRIGHT_BASE_URL=http://localhost:3046 npm run qa:invoice-navigation`
- Resource-gated screenshot capture for `plugins/stripe-invoicing`
- `git diff --check`

The [browser receipt](assets/invoice-discovery-2026-10-01.json) records all
eight passing cases: Northline Roofing and SuperDebate on desktop and mobile,
plus disconnected Stripe and the public invoice guide at each width.
Desktop uses 1440 × 1000; mobile uses 390 × 844. Coverage includes standard
and reduced motion, collapsed navigation, keyboard opening and module enabling,
creation search, draft preparation and approval entry. Browser errors and
escaped server/provider API requests both remained empty.

Screenshots were opened and inspected. Review caught and corrected a creation
heading scrolling behind the persistent toolbar and excessive mobile navigation
and module totals above the intended controls. The final assertions check the
customer field and enable switch above the mobile dock, not merely DOM presence.
The [refreshed guide screenshot](../../public/images/docs/plugins/stripe-invoicing.png)
uses the real admin creation page with fictional data.

The reviewed public surfaces are the Stripe invoicing task guide, its plugin
README and screenshot, the Command Center collections description and invoice
FAQ, and the dated changelog entry. The plugins overview remains accurate:
it already links this dedicated guide for reviewed creation, sending and
customer presentation. Guide title/description and manifest metadata remain
aligned; the generated index reflects the updated guide date.

## Boundaries

This is implementing-agent verification, not independent review or a deployment
receipt. The full remote CI result is separate from these scoped local checks.
No private workspace configuration, live invoice, customer email or payment was
changed. Stripe transport tests use deterministic fixtures; browser effects use
fictional demo records, and disconnected state uses an explicit browser fixture.
These results do not prove a live Stripe connection.

The optional module still defaults to disabled. Existing module enablement,
tenant authorization, exact retained-history routes and setup access remain
enforced. The client shell reuses the same route ownership, history exception,
module enablement and disabled notice as the server display gate. Existing APIs
remain the authorization and execution boundary; draft creation and sending
retain their separate reviewed operations.
