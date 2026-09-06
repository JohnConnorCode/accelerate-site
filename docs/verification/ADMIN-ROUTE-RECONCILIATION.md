# Admin route reconciliation

This inventory gives the next developer a starting point for every retained admin
page: the operator's primary action, its API adapters, imported domain modules,
and direct table references. It covers 44 pages at approved base
`4c7145da424fad02628a2af3ab415631dd1a900e`, including detail pages, authentication,
compatibility redirects and the disabled extension example.

The machine-readable evidence is [admin-route-inventory.json](admin-route-inventory.json).
`domainImports` records direct imports; `directTables` records literal `.from()`
references. Neither establishes a complete call graph or proves a write uses a
canonical service. Read the route's boundary note before implementing a change.

This is Phase B foundation work: shared identities and receipts must agree before
agents can safely act across tools. The existing work cards own implementation
and review. This document does not create a second backlog.

## Find the route

The table names the current primary action and the remaining boundary. Exact page
and adapter paths, service imports, source fingerprints and canonical follow-up
UUIDs are in the JSON. Shared shell actions, such as opening the global AI panel,
are outside the page's primary action map.

| Route                        | Primary action                                                        | Current boundary                                                                                                                      |
| ---------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `/admin`                     | Open Today                                                            | Existing entry redirect; no record source.                                                                                            |
| `/admin/activity`            | Inspect and filter operator audit events                              | Audit events are not the normalized business activity timeline.                                                                       |
| `/admin/ai`                  | Ask the assistant; inspect runs and capabilities                      | Shared AI workspace; writes require the existing action approval path.                                                                |
| `/admin/ai-operations`       | Open AI run history                                                   | Compatibility redirect preserves demo scenario context.                                                                               |
| `/admin/analytics`           | Compare funnel and revenue metrics                                    | Canonical analytics read model; field parity with Revenue remains unproven.                                                           |
| `/admin/bookings`            | Review bookings and change an opportunity stage                       | Stage changes call pipeline.ts; value patches and follow-up task writes remain in the adapter.                                        |
| `/admin/branding`            | Edit workspace branding and preview an invoice                        | Branding service owns tenant presentation settings; previews are not issued invoices.                                                 |
| `/admin/campaigns`           | Preview a campaign audience and manage members                        | Campaign services own execution; previews are not sends.                                                                              |
| `/admin/chat-leads`          | Search and inspect chat inquiries                                     | Retain chat_leads.id and its canonical linkage; bounded display is not a full row reconciliation.                                     |
| `/admin/client-onboarding`   | Preview onboarding tasks and approve a proposed workflow              | Shared task workflow services own proposals and task execution; task adapter reads canonical tasks, opportunities and memberships.    |
| `/admin/clients`             | Filter clients and open a client record                               | Retain clients.id; source values and canonical linkage have different owners.                                                         |
| `/admin/clients/[id]`        | Edit a client and inspect its timeline                                | Client fields remain on clients; email-based timeline lookup needs explicit identity disposition.                                     |
| `/admin/collections`         | Review receivables, record payments and approve reminders             | Collection and reminder services own receivable state and proposals. simulate-payment is demo-only; it is not a production API route. |
| `/admin/contact-imports`     | Preview and apply a contact import                                    | Import and identity services own validation and identity decisions.                                                                   |
| `/admin/contacts`            | Review submissions, export and delete selected records                | List rows are contact_submissions, not the canonical contacts table; preserve source IDs.                                             |
| `/admin/contacts/[email]`    | Inspect a contact timeline                                            | URL identity is email; do not infer canonical uniqueness from the route parameter.                                                    |
| `/admin/content`             | Create content items and move their status                            | content_calendar and kanban_columns remain source records; status changes do not publish content.                                     |
| `/admin/conversations`       | Assign and triage conversations, link an opportunity and send a reply | Conversation and Google services own triage and threaded replies.                                                                     |
| `/admin/email-sequences`     | Filter and inspect email sequence progress                            | Legacy email_sequences read; no canonical execution parity established here.                                                          |
| `/admin/emails`              | Edit and preview templates; inspect delivery history                  | Email template services own saved versions; history is delivery evidence, preview is not delivery.                                    |
| `/admin/example-inventory`   | Read the extension example                                            | Disabled-by-default example page has no inventory records or primary write.                                                           |
| `/admin/features`            | Claim work, record progress and submit evidence                       | Canonical work-board service owns claims and lifecycle; page is its adapter.                                                          |
| `/admin/identity-review`     | Resolve or defer ambiguous identities                                 | Use identity-review service; ambiguity is never permission for an automatic merge.                                                    |
| `/admin/inbox`               | Triage inquiries, tasks and proposed actions                          | Mixed source inbox; reconcile by source type and ID, not just combined row count.                                                     |
| `/admin/integrations`        | Configure integrations, providers and module settings                 | Integration, module and tenant provider services have separate ownership.                                                             |
| `/admin/invoicing`           | Draft invoices, preview pages and request issuance                    | Stripe invoicing, invoice-page and workflow services own separate boundaries; issuing and provider effects use action approval.       |
| `/admin/leads`               | Add a lead and change its stage                                       | Canonical intake and transitions coexist with solution_requests compatibility reads and direct updates.                               |
| `/admin/login`               | Sign in or request a password reset                                   | Authentication boundary; no business record reconciliation applies.                                                                   |
| `/admin/meeting-commitments` | Preview meeting commitments and approve task creation                 | Shared task workflow services own proposals and task execution; source meeting IDs must remain linked to created work.                |
| `/admin/partners`            | Review applications and update their status                           | Preserve partner_applications.id and status; canonical identity linkage does not migrate application fields.                          |
| `/admin/pipeline`            | Create an opportunity and change its stage                            | Canonical pipeline services own opportunity transitions.                                                                              |
| `/admin/pipeline/[id]`       | Inspect an opportunity and its linked work                            | Bounded canonical record read model; inspect referenced services before extending writes.                                             |
| `/admin/plugins`             | Enable a plugin and run an available report                           | Module settings and report-plugin services own configuration and execution; plugin availability is not proof of record parity.        |
| `/admin/proposals`           | Create, edit and send a proposal                                      | Proposal records and adapter actions remain; audit import alone does not make a domain writer.                                        |
| `/admin/recovery`            | Preview eligible recovery contacts and stage a batch                  | Recovery and campaign services own eligibility and staging.                                                                           |
| `/admin/resources`           | Search download records and open a contact                            | resource_downloads.id is a download record; search is page-local and does not edit a resource.                                        |
| `/admin/revenue`             | Inspect recurring value and accepted proposal totals                  | Reads clients and accepted proposals directly; not opportunity revenue or cash receipts.                                              |
| `/admin/settings`            | Save workspace preferences and test configured services               | Admin settings adapter owns preference persistence; service tests can have external effects.                                          |
| `/admin/setup`               | Inspect setup health and run available setup actions                  | Health and schema checks are operational evidence, not business record parity.                                                        |
| `/admin/subscribers`         | Search subscribers and export them                                    | Retain subscribers.id; identity links do not prove consent or delivery-history parity.                                                |
| `/admin/tenants`             | Create a tenant and manage membership                                 | Tenant lifecycle service and membership adapters own this administrative boundary.                                                    |
| `/admin/today`               | Review priorities, complete tasks and decide on actions               | Shared overview, task and action services; layout changes are configuration.                                                          |
| `/admin/update-password`     | Set a new password                                                    | Supabase auth client owns password update; no business record source.                                                                 |
| `/admin/website-grades`      | Inspect website grades and export results                             | Retain website_grades.id and report fields; identity links do not replace grade evidence.                                             |

