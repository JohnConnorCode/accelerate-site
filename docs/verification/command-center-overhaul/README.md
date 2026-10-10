# Command Center product overhaul

The product now explains a connected business operation: customer context,
sales, delivery, billing, marketing and custom Apps. Business teams can try a
customer workflow; builders can adapt a working report and reuse the underlying
business services. The admin, guides and public pages follow that same structure.

Implementation branch: `agent/command-center-product-overhaul-20261010`.
Base: `7120c68667be73829686b7035145596b813f0f41` from published `origin/main`.
The original active checkout and its unfinished work remain intact.

## Review the result

- [Positioning and official-source competitor research](../../planning/COMMAND-CENTER-POSITIONING-2026-10-10.md)
- [Shared business-area model](../../../src/content/command-center-business.ts)
- [Public product page](../../../src/components/sections/CommandCenterPage.tsx),
  `/command-center/features` and its six feature pages, and `/command-center/compare`
- [Business workflow guide](../../../src/content/docs/start/daily-path.mdx) and
  [working developer exercise](../../../src/content/docs/extend/first-change.mdx)
- [Admin groups](../../../src/lib/admin/navigation.ts), first-use workflow choices
  and business jobs in the AI workspace
- [Schema-validated Site Studio review draft](site-studio-draft.json)

The comparison guide covers Twenty, Kyma, Attio, HubSpot, HighLevel, Zoho One,
Odoo, ERPNext, Retool and n8n. It cites their official descriptions and explains
selection reasons. It does not claim independently verified parity or pricing.

## Acceptance evidence

The production build includes TypeScript validation and all 570 generated pages.
The focused browser suite covers 1440px and 390px widths, normal and reduced
motion, all new public routes, unknown-feature recovery, keyboard capability
filtering, documentation audience switching, seven admin groups in all six demos,
history/reload, optional lifecycle navigation and preparing an AI request without
sending it. Console errors and escaped protected/external requests are checked.

The existing AI discovery acceptance covers search, empty results, keyboard focus
and failed-read recovery at both widths. The existing business workflow acceptance
passed all six fictional scenarios on desktop and mobile. It exercises actual
admin components and the browser-session business adapter, including invoice,
collections, publishing and campaign operations.

The existing owner-workspace and admin-demo checks also passed. Owner acceptance
covers inquiry replies, onboarding and invoicing, including failed operations and
reload. Site Studio acceptance covers private draft recovery and the changed
public reference links through controlled adapters and the fictional demo.

Repeating the conversational journey exposed an existing automatic-scroll race:
a pending or open exact-change review could jump to the latest message and hide
its consequence. The shared chat now suspends automatic following during review.
A fresh production build and two successful runs cover all twelve business and
viewport combinations, including an actual resize while the review is open.
Opened viewport screenshots confirm the consequence and both decisions remain
visible. Shared Command Center interactions also pass at both widths with normal
and reduced motion. The route inventory records the reviewed boundary; its
fingerprint check and the stricter color-token budget pass.

Twenty-nine documentation screenshots and seven gallery screenshots were captured
from the real demo interface. They include delivery, collections and publishing.
The optional inventory example was enabled through the simulated module-settings
operation before capture. The README workspace image uses the refreshed Today
capture. No mock interface images were introduced.

Local screenshots: `/tmp/command-center-overhaul-qa/`.
The compact browser evidence files beside this receipt retain the outcomes and
scenario coverage. Their recorded base commit identifies the starting checkout;
the implementation candidate is the PR head containing this receipt.

All local handoff checks passed:

The complete 87-command local core run used application commit `2d65ca51`. The
later application change is confined to `AdminAIChat.tsx`. Its source fingerprint,
fresh build, strict lint, navigation contract and browser acceptance are recorded
in [the handoff checks](handoff-checks.json). PR CI verifies the final candidate
separately; the PR also retains the current preview-platform status.

| Verification                                                          | Result                                                            |
| --------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Engineering contract, guardrails and lint                             | Passed                                                            |
| Complete core suite                                                   | Passed                                                            |
| Branded production build and TypeScript                               | Passed; 570 generated pages                                       |
| Product browser acceptance                                            | 48 checks passed                                                  |
| Existing docs and public-site acceptance                              | 139 checks passed                                                 |
| AI discovery and recovery                                             | Passed at both widths                                             |
| Existing fictional business workflows                                 | All six scenarios passed at both widths                           |
| Scoped source, docs, search, format, claims and neutral-export checks | 14 commands passed                                                |
| Owner-export draft preparation                                        | Passed; input, identity, page IDs and unrelated content preserved |

Feature images and enlargement links now use the existing content-hash versioning
method. The refreshed gallery uses new filenames, preserving previously published
assets while avoiding stale optimized images. The browser suite checks each new
feature page's image revision against the actual screenshot bytes. Opened desktop
and mobile screenshots confirm the current interface and layout.

Reproduce the product and docs acceptance against a branded production build:

```bash
NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded npm run build
QA_PRODUCTION=1 NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded QA_FOCUS=product-story,capabilities,docs npm run qa:admin-polish
```

The capture focuses are `product` and `docs-captures`. They overwrite their own
image assets. Rebuild after a capture changes an image before verifying the docs'
content-hash cache keys.

## Site Studio release preparation

The checked-in JSON is a bundled review draft. No connected installation was
saved or published. Before importing it, regenerate from the current owner's
website export so unrelated pages, identity and custom links are preserved:

```bash
NEXT_PUBLIC_DISTRIBUTION_PROFILE=branded node --import tsx scripts/prepare-command-center-content-draft.ts --website /tmp/current-website.json --output /tmp/product-draft.json
```

The command validates the portable website schema, preserves an existing product
page's ID and refuses to overwrite the input export. It updates ten product pages,
the native homepage product section and relevant navigation. It has no database
connection or publication operation. Import and preview the unpublished draft
before the separately authorized publication step.
Deploy the reviewed code before publishing content that links to the new feature
pages.

## Verification boundaries

Business effects in these browser checks are fictional. No connected provider
write or live AI inference was exercised. The existing bounded live-inference
exception in the public demo, authorization, module availability, approvals and
result owners remain unchanged.

General-purpose in-app App generation remains planned. The implemented builder
path uses the repository and an external coding agent. Collections for Lena's
earlier invoice and a newly created sample invoice are separate records; the guide
does not pretend to automate every lifecycle step.

Source implementation, review, merge, deployment and Site Studio publication are
separate facts. This work has not merged or deployed the application and has not
published the content draft.
