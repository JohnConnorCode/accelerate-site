# Admin language recovery — 12 September 2026

This is a source inventory of the claimed recovery candidate based on published
`d6d9831`. It is not production or browser acceptance. Shared registry names,
root/detail introductions, help destinations and actual search/breadcrumb helpers
are verified by the audit and its mutation fixtures.

## Resolved findings

- Quoted and unquoted guidance keys now receive the same AST-based check.
- The audit follows the current accessible Help trigger and dialog, not obsolete copy.
- Contact intake detail breadcrumbs use the canonical parent name.
- Architect query state resolves independently from AI Workspace in headings, help, navigation selection and breadcrumbs.
- Blueprints uses the registry heading; Architect, Blueprints and Learning Inbox have workflow guidance and valid public guides.

CI run 34703821325 built successfully and rendered the matrix, exposing mobile
Help panels anchored outside the viewport. The shared panel now clamps its anchor
inside page gutters and scrolls within the available height. The fixture configures
appearance only in the top-level app document, preserving sandboxed preview isolation.
Final browser verification and screenshot inspection remain pending for this repair.

## Source matrix

Record-specific detail and selected-record titles remain intentional. Source locations
below identify all discovered PageHeader callers, including loading and record branches.
The AI route is listed twice because Architect is a query-qualified destination.