## Reconciliation work to pick up

Open the live Feature Board and search for the exact key. Read its current claim,
revision and approved base before making changes. A link here does not grant a
claim or replace the live contract.

- `canonical-revenue-activity-parity` (`38a08974-f92b-4106-821b-b328d40090d7`):
  Revenue sums `clients.monthly_value`, `clients.one_time_value` and accepted
  `proposals.total_monthly`; Activity reads operator audit events. Define which
  figures remain contractual client value, which become opportunity metrics, and
  which timeline entries represent immutable business activities. Do not rename
  existing values as cash revenue. Compare full filtered datasets, not list pages.
- `canonical-retained-tools-parity` (`b3be09c1-f11b-48c7-b419-c03921a1f8bc`):
  use the `followUp` entries in the JSON to find the retained source tools. Preserve
  their source fields and IDs while adapting reads. Bookings still patches value
  fields and writes follow-up tasks in its API adapter; Leads mixes canonical
  intake/transitions with direct updates. This read-parity card does not authorize
  rebuilding those writers. Register a bounded write-service card if needed.
- `additional-tools-canonical-parity` (`f1abf523-9c76-4119-9388-8b6294f7cc35`):
  this parent retains the production reconciliation requirement. Neither this
  inventory nor a passing local fixture authorizes retiring a table or route.

## Record IDs and field dispositions

These are source identities to preserve, not production rows that have been
inspected. The fixture IDs below are a recipe for the next card's isolated test
harness; they have not been inserted or verified by this inventory ticket.
Use UUID values when a harness uses UUID columns, and retain this logical label in
its fixture manifest. Keep `tenant_id` in every comparison key.

