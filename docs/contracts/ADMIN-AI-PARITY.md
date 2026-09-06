# Universal approved AI access to admin

The AI is a complete conversational interface to the admin. The product target
is that a user can ask it to inspect, create, update, organize, run, publish,
archive or remove anything that user is authorized to manage in the admin.
This includes configuration and plugin workflows, not just selected CRM tools.
Every write requested through this interface requires human approval by default.
This document defines the target and contributor contract; universal runtime
coverage is **not implemented yet**.

## One command, several interfaces

Each business operation has one validated domain service and one versioned
command definition. Admin controls, internal AI, tenant MCP and plugin tools
adapt that definition. Extend `ai-tools.ts`, the current action queue/executor,
capability graph and module manifests; do not introduce a competing registry or
write backend. An operation may be available only to the founder, a tenant member,
or an explicitly authorized agent. The conversational interface preserves that
scope. Platform administration requires a separately authenticated founder path;
it must never be added to a tenant MCP catalogue.

Each operation contract identifies:

- Stable operation ID, version, module owner, schema and canonical service target.
- Search/read context, canonical target IDs, writable fields and related records.
- Required actor/record permissions, tenant scope and provider capabilities.
- Impact, exact preview, approval requirement, expiry and freshness preconditions.
- Tenant-composite idempotency, execution claim, truthful receipt and audit links.
- Reversibility or compensating action, with explicit limitations.
- Admin, AI/MCP and shared-demo entrypoints, plus parity verification evidence.

Plugin authors provide these same operation definitions for every contributed
business control. Installation, enable/disable and upgrade must update discovery;
disabled execution is rechecked at dispatch, including already queued changes.
Historical records and receipts remain accessible through authorized core reads.

## The conversation is the work interface

For example, “Change Acme's owner to Maya, move the opportunity to Qualified,
and set a Friday follow-up” resolves exact records and prepares three reviewable
changes. The approval shows current and proposed values, linked records, affected
counts, assumptions, side effects and any unavailable step. Ambiguous identities
or dates require clarification. The AI can revise the proposal conversationally.
A revision invalidates the earlier approval; it cannot silently change an approved
payload. Approval and execution receipts stay attached to the conversation and
canonical records. Reloading or opening the admin preserves this work.

The same interaction applies to “Use our new logo and colors,” “Pause this
campaign,” “Update these invoice terms,” or “Archive these old content drafts.”
Search and tool discovery must cover the whole authorized workspace regardless
of the current page or initial tool pack. Load relevant operation schemas on
demand to keep context bounded. Page context is useful evidence, not a limit on
what the user may request.

## Approval and execution contract

1. Authenticate the actor and resolve tenant/platform scope and current module
   capabilities. Read bounded canonical context through the same admin services.
2. Validate a narrowly typed business command and construct an exact preview.
   The model cannot supply approval identity, role, tenant authority or trusted
   provider facts. No arbitrary SQL or raw HTTP mutation tool is needed.
3. Persist the proposal in the existing durable approval system, bound to the
   normalized payload, target IDs, relevant revisions and expiry. Creating a
   pending proposal is not applying its business change.
4. An authenticated human approves, edits or rejects in the shared review UI.
   The AI cannot call an approval endpoint or approve its own policy change.
   Secret entry and OAuth consent use a secure user interaction; tool context
   contains configuration references and redacted status, never secret values.
5. On approval, recheck the approver's permissions, active membership, module,
   target state and preconditions. Changed data, revoked access or a stale
   preview requires a new review. Use the canonical execution claim and service.
6. Persist a truthful receipt and audit/provenance. Confirm success only from the
   service/provider outcome. Retry with the same idempotency key; uncertain
   external outcomes require receipt reconciliation before another attempt.

Multi-operation requests need an explicit ordered plan. Where a transaction is
possible, state that boundary. Otherwise disclose non-atomic execution, stop or
continue policy, per-step receipts and safe retry/compensation. Never report a
partially applied plan as complete. Bulk previews show an exact bounded record
set and count; execution cannot silently expand to newly matching records.

Universal coverage includes destructive operations that the admin legitimately
supports, with an explicit impact warning and human approval. It does not invent
hard deletion for objects whose lifecycle is suspension or archival. Standing
autonomy remains a separate, human-established policy; this requirement does not
authorize enabling it or allowing the AI to grant itself privileges.

## Coverage and contributor gate

The live Feature Board owns implementation status and dependencies. Start with
`universal-admin-ai-parity-foundation` and its linked domain work. A domain card
must enumerate business operations inside each route, server action and client
write, then map them to the existing service, tool, approval and receipt. A route
with multiple `action` values is several operations. A POST may only preview or
authenticate. Transport inventory alone proves neither semantics nor parity.

The checked-in [route inventory](../generated/admin-ai-route-inventory.json)
records all exported admin HTTP handlers, imports for navigation and source
fingerprints. CI fails if handlers or source change without refreshing the
inventory. Aliases and named reexports are included; ambiguous wildcard exports
fail closed. This is an initial drift detector, not a universal-access switch or
a full inventory of server actions, other API roots and direct client mutations.
Domain implementation cards must inspect those additional paths.