| Destination          | Route                                       | Introduction source                               | Heading expression                                                             |
| -------------------- | ------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------ |
| Today                | `/admin/today`                              | `src/components/admin/TodayWorkspace.tsx:747`     | `"Today"`                                                                      |
| Tasks & approvals    | `/admin/work`                               | `src/app/admin/work/page.tsx:164`                 | `{adminPageName("work")}`                                                      |
| Pipeline             | `/admin/pipeline/[id]`                      | `src/app/admin/pipeline/[id]/page.tsx:371`        | `{opportunity?.name \|\| record?.company?.name \|\| "Opportunity record"}`     |
| Pipeline             | `/admin/pipeline`                           | `src/app/admin/pipeline/page.tsx:304`             | `{adminPageName("pipeline")}`                                                  |
| Conversations        | `/admin/conversations`                      | `src/app/admin/conversations/page.tsx:381`        | `{adminPageName("conversations")}`                                             |
| Review queue         | `/admin/inbox`                              | `src/app/admin/inbox/page.tsx:215`                | `{adminPageName("inbox")}`                                                     |
| Contact review       | `/admin/identity-review`                    | `src/app/admin/identity-review/page.tsx:90`       | `{adminPageName("identity-review")}`                                           |
| Contact intake       | `/admin/contacts/[email]`                   | `src/app/admin/contacts/[email]/page.tsx:72`      | `"Contact relationship"`                                                       |
| Contact intake       | `/admin/contacts/[email]`                   | `src/app/admin/contacts/[email]/page.tsx:90`      | `"Contact relationship"`                                                       |
| Contact intake       | `/admin/contacts`                           | `src/app/admin/contacts/page.tsx:170`             | `{adminPageName("contacts")}`                                                  |
| Email Templates      | `/admin/emails`                             | `src/app/admin/emails/page.tsx:248`               | `{adminPageName("emails")}`                                                    |
| Campaigns            | `/admin/campaigns`                          | `src/app/admin/campaigns/page.tsx:264`            | `{adminPageName("campaigns")}`                                                 |
| Revenue Recovery     | `/admin/recovery`                           | `src/app/admin/recovery/page.tsx:201`             | `{adminPageName("recovery")}`                                                  |
| Proposals            | `/admin/proposals`                          | `src/app/admin/proposals/page.tsx:144`            | `{adminPageName("proposals")}`                                                 |
| Proposals            | `/admin/proposals`                          | `src/app/admin/proposals/page.tsx:166`            | `{selectedProposal.title}`                                                     |
| Proposals            | `/admin/proposals`                          | `src/app/admin/proposals/page.tsx:174`            | `{adminPageName("proposals")}`                                                 |
| Email Sequences      | `/admin/email-sequences`                    | `src/app/admin/email-sequences/page.tsx:79`       | `{adminPageName("delivery-runs")}`                                             |
| Email Sequences      | `/admin/email-sequences`                    | `src/app/admin/email-sequences/page.tsx:87`       | `{adminPageName("delivery-runs")}`                                             |
| Revenue              | `/admin/revenue`                            | `src/app/admin/revenue/page.tsx:39`               | `{adminPageName("revenue")}`                                                   |
| Clients              | `/admin/clients/[id]`                       | `src/app/admin/clients/[id]/page.tsx:93`          | `"Client"`                                                                     |
| Clients              | `/admin/clients/[id]`                       | `src/app/admin/clients/[id]/page.tsx:102`         | `"Client Not Found"`                                                           |
| Clients              | `/admin/clients/[id]`                       | `src/app/admin/clients/[id]/page.tsx:130`         | `{client.business_name}`                                                       |
| Clients              | `/admin/clients`                            | `src/app/admin/clients/page.tsx:78`               | `{adminPageName("clients")}`                                                   |
| Clients              | `/admin/clients`                            | `src/app/admin/clients/page.tsx:86`               | `{adminPageName("clients")}`                                                   |
| Bookings             | `/admin/bookings`                           | `src/app/admin/bookings/page.tsx:92`              | `{adminPageName("bookings")}`                                                  |
| Content Calendar     | `/admin/content`                            | `src/app/admin/content/page.tsx:75`               | `{adminPageName("content")}`                                                   |
| Resource Downloads   | `/admin/resources`                          | `src/app/admin/resources/page.tsx:74`             | `{adminPageName("resources")}`                                                 |
| Resource Downloads   | `/admin/resources`                          | `src/app/admin/resources/page.tsx:82`             | `{adminPageName("resources")}`                                                 |
| AI Workspace         | `/admin/ai`                                 | `src/components/admin/AdminAIWorkspace.tsx:58`    | `{purpose === "architect" ? adminPageName("architect") : adminPageName("ai")}` |
| AI Workspace         | `/admin/ai`                                 | `src/components/admin/AdminPageLoading.tsx:32`    | `{title}`                                                                      |
| Architect            | `/admin/ai` (`/admin/ai?purpose=architect`) | `src/components/admin/AdminAIWorkspace.tsx:58`    | `{purpose === "architect" ? adminPageName("architect") : adminPageName("ai")}` |
| Architect            | `/admin/ai` (`/admin/ai?purpose=architect`) | `src/components/admin/AdminPageLoading.tsx:32`    | `{title}`                                                                      |
| Blueprints           | `/admin/blueprints/[id]`                    | `src/components/admin/BlueprintReview.tsx:216`    | `"Blueprint review"`                                                           |
| Blueprints           | `/admin/blueprints/[id]`                    | `src/components/admin/BlueprintReview.tsx:232`    | `{`Blueprint v${detail.version}`}`                                             |
| Blueprints           | `/admin/blueprints`                         | `src/components/admin/BlueprintsWorkspace.tsx:80` | `{adminPageName("blueprints")}`                                                |
| Analytics            | `/admin/analytics`                          | `src/app/admin/analytics/page.tsx:290`            | `{adminPageName("analytics")}`                                                 |
| Activity             | `/admin/activity`                           | `src/app/admin/activity/page.tsx:173`             | `{adminPageName("activity")}`                                                  |
| Workspaces           | `/admin/tenants`                            | `src/app/admin/tenants/page.tsx:218`              | `{adminPageName("tenants")}`                                                   |
| Integrations         | `/admin/integrations`                       | `src/app/admin/integrations/page.tsx:700`         | `{adminPageName("integrations")}`                                              |
| Setup                | `/admin/setup`                              | `src/app/admin/setup/page.tsx:664`                | `{adminPageName("setup")}`                                                     |
| Feature Board        | `/admin/features`                           | `src/app/admin/features/page.tsx:1171`            | `{adminPageName("features")}`                                                  |
| Branding             | `/admin/branding`                           | `src/app/admin/branding/page.tsx:300`             | `{adminPageName("branding")}`                                                  |
| Settings             | `/admin/settings`                           | `src/app/admin/settings/page.tsx:243`             | `{adminPageName("settings")}`                                                  |
| Settings             | `/admin/settings`                           | `src/app/admin/settings/page.tsx:251`             | `{adminPageName("settings")}`                                                  |
| Learning Inbox       | `/admin/learning`                           | `src/app/admin/learning/page.tsx:129`             | `"Learning Inbox"`                                                             |
| Learning Inbox       | `/admin/learning`                           | `src/app/admin/learning/page.tsx:137`             | `"Learning Inbox"`                                                             |
| Leads                | `/admin/leads`                              | `src/app/admin/leads/page.tsx:270`                | `{adminPageName("leads")}`                                                     |
| Leads                | `/admin/leads`                              | `src/app/admin/leads/page.tsx:278`                | `{adminPageName("leads")}`                                                     |
| Chat enquiries       | `/admin/chat-leads`                         | `src/app/admin/chat-leads/page.tsx:127`           | `{adminPageName("chat-leads")}`                                                |
| Chat enquiries       | `/admin/chat-leads`                         | `src/app/admin/chat-leads/page.tsx:143`           | `{adminPageName("chat-leads")}`                                                |
| Subscribers          | `/admin/subscribers`                        | `src/app/admin/subscribers/page.tsx:78`           | `{adminPageName("subscribers")}`                                               |
| Subscribers          | `/admin/subscribers`                        | `src/app/admin/subscribers/page.tsx:86`           | `{adminPageName("subscribers")}`                                               |
| Partner Applications | `/admin/partners`                           | `src/app/admin/partners/page.tsx:71`              | `{adminPageName("partners")}`                                                  |
| Partner Applications | `/admin/partners`                           | `src/app/admin/partners/page.tsx:79`              | `{adminPageName("partners")}`                                                  |
| Website Grades       | `/admin/website-grades`                     | `src/app/admin/website-grades/page.tsx:89`        | `{adminPageName("website-grades")}`                                            |

## Verification boundary

Passing local checks: semantic inventory and shared identity/mutation fixtures.
Scoped formatting/lint and contract checks are recorded with the commit handoff.

Browser verification has been prepared, not run locally: machine pressure requires
the exact-source CI build/server. CI runs `qa-admin-overhaul.mjs` and retains
`/tmp/accelerate-admin-language/` in `credential-free-browser-evidence`. It covers
the full destination matrix on desktop Paper, then changed guidance surfaces and
contact breadcrumbs at 1440/900/390 pixels in every registered preset. Mobile
uses reduced motion. Console errors and escaped protected demo requests fail.

Existing shell-motion, Contact review states, theme persistence and marketing-demo
suites remain in the same CI job. Their earlier evidence does not prove changed
heading/help components. Screenshot inspection and final CI/build remain necessary
before AC3–AC5 are marked passed. No production deployment is part of this change.
