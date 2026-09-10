# Work surfaces and App extensibility

This contract applies to the v2 Command Center redesign. It records the source
ownership and semantic requirements from the supplied Admin Product UX and Docs
Product Education briefs, including their extensibility corrections and the
founder's subsequent full-customization instruction. Implementation and acceptance
status belong to the live `command-center-product-redesign-v2` Feature Board card.
This document does not claim the target surfaces are already implemented.

## Product vocabulary

| Concept  | Responsibility                                                                  |
| -------- | ------------------------------------------------------------------------------- |
| Record   | Own a business entity or fact with a stable identity.                           |
| Signal   | Describe evidence worth noticing without automatically creating work.           |
| Task     | Own a person's assigned work, due date and completion state.                    |
| Approval | Record a decision about an exact proposed change and its evidence.              |
| Action   | Execute a validated command through its domain service.                         |
| Workflow | Own an execution definition and its runs; expose human exceptions deliberately. |
| Activity | Retain immutable historical events and results.                                 |
| View     | Project source records without owning a second lifecycle.                       |

Use **App** for an operator-facing business capability. **Plugin**, **module**,
**adapter** and **tool** remain precise builder terms for its implementation.
Use **next step** for a record's suggested business follow-up. An action is an
executable operation, not a generic synonym for an item in a list. Preserve
existing storage keys and compatibility URLs when changing display language.

## Current source inventory

| Surface or object            | Current owner                                                   | Redesign obligation                                                                           |
| ---------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Human task                   | `src/lib/revenue-os/tasks.ts`, `tasks`                          | Reuse create, patch, complete and snooze services from every view.                            |
| Proposed action and approval | `actions.ts`, `action-executor.ts`, `action_queue`              | Bind review to exact payload and source version; retain terminal receipt.                     |
| Today                        | `queue.ts`, `/api/admin/revenue-os/overview`, `/admin/today`    | Replace ambiguous display kinds with explicit source identity and attention meaning.          |
| Customer conversation        | `conversations.ts`, `/admin/conversations`                      | Preserve conversation ownership; a reply suggestion is not automatically a task.              |
| Current mixed Inbox          | `/admin/inbox`, `src/lib/admin/inbox.ts`                        | Keep compatibility access while separating conversations, intake and work in navigation.      |
| Collections                  | Collection domain services and `/admin/collections`             | Retain case lifecycle, invoice facts, promises and disputes; approvals are linked operations. |
| Radar                        | Radar domain services and `/admin/radar`                        | Retain source, opportunity and review state; do not copy it into generic tasks.               |
| App registration             | `modules.ts`, `extensions/*.module.json` and generated registry | Extend the existing registration path rather than add a competing plugin registry.            |
| Custom record types          | `entity-registry.ts` and capability data services               | Keep tenant scope, stable source references, disabled-type and merge conventions.             |
| Layout configuration         | `admin-layout.ts` and registered layout scopes                  | Preserve existing overrides; current reordering/hiding is not an arbitrary UI builder.        |
| Demo                         | `src/lib/admin/demo/runtime.ts` and business/domain runtimes    | Use shared UI and one session-local authoritative object per fixture.                         |
| Public guides                | `src/content/docs/manifest.ts` and MDX                          | Keep source paths, current controls, examples and capability status truthful.                 |

The current queue can label a recovery task as a reply. It also contains
conversations, proposals and meetings. Source identity must therefore come from
the owning object, not from the old presentation kind. Existing demo task writes
also require review: an edit or snooze must not be treated as completion simply
because it reaches a task endpoint.

## Shared attention and work

The composable Today follow-up uses `today-snapshot.ts` over canonical queue,
activity, WorkItem and App readers. Saved `today-views.ts` documents own only
arrangement and preferences, with private member scope or administrator-managed
workspace defaults. Muted watch items resurface when their exact evidence
changes, and a persistent control exposes unfiltered attention. Business Pulse
interpretations are separately labeled, evidence-bound and read-only. Page
refresh never performs a model or provider operation. Legacy layout overrides
seed the default arrangement; the workspace can return to classic Today.

Today is an optional attention projection. Each contribution identifies its
`sourceType`, `sourceId`, reason, related records and any relevant due date or
severity. An attention category such as decision, work, watch or upcoming controls
presentation; it does not replace the domain object's type or lifecycle. A
projection may have its own stable display ID but must not persist copied status.

A command delegates to the owning service and rechecks authorization, module
availability and source freshness. Resolving an object from Today or its native
workspace must converge on the same saved state. Search, AI and activity references
must resolve to that same object. A dismissed finding must not complete its source
record, create an implicit task or suppress newly changed evidence indefinitely.

Work starts with shared Tasks and Approvals and can provide access to custom
work types. Successful background runs belong in activity. A failed run may
contribute an explicit recovery decision or task when human involvement is needed.

## Open extension architecture

Tasks and Approvals are defaults, not a closed ontology. An App may:

- reuse or extend a shared primitive;
- define a domain work type with its own lifecycle and native queue;
- compose existing operations into a workflow;
- provide a bespoke interface or replace an operating surface;
- contribute to Today, Work, search and AI where useful, or opt out of those views.

Mutable types declare their source identity, owning service, lifecycle and
permission behavior. Optional host participation describes attention, decisions,
commands, activity, search, AI and views. These are integration obligations; they
do not imply that arbitrary new fields already work in the current manifest.
Runtime support must be wired, tested and documented before being advertised.

A Creative Review App is a useful acceptance example: it owns review rounds and
revision acceptance, while a linked preparation task owns a person's separate
work. A native review decision and a host approval must not independently own the
same transition. Collections and Radar provide existing domain-native examples.

## AI App authoring direction

The northstar owns the long-term in-app authoring architecture: description,
isolated draft, preview, source and capability inspection, verification, immutable
publication, updates and compatible rollback. Current delivery remains source
based. Simplified default screens must preserve this path; the redesign must not
claim a general-purpose terminal or in-app builder has shipped.

The founder cited [Kyma's documentation](https://www.kymainfostructure.com/docs)
as inspiration. Its public documentation describes KAOS terminal capabilities and
Dev Team drafts that are previewed and published as versioned workstations. Those
are external product descriptions, not verification of its implementation or a
requirement to copy its technology stack. Accelerate keeps its existing shared
business runtime and introduces new authoring capabilities through explicit work.

## Verification expectations

Use the same approval from Today and Work and confirm one decision and receipt.
Complete a task in either view and read the same task in the other. Dismiss a
signal without creating a task. Create four meeting tasks and retain their meeting
references. Confirm a successful workflow does not add human attention, while a
failure offers an explicit recovery path. Test a domain case without converting
its lifecycle to Task or Approval.

Verify disabled modules, unauthorized users, tenant switches, stale versions,
replay, empty results and failures through the shared services and fictional demo.
For UI changes, inspect desktop, tablet and mobile, keyboard and reduced motion,
including direct routes and return navigation. Source checks alone do not satisfy
visual acceptance. Public docs, changelog and Command Center copy must describe
only the behavior established by those checks.