| Source identity           | Controlled fixture label            | Fields or relationship to reconcile                                                                                              |
| ------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `clients.id`              | `route-parity-client-active-01`     | `status`, `monthly_value`, `one_time_value`, contract dates; canonical contact/company/opportunity links                         |
| `proposals.id`            | `route-parity-proposal-accepted-01` | accepted status, `total_monthly`, `total_one_time`; do not add proposal value to client value without a stated metric definition |
| `solution_requests.id`    | `route-parity-inquiry-01`           | inquiry fields, opportunity source identity, exactly one intake receipt under replay                                             |
| `contact_submissions.id`  | `route-parity-submission-01`        | submission fields, source ID and canonical contact link; email is an attribute, not a replacement ID                             |
| `chat_leads.id`           | `route-parity-chat-01`              | conversation/source evidence, canonical identity and opportunity links                                                           |
| `subscribers.id`          | `route-parity-subscriber-01`        | subscription and consent fields remain source-owned unless a replacement is explicitly proven                                    |
| `resource_downloads.id`   | `route-parity-download-01`          | downloaded resource, source timestamp and person link; one person may have multiple downloads                                    |
| `partner_applications.id` | `route-parity-partner-01`           | application status and application-specific fields                                                                               |
| `website_grades.id`       | `route-parity-grade-01`             | report fields and source timestamps; canonical contact linkage does not replace the report                                       |
| `content_calendar.id`     | `route-parity-content-01`           | content fields, status and `kanban_columns` configuration; no automatic publication inference                                    |
| `email_sequences.id`      | `route-parity-sequence-01`          | source sequence state and delivery history; no implied canonical execution receipt                                               |
| `opportunities.id`        | `route-parity-opportunity-01`       | stage, estimated/won values, transition receipts, linked tasks and activity                                                      |

For linkage, inspect `legacy-adapter.ts`: source record IDs and emails are both
inputs, and a response can return empty links with `schemaReady: false`. A missing
link is an explicit discrepancy. It must not silently become a missing source row.

## Controlled verification procedure

1. In the next claimed card's approved checkout, create an isolated tenant fixture
   with one row for each affected source type. Record its source table, tenant ID,
   concrete row ID, canonical contact/company/opportunity IDs and expected field
   values in a private fixture manifest. Add an unmatched row and two records
   sharing an email to expose identity assumptions.
2. Capture the source read and the proposed canonical read for the same tenant,
   filter, time range and pagination. Compare sets of `(tenant_id, source_type,
source_id)` as well as counts. Compare every displayed field. Record each field
   as canonical, deliberately retained source field, or unresolved. An unresolved
   field blocks that route's parity claim.
3. For Revenue, separately check active-client recurring value, one-time client
   value, accepted proposal value and opportunity metrics. Specify the expected
   inclusion rules before calculating totals. For Activity, distinguish audit
   events from normalized business receipts and compare their record links.
4. Replay the same controlled inquiry twice through its existing canonical intake
   service. Assert one identity/opportunity association and one receipt per
   idempotency boundary. Run missing-schema and ambiguous-identity cases; preserve
   source rows and expose missing linkage. Do not invent another intake writer.
5. Run the affected primary action in the isolated demo or test tenant at desktop
   and mobile widths, including keyboard operation, empty/loading/error states and
   retry. Use mocked providers for sends and setup tests. Retain exact commands,
   commit, fixture IDs, expected/actual rows and opened screenshot evidence.
6. Attach the results to the claimed follow-up card. Production row parity remains
   a separate acceptance on the parent card. This ticket performed no database
   mutation, provider send or runtime parity test.

## Keep the inventory useful

Run `npm run test:admin-route-inventory`. It checks all admin page paths, unique
rows, primary actions, explicit service dispositions, follow-up identifiers and
source fingerprints. Seven regression cases include omitted/duplicate routes,
stale evidence and missing handoff details. This replaces the irrelevant public
industry-link test as this card's scoped verification.

When the check reports drift, inspect the changed page, component, adapter and
service. Edit its row, primary action, adapters, boundary and linked work first.
Then run `node scripts/admin-route-inventory.mjs --refresh` and rerun the test.
Refresh updates static import/table observations and fingerprints; it does not
write human boundary notes, discover omitted adapter calls or prove parity.
Review the diff before committing. Never use refresh to bless an unexplained
source change. This report is bound to its checked-out tree, not every active
branch.

## Base correction discovered during real pickup

The initial base `50f3aa671751619f44af22bb0736618c362d1b6b` failed CI on
pre-existing broken documentation references and omitted six retained pages.
The maintainer recorded the reason on the live card, released the claim, changed
only this ticket's approved base to the verified development baseline, and
reclaimed it. The original implementation commit remains in history.

Before assigning another unclaimed ticket, validate its exact base against a
passing CI receipt and the sources required by its scope. An existing commit and
resolvable references are necessary, but they do not prove a usable development
base. Preserve other workers' bases; make any approved change through the live
card with a recorded reason. Source-only inventory checks still do not prove
runtime or production data parity.
