# Command Center product positioning

Reviewed against published main `7120c686` and official competitor sources on
October 10, 2026. Implementation evidence is recorded separately in
[the verification handoff](../verification/command-center-overhaul/README.md).

## The product definition

**Command Center is an open-source AI business platform you can make your own.**

It connects customers, sales, delivery, billing and marketing. Teams can use the
workspace directly, while developers, agencies and coding agents can adapt its
existing business services and build custom Apps. These are equal audience paths.

This category fits the current product better than describing it solely as a CRM,
an AI assistant, an app generator or a collection of plugins. It also identifies
the implementation responsibility: source ownership and adaptability come with
installation, provider setup, maintenance and workflow verification.

The practical story is a customer relationship carried across the business:
an inquiry has an owner and next action; a won opportunity becomes assigned
delivery work; billing has a customer, service lines and payment follow-up.
Marketing creates the website, content and outreach that support that operation.
Custom Apps add the records and decisions particular to an industry.

## What the competition teaches us

| Alternative                                                                       | The useful framing to learn from                                  | Its strongest selection reason                                                            |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [Twenty](https://twenty.com/)                                                     | Ownership plus a recognizable CRM category                        | A configurable, open-source CRM                                                           |
| [Kyma](https://www.kymainfostructure.com/docs)                                    | Show the software-creation workflow                               | Evaluate in-product application generation; its public description needs a hands-on trial |
| [Attio](https://attio.com/)                                                       | Organize around sales jobs and the customer lifecycle             | A focused revenue CRM                                                                     |
| [HubSpot](https://www.hubspot.com/products)                                       | Explain the shared customer platform and each business area       | A broad hosted customer suite and ecosystem                                               |
| [HighLevel](https://www.gohighlevel.com/)                                         | Show capture, nurture, close and reactivate as an agency workflow | Packaged agency marketing and acquisition                                                 |
| [Zoho One](https://www.zoho.com/one/overview.html)                                | Make the integrated application scope visible                     | Broad packaged business applications                                                      |
| [Odoo](https://www.odoo.com/page/all-apps) / [ERPNext](https://frappe.io/erpnext) | Tie applications to real operational processes                    | Accounting, stock, procurement, manufacturing and other ERP requirements                  |
| [Retool](https://retool.com/ai) / [n8n](https://n8n.io/)                          | Explain what someone can build and connect                        | Internal tools or automation across existing systems                                      |

These are official product descriptions, not independent feature-parity tests.
The public comparison guide gives each alternative a strength and a selection
reason. It avoids pricing, uniqueness and superiority claims.

Command Center's defensible combination is working customer operations,
source ownership, AI with business context and a foundation for custom Apps.
Each ingredient exists elsewhere; communicate the useful combination and prove
the particular workflow a buyer needs.

## Six business areas

| Area                      | The business job                                        | Current implementation to demonstrate                                    |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Customers & conversations | Answer with the relationship history available          | Contacts, conversations, imports, matching, linked records               |
| Sales & follow-up         | Give an inquiry a visible path to a decision            | Pipeline, owners, next actions, proposals, follow-up reports             |
| Delivery                  | Carry won work into owned commitments                   | Clients, Work, onboarding and commitment Apps                            |
| Billing & collections     | Prepare invoices and make an informed payment follow-up | Invoices, subscriptions, collections and revenue reporting               |
| Marketing & publishing    | Prepare and publish the customer-facing work            | Website & pages, forms, campaigns, sequences, content and social         |
| Custom Apps & AI          | Build the process the business needs                    | Source-based extensions, shared services, AI tools and authenticated MCP |

The shared discovery model assigns each catalog capability to one area and
links it to a real guide and demo destination. It cannot enable a module or
change runtime permissions. The admin combines customer context and sales in
Customers & sales. Daily work provides the cross-business operating queue, while
Workspace holds setup and administration. Together these form seven navigation
groups.

## Evidence and claim boundaries

- Business screens and the six demos share the actual admin components. Demo
  records and business effects are fictional and browser-session scoped.
- Live demo inference remains the existing bounded exception. Its daily budget,
  signed session, rate limits and same-origin endpoint are unchanged.
- Optional Apps and connected providers need configuration. Guide requirements
  sit beside the relevant action.
- Manual record edits, AI proposals, approvals and provider delivery describe
  different results. Existing authorization and result owners remain intact.
- General-purpose AI App creation inside the workspace is planned. Current
  custom development uses the repository and an external coding agent.
- Billing workflows and revenue reporting do not establish a complete accounting
  ledger, manufacturing system or ERP. Scope additional functions explicitly.
- Existing access rules do not establish departmental or bookkeeper roles.
- MIT licensing applies to application source; hosting and provider usage have
  their own costs. Protected agency assets retain their existing license boundary.

## Communication order

Explain the business job, useful action and practical result. Then show the real
screen and a worked example. Explain setup and limits where they affect a choice.
Give operators a workflow to try and builders a working adaptation to make.
Keep policies, tool schemas and diagnostics reachable after this introduction.

The first builder exercise changes the actual Pipeline follow-up report from
seven quiet days to three. A fixed local fixture proves both versions without
connecting a database or provider. It demonstrates reuse rather than asking a
new developer to design an App before seeing anything work.

The optional Northline lifecycle guide follows Lena Walsh through existing
screens. It keeps free exploration and reset available, does not track fictional
completion, and distinguishes the newly prepared invoice from the earlier
invoice used to inspect Collections.

## Content and release ownership

Bundled product pages, metadata, search, navigation, docs, README, public assistant
and changelog use the same framing. Guides retain stable URLs and help anchors.
Affected screenshot assets must be recaptured from the actual demo.

Site Studio can override a bundled public path. A portable private draft and
an export-based preparation command are included for those pages. Import,
publication and deployment remain separate release operations. Saving or
publishing that draft has not been performed as part of this implementation.