After reviewing a route change and updating its live parity card:

```bash
node scripts/admin-ai-inventory.mjs --write
node scripts/admin-ai-inventory.mjs --check
node --test scripts/test-admin-ai-inventory.mjs
```

Do not call a domain complete until each supported operation has an end-to-end
UI/AI/MCP test through the same service: valid preview, exact approval, edit and
reapproval, denial, expiry, stale data, foreign tenant, revoked permission,
disabled plugin, replay/concurrent execution and provider failure where relevant.
Verify the shared demo at desktop/mobile widths with fictional data and no live
side effects. Authentication-only steps are explicitly classified secure human
handoffs; missing business tools stay visible as implementation gaps.

## Current baseline

Main `57e5ef3` has 50 registered AI tools and working approval paths for selected
operations, including Collections. Many admin operations are not registered.
The inventory currently covers 86 route files and 76 exported POST/PUT/PATCH/DELETE
handlers. These counts are transport facts, not business-operation counts or a
coverage percentage. This foundation changes engineering requirements and drift
detection; it does not grant additional runtime write authority.

## Implemented branding write path

The branding slice adds `get_workspace_brand`, `preview_workspace_brand_update`
and `propose_workspace_brand_update` to all three current AI tool packs and the
shared MCP registry. Preview accepts a strict partial change, for example
`{"changes":{"accentColor":"#234567"}}`. It returns current/proposed values and
a digest. Proposal requires the same changes and digest, creates a pending action
with a one-hour expiry, and makes no branding change.

The human reviews that action in the existing approval queue. Execution uses the
same branding revision/config compare-and-swap save as the admin form, through a
host-owned writer which checks the current authenticated administrator, database
scope, active membership and workspace state before obtaining write authority.
A stale brand, invalid contrast, changed payload or revoked access refuses the
save. The before-state remains available for a separately reviewed restorative
change; automatic undo is not claimed. These tools cannot approve their own work
or save autonomously. Model-generated image creation and secure asset upload are
separate capabilities; the branding tool accepts an approved HTTPS asset URL.

This closes branding parity only. The larger domain and permission/executor
initiatives remain open. The demo continues to use its session-local branding
transport and shared capability metadata; its assistant is a simulation, not a
live provider-backed agent.

## Implemented plugin and module configuration path

`get_module_configuration` returns current enablement, declared public settings,
field metadata and revision for one module or the bounded module catalogue.
`preview_module_configuration` accepts a change such as
`{"change":{"moduleId":"receivables-collections","settings":{"cooldownHours":24}}}`
or `{"change":{"moduleId":"receivables-collections","enabled":false}}`.
It returns exact before/after values and consequences; `propose_module_configuration`
requires that same change and digest and queues a one-hour pending action.

Human approval uses the same current-admin writer and configuration CAS service
as the normal module controls. The digest binds tenant, target enablement/settings
and current module definition; stale changes require another review. Core toggles,
unknown fields, invalid ranges and no-ops refuse. Disable retains data and receipts;
core management tools remain available to re-enable the module. Enabling bundled
plugins may install missing host-owned read policies, which are retained and
idempotent, not automatically removed by a later disable. Stale target revision
checks precede that installation. A configuration save and those policy insertions
are separate operations; no atomic rollback across them is claimed.

No secret values or arbitrary tenant settings are exposed. Provider credentials,
OAuth, sync controls and the other domain cards remain outstanding. The module
configuration tool does not run a newly enabled business workflow or grant standing
autonomy. Registry `revenue-os-tools.v8` includes 56 tools; the shared demo catalogue
uses the same module-control metadata with simulated outcomes.

## Cross-domain tool discovery (implemented, run scoped)

The command agent starts with eight common tools, including `discover_tool_bundles`
and `activate_tool_bundle`. A module's existing `aiToolNames` declarations generate
its bundles. Large modules are split into deterministic groups; one activated
bundle plus the core contributes at most 40 schemas per model turn. Every registered
tool must have exactly one module owner. The shared discovery test fails CI for
missing or duplicate ownership instead of silently dropping tools.

Discovery searches module metadata and tool names with pagination. Activation
loads schemas on the next turn of the current command run. The initial page/legacy
pack remains navigation context, so it does not hide another admin domain. The
host refuses a tool call that was not advertised on that turn, including an
activation and new tool call attempted together. Tenant activity and live module
configuration are refreshed before each turn and dispatch. Explicit caller module
restrictions and legacy MCP pack restrictions remain in force; activation grants
no approval, provider connection or new permission.

Proposals continue through existing services and the human approval queue. Only
successfully returned proposals are reported as staged; refused attempts remain
error receipts. Activation is traced but is **not restored across command runs or
conversation reloads** yet. The broader progressive-disclosure card retains durable
activation, richer live trust/recipe descriptions and SDK work. The 50-plugin
fixture proves bounded schemas, complete reachability and exact-domain deterministic
selection; it does not measure real-model natural-language selection accuracy.
