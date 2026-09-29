# App integration and MCP operation review

Inspected published baseline: `e9f285804d2e1d3bad798db6fe9eae26e8df415f`.
This review belongs to `agent/app-integration-polish`, the direct user-requested
integration candidate. Its PR and final verification receipt pin the tested
commit. Review, main integration and production deployment are separate states.

## What the candidate includes

- Contact source integrity from PR [182](https://github.com/JohnConnorCode/accelerate-site/pull/182),
  including strict parsing, complete source context, explicit refusal, source-order
  review and retained omitted rows. The source task is submitted for review.
- All five task lifecycle commits from PR
  [180](https://github.com/JohnConnorCode/accelerate-site/pull/180), ending at
  `24b93b63f298dfe56a7c2a6c93ab831916a18074`.
- All three Collections policy commits from PR
  [181](https://github.com/JohnConnorCode/accelerate-site/pull/181), ending at
  `7cc8861ff89c09850e7d5632b947a9b6f04f20df`.
- Shared HTTP/stdio MCP validation, bounded UTF-8 framing, live access and module
  rechecks, and a remote stdio connection using an existing workspace bearer key.
- Original source values in contact review, strict file decoding, shared history
  queries, accessible row selection and inclusion, busy-state edit locking, and bounded
  50-row pages that retain every source row and batch-wide approval.
- Combined fixture, documentation, inventory and extension reconciliation.

The candidate preserves the original worker checkouts and unrelated unfinished
work. The atomic review migration is additive and verified in an isolated PostgreSQL
fixture. No production schema, outbound-provider effect, standing delegation,
platform authority or production deployment is changed.

## How coverage was assessed

The generated admin HTTP inventory contains 127 route files and 113 exported
mutation handlers. The reviewed admin screen inventory contains 66 pages and
401 source fingerprints. These are source-drift facts, not operation coverage.
A route with several `action` values has several business operations.

The review also inspected the affected admin clients, shared action review,
domain writers, authentication paths, and bounded searches for client database
mutations and server actions. Login OAuth and password updates are explicit
human authentication paths. Source searches do not establish the semantics of
every possible installed third-party plugin.

The seven existing domain cards remain the authoritative implementation work.
This receipt records the observed gaps and integration evidence; it does not
replace those cards or mark a parent complete from a child slice.

## Operation families

“Covered” below means a registered typed path exists. The final receipt names
the paths exercised in this candidate. It does not extend verification evidence
from a tested child operation to its entire domain.

| Domain and admin operation family                                                  | Shared conversational path or required handoff                                                                           | Remaining business-operation gaps                                                                                                                                                                                                             |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CRM: read people, pipeline and timelines                                           | `search_contacts`, `search_pipeline`, `get_record_timeline`; tenant-scoped reads                                         | Complete entity detail and paginated administration remain separate from bounded search.                                                                                                                                                      |
| CRM: tasks, stage changes and notes                                                | `propose_task`, `propose_task_update`, `propose_stage_change`, `propose_founder_note`; existing queue and executor       | Complete contact/company/legacy inquiry creation, field edits, lifecycle and relationship management; task assignment, deletion and additional admin fields.                                                                                  |
| CRM: contact intake and import review                                              | Canonical contact import service; source integrity and human exact import approval                                       | The importer is not a generic MCP import command. HubSpot/CSV parent work and complete identity reconciliation remain open. Review saving now uses a revision-checked transaction for all rows, approval invalidation and immutable evidence. |
| CRM: ordered owner + stage + follow-up requests                                    | Existing typed stage/task proposals can stage individual work                                                            | A complete plan needs canonical owner editing, ordered steps, disclosed transaction boundaries, per-step receipts and partial recovery. No universal multi-step transaction is claimed.                                                       |
| Commerce: invoicing and collection reminders                                       | Existing approved workflow, `propose_invoice_send`, invoice-page preview/proposal, collection context/reminder tools     | Invoice/history pagination, page design/revocation, proposal draft generation/create/edit/lifecycle, and subscription plan administration.                                                                                                    |
| Commerce: collection case policy                                                   | `preview_collection_policy` → `propose_collection_policy` → human approval → canonical `updateCollectionCase`            | Refreshing an exact selected invoice set still needs a governed conversational adapter. Policy changes send no reminder.                                                                                                                      |
| Configuration: brand, modules and plugin settings                                  | Existing branding and module preview/proposal tools; fresh human admin writer                                            | Provider disconnect, Google sync preferences and other route-owned settings still need canonical typed commands.                                                                                                                              |
| Configuration: secret entry, OAuth consent, connection renewal/revocation          | Secure human interaction in the existing settings/connection UI                                                          | Human handoffs are intentional. Tokens, private keys and OAuth consent are never model-provided authority. A missing ordinary settings tool is still a gap.                                                                                   |
| Content: calendar read, brief generation and existing-item edit                    | `list_content_calendar`, `generate_content_brief`, exact calendar preview/proposal; same admin writer                    | Calendar create/delete/reorder and column administration. Editing a calendar status does not publish content.                                                                                                                                 |
| Content: bearer MCP proposal integration                                           | Active bound workspace/module at preview; exact digest at proposal; actual save retains authenticated human admin checks | Full Content lifecycle coverage remains open.                                                                                                                                                                                                 |
| Engagement: selected campaign and contact bulk operations                          | Campaign activation/duplicate, bounded tag/suppress/enroll proposals, conversation reply and Gmail draft tools           | Campaign create/edit/pause/resume/run/membership; conversation status/assignment/link/task/opportunity; template/version administration, test/send and sequence lifecycle.                                                                    |
| Operator: queue, activity, plugins, work and knowledge                             | Existing bounded read tools, Today views, layout, notes, knowledge and learning proposals                                | Work saved-view CRUD, Kanban column CRUD/reorder, notification preferences, workflow administration, AI conversation/feedback/recovery and remaining memory dispositions.                                                                     |
| Operator: action decisions                                                         | Existing exact review, authenticated human approve/reject and supported retry/reconciliation                             | The model cannot approve its own proposal or promote its own autonomy. Remaining business operations require their own proposals and receipts.                                                                                                |
| Platform: Feature Board definitions, dependencies, agent keys and tenant lifecycle | Separately authenticated founder UI/canonical work-board service                                                         | Platform operations are not exposed through tenant MCP. Complete founder conversational operation coverage remains separate implementation work.                                                                                              |
| Platform: login, password reset, invitations and secret reveal                     | Secure human authentication and invitation acceptance                                                                    | Authentication steps remain user interactions; they do not justify excluding ordinary tenant administration from future typed tool coverage.                                                                                                  |

The detailed [Commerce audit](./COMMERCE-OPERATION-PARITY-2026-09-29.md)
enumerates its route actions and canonical owners. The universal
[AI/admin contract](../contracts/ADMIN-AI-PARITY.md) defines the acceptance gates.
Universal MCP coverage remains incomplete.

## Runtime and execution boundaries

- HTTP request bodies and stdio lines have explicit byte bounds and fatal UTF-8
  decoding. Site Studio keeps its separate larger asset budget.
- MCP notifications have no response or tool side effect. Bound workspace,
  current membership and live module availability are checked before discovery
  and calls. Explicit caller restrictions cannot be broadened by a refresh.
- The stdio bridge uses HTTPS except loopback HTTP, refuses credential-bearing
  URLs and redirects, validates response IDs, and forwards negotiated protocol
  and session headers. It targets this application's JSON-response endpoint;
  arbitrary SSE server responses are not supported by the bridge.
- Task approval includes the exact state read before proposal. Intervening edits
  and write-time races require a new review; reopened and cleared-description
  changes use the same task service as the admin editor.
- Collection policy approval includes server-read case state, revision, recipient
  and verified invoice facts. Replays recover canonical command receipts.
  Provider facts cannot be held transactionally with the local database.
- No raw SQL or arbitrary HTTP mutation tool is introduced. Tenant clients gain
  no founder authority. Disabled modules and revoked access fail closed.

## External verification still required

Controlled local HTTP, subprocess stdio and OAuth tests are distinct from an
actual ChatGPT connection. The live ChatGPT test requires an existing isolated
HTTPS workspace URL and configured access. Environment discovery found no
Accelerate Supabase development branch or Cloudflare preview. The local native
stack exceeded the machine's disk minimum before startup; its downloaded images
were removed. Native OAuth conformance is wired into the existing isolated
connected-fork CI environment; its passing receipt is still required. This is
separate from actual ChatGPT client proof.
Computer Use has no enabled browser surface in this session; Firefox timed out
and the in-app browser is unavailable.

The submitted source PR preview checks report Vercel **Account is blocked**.
That is a hosting-provider check result, not a failure of the local app build.
No production workspace, account change or deployment is substituted for the
missing isolated live proof.

Physical-device performance, production provider behavior and arbitrary external
MCP clients are not established by the local Chromium and controlled transport
fixtures. Required CI and the exact integrated candidate must pass before a
normal main integration. Production release requires a separate explicit request.
