# Workspace Architect — Backlog Analysis and Card Plan

Source spec: Workspace Architect Requirements Specification (§1–§44).
Date: 2026-09-08. Live board was unreachable (`WORK_BOARD_URL` unset), so this
plan is a version-controlled proposal. Promote cards to the live board via a
reviewed `seed:features` plan; do not hand-edit live revisions.

## 1. Backlog overlap analysis (from `docs/planning/backlog-snapshot.json`, 183 active cards)

No existing card implements a Workspace Blueprint, Architect, or compiler. The
spec is a new initiative. Related cards it must reuse — not duplicate:

| Spec area | Existing card(s) | Relationship |
|---|---|---|
| First-run setup / guided onboarding (§5) | `guided-first-run-setup` (backlog) | Architect is the engine that could drive guided setup; setup card owns the resumable-step UX |
| Custom objects / typed fields (§6, §10 L4) | `custom-data-model` (backlog, later) | Architect registers types **through** this; WA-05 depends on it |
| Saved views server-side (§19) | `server-side-saved-views` (backlog, later), `report-recipe-engine` (later) | Blueprint views/dashboards compile to these; WA-11 depends on them |
| Dashboards / metrics (§18) | `dashboards-and-metrics` (backlog, later) | Same — compile target, not parallel implementation |
| Workflow designer / triggers (§13) | `workflow-builder` (backlog, later) | Architect generates definitions the builder executes; shares capability checks |
| Vertical templates / distributions (§32, §33) | `vertical-business-templates`, `plugin-vertical-distributions` (backlog, later) | These become **outputs** of the Architect ecosystem phase (WA-14), not inputs |
| Playbook de-verticalization (§10 L3) | `de-vertical-inbound` (planned, next) | First evidence that config-beats-code works; pattern to follow |
| CSV/HubSpot import (§5.2 context) | `csv-hubspot-importers` (backlog, next) | One ingestion source for business context; WA-04 consumes, never reimplements |
| Roles / permissions (§10 policies, §26) | `roles-and-permissions` (backlog, next) | Blueprint permission policies compile to this; WA-08 depends on it |
| Capability resolution (§21) | `capability-graph-canonical` (shipped), `capabilities.ts` | WA-02 validates against this registry; no second registry |
| Coworkers / Skills (§15, §16) | `coworker-model` (shipped), `coworkers.ts`, plugin skill work | WA-10 proposes configs for the existing runtime only |
| Evidence / claims (§9, §38) | `evidence-claim-ledger` (shipped), `claims.ts` | Blueprint evidence refs link here; no parallel ledger |
| Action / Approval (§26) | `actions.ts`, `action-executor.ts`, `unified-action-executor` (planned) | Compiler applies through these boundaries |
| First value journey (§42) | `first-value-business-journey` (backlog, now) | WA-16 acceptance scenario must align with this journey |

Hard rule for every card below: reuse the module in the right column. A second
entity runtime, task system, workflow engine, agent object, integration
registry, or approval queue is a scope violation (§4, acceptance §43.18).

## 2. Card organization

Initiative: **Workspace Architect**. 16 cards in spec §41 phase order. Each card
lists taxonomy labels from `docs/contracts/FEATURE-BOARD-TAXONOMY.md`
(one category, one numeric phase, milestone, ≤2 allowlisted capabilities) plus
the northstar phase/layers for the packet.

- Phase 1 — Blueprint Foundation: WA-01…WA-04
- Phase 2 — Entity & Lifecycle: WA-05, WA-06
- Phase 3 — Workflow Compiler: WA-07…WA-09
- Phase 4 — Coworkers, Skills, Attention: WA-10, WA-11
- Phase 5 — Conversational Evolution: WA-12
- Phase 6 — Custom App Handoff: WA-13
- Phase 7 — Reusable Ecosystem: WA-14
- Cross-cutting: WA-15 (security/interview), WA-16 (end-to-end acceptance)

Dependency order: WA-01 → WA-02 → WA-03, WA-04 → WA-05 → WA-06 → WA-07 →
WA-08 → WA-09; WA-10 and WA-11 need WA-01+WA-02 only; WA-12 needs
WA-01+WA-02+WA-08; WA-13 needs WA-02; WA-14 needs WA-01+WA-08; WA-15 constrains
all AI-touching cards; WA-16 is last.

## 3. Cards

### WA-01 — WorkspaceBlueprint schema, versioning, and evidence model
- Spec: §8, §9, §27, §38. Phase 1.
- Labels: `category:platform`, `phase:2`, `milestone:next`, `capability:platform`, `capability:data`. Northstar D; layers Remember.
- Scope:
  - Versioned `WorkspaceBlueprint` document schema following repo conventions (zod), with `schemaVersion`, evidence refs, assumptions, unresolved questions.
  - Every major recommendation carries exactly one of fact / inference / recommendation / missing — enforced by type, not copy.
  - Append-only `WorkspaceBlueprintVersion` chain (`parentVersionId`); never overwrite.
  - Tenant-scoped persistence (`workspace_blueprints`, `workspace_blueprint_versions`), additive migration, RLS, audit on apply only.
  - Pure offline unit tests: valid/invalid documents, classification enforcement, version-chain integrity.
- Depends on: none (reads `schema-contract.ts` conventions).
- Acceptance:
  - AC1: Invalid/misclassified blueprint documents fail validation with field-level errors (local).
  - AC2: Version history is append-only; prior versions remain readable after revision (local).
  - AC3: Tables are tenant-isolated; cross-tenant reads are refused (local, two-tenant fixture).
- Verification: `verify:agent-contract`, `tsc`, `lint`, `test:workspace-blueprint`, `build`, `git diff --check`.
- References: `src/lib/revenue-os/schema-contract.ts`, `src/lib/revenue-os/claims.ts` (evidence-link pattern), `src/lib/revenue-os/entity-registry.ts`.

### WA-02 — Blueprint deterministic validator against live capabilities
- Spec: §21, §35.7–8, §43.5. Phase 1.
- Labels: `category:platform`, `phase:2`, `milestone:next`, `capability:capability-graph`. Northstar D; layers Remember, Act.
- Scope:
  - Validator resolves every workflow step, integration, module, and navigation target against `capabilities.ts`, `modules.ts`, `entity-registry.ts`, integration registry.
  - Unknown commands fail closed; per-item Ready / Blocked(reason) / Approval-required output.
  - Blocked capabilities name the missing connection or approval; never silent substitution.
  - Rejects navigation to unregistered routes and references to disabled modules.
- Depends on: WA-01.
- Acceptance:
  - AC1: Blueprint referencing an unregistered capability is rejected with the exact key (local).
  - AC2: Missing integration surfaces as Blocked with reason, not failure (local).
  - AC3: Disabled-module navigation is rejected (local).
- Verification: `verify:agent-contract`, `tsc`, `lint`, `test:workspace-blueprint`, `build`, `git diff --check`.

### WA-03 — Blueprint review and approval surface
- Spec: §23, §26 (low-risk path). Phase 1.
- Labels: `category:operator`, `phase:3`, `milestone:next`, `capability:admin-ux`. Northstar D; layers Act.
- Scope:
  - Read-only review screen: business model, workflows, boards, coworkers, integrations, questions/assumptions.
  - Primary **Build my workspace** stages one Blueprint-level approval for low-risk changes; structural changes require explicit workspace-change approval.
  - Secondary edit path creates a new Blueprint version, never mutates the reviewed one.
  - Desktop/mobile, keyboard, reduced-motion QA on the review screen.
- Depends on: WA-01, WA-02.
- Acceptance: AC1 review renders all sections from a fixture blueprint; AC2 approval gates by impact class; AC3 edit forks a version. All local + Playwright.
- References: `src/app/admin/*` review-dialog patterns, `actions.ts`.

### WA-04 — Staged business-context ingestion and summarization pipeline
- Spec: §5, §36, §37. Phase 1.
- Labels: `category:intelligence`, `phase:2`, `milestone:next`, `capability:knowledge`, `capability:ai`. Northstar D; layers See, Remember.
- Scope:
  - Staged pipeline raw sources → summaries → claims/process evidence → normalized business model, with provenance links.
  - Separate bounded AI jobs (summarize, extract, contradict, propose, clarify); every structured output schema-validated, retry-or-reject on invalid.
  - Uploaded/provider content treated as data, never instructions (prompt-injection boundary tests).
  - Conversational input and existing Accelerate records as evidence sources; no full-dump single prompts.
- Depends on: WA-01 (evidence model), `csv-hubspot-importers` as one source adapter.
- Acceptance: AC1 staged outputs retain provenance; AC2 invalid model output is rejected, never persisted; AC3 embedded instructions in source docs do not alter behavior. Local.
- References: `src/lib/revenue-os/ai-agent.ts`, `ai-context.ts`, `knowledge.ts`, `contact-imports.ts`.

### WA-05 — Business entity extraction with core-vs-custom resolution
- Spec: §6, §10. Phase 2.
- Labels: `category:platform`, `phase:3`, `milestone:later`, `capability:platform`, `capability:identity`. Northstar D; layers Remember.
- Scope:
  - `BusinessEntityCandidate` extraction (name, description, evidence, possible existing type, confidence, questions).
  - Mandatory Entity Registry lookup first; reuse Contact+Opportunity etc. when semantics match (e.g. never `SalesLead`).
  - Reuse-hierarchy decision L1–L5 recorded per candidate with rationale.
  - Custom types register through `custom-data-model`, never a parallel store.
- Depends on: WA-01, WA-04, `custom-data-model`.
- Acceptance: AC1 known-concept fixtures resolve to core primitives; AC2 genuinely new concepts register custom types; AC3 every decision records its hierarchy level. Local.

### WA-06 — Lifecycle extraction and Kanban-as-projection boards
- Spec: §7, §12. Phase 2.
- Labels: `category:operator`, `phase:3`, `milestone:later`, `capability:pipeline`, `capability:admin-ux`. Northstar D; layers Remember, Act.
- Scope:
  - Lifecycle inference assigned to exactly one owner: core entity, core extension, custom type, or cross-object workflow — never forced into Task status.
  - Board definitions reference authoritative state fields; card moves dispatch approved domain commands.
  - Migration plan for existing records: explicit retain/review behavior, no silent restaging.
- Depends on: WA-05.
- Acceptance: AC1 board columns map 1:1 to lifecycle states; AC2 card move updates the entity via domain service; AC3 lifecycle change ships an explicit migration plan. Local.

### WA-07 — Workflow and trigger generation (deterministic-before-AI)
- Spec: §13, §14, §21. Phase 3.
- Labels: `category:operator`, `phase:4`, `milestone:later`, `capability:automation`. Northstar D; layers Act.
- Scope:
  - Generated workflows declare trigger, records, deterministic steps, AI-judgment steps, actions, approvals, external effects, retries, failure behavior, outcome, required integrations.
  - Deterministic-before-AI enforced: facts from the database, models only for interpretation/generation/classification/planning/judgment.
  - Compiler refuses unsupported steps; capability status per step (Ready/Blocked/Approval).
- Depends on: WA-02, WA-06, `workflow-builder`.
- Acceptance: AC1 AI-step audit proves no fact-finding LLMs; AC2 unsupported step refused with reason; AC3 per-step capability display matches registry. Local.

### WA-08 — Blueprint compiler preflight and governed apply
- Spec: §25, §26. Phase 3.
- Labels: `category:runtime`, `phase:4`, `milestone:later`, `capability:work-engine`. Northstar D; layers Act.
- Scope:
  - Deterministic compiler: entities→Entity Registry, boards/views→board config, workflows→definitions, coworkers→registry, skills→registry, attention→Today config, policies→autonomy/permission services.
  - Preflight plan with counts and `0 destructive operations` enforcement.
  - Apply routes through `action_queue` / `action-executor.ts` with impact-class approvals; tenant isolation and audit on every change.
- Depends on: WA-02, WA-07, `unified-action-executor`, `roles-and-permissions`.
- Acceptance: AC1 preflight counts match applied changes; AC2 structural change without approval is refused; AC3 every applied change has audit history. Local + replay/duplicate proof.

### WA-09 — Blueprint simulator on fictional state
- Spec: §24. Phase 3.
- Labels: `category:quality`, `phase:4`, `milestone:later`, `capability:testing`. Northstar D; layers Act.
- Scope:
  - Scenario runner (new lead, overdue invoice, …) against Blueprint definitions with fictional data.
  - Shows entity/work/board/Today effects step by step; zero live side effects by construction (no provider clients in the simulator path).
  - Simulation output clearly labeled fictional.
- Depends on: WA-08.
- Acceptance: AC1 scenarios produce the spec §24 traces; AC2 simulator has no import path to send/connect adapters (contract test); AC3 fictional labeling asserted. Local.

### WA-10 — Coworker and Skill proposal generation (drafts)
- Spec: §15, §16. Phase 4.
- Labels: `category:runtime`, `phase:5`, `milestone:later`, `capability:coworkers`. Northstar D; layers Act.
- Scope:
  - Responsibility extraction → Coworker proposals (purpose, work kinds, capabilities, skills, entities, model/budget, memory scope, autonomy, escalation) bound to the existing Coworker runtime.
  - Repeated-procedure → Skill drafts (outcome, context, procedure, tools, examples, constraints, output structure, approvals, evaluator); drafts until approved.
  - No parallel Agent object.
- Depends on: WA-01, WA-02.
- Acceptance: AC1 proposals reference only registered capabilities/work kinds; AC2 skills are inert drafts pre-approval; AC3 unknown capability fails closed. Local.

### WA-11 — Attention rules, dashboards, saved views, integration requirements
- Spec: §17, §18, §19, §20. Phase 4.
- Labels: `category:intelligence`, `phase:5`, `milestone:later`, `capability:knowledge`. Northstar D; layers Notice.
- Scope:
  - Attention rules as Today projections (no second lifecycle state).
  - Dashboard widgets bound to declared real queries; unsupported metrics rejected, never invented.
  - Views as deterministic filter/sort/group/column configs via `server-side-saved-views` / `report-recipe-engine`.
  - `IntegrationRequirement` per capability with current status from the live registry.
- Depends on: WA-01, WA-02, `server-side-saved-views`, `dashboards-and-metrics`.
- Acceptance: AC1 Today stays a projection (no new state column); AC2 invented-metric fixture rejected; AC3 integration statuses match registry. Local.

### WA-12 — Conversational revision, diffs, impact analysis, migration
- Spec: §28, §29, §30. Phase 5.
- Labels: `category:operator`, `phase:5`, `milestone:later`, `capability:admin-ux`, `capability:automation`. Northstar E; layers Act.
- Scope:
  - Natural-language change → Blueprint diff with downstream impact list (records, workflows, boards, views, coworkers, skills, navigation, policies, migrations, orphaned state).
  - Revision cannot silently invalidate existing records; migration behavior explicit.
  - Rollback via version history.
- Depends on: WA-01, WA-08.
- Acceptance: AC1 vendor-sampling example diff matches spec §28; AC2 orphaned-state fixture blocks silent apply; AC3 rollback restores prior version behavior. Local.

### WA-13 — Custom App escalation brief and Site Studio handoff
- Spec: §31, §34. Phase 6.
- Labels: `category:productization`, `phase:5`, `milestone:later`, `capability:productization`. Northstar E; layers Act.
- Scope:
  - Unsupported-requirement detection → `CustomAppBrief` (problem, entities, lifecycle, UI, commands, permissions, integrations, reusable services, acceptance).
  - Never fake a generic solution for specialized UI (e.g. side-by-side sample review).
  - Site needs forwarded as requirements to Site Studio; no direct site mutation.
- Depends on: WA-02.
- Acceptance: AC1 specialized-UI fixture yields a brief, not a board; AC2 brief names reusable core services; AC3 no site writes from the Architect path. Local.

### WA-14 — Blueprint export/import and sanitized industry templates
- Spec: §32, §33 (ecosystem; publication flow explicitly post-V1). Phase 7.
- Labels: `category:productization`, `phase:6`, `milestone:later`, `capability:productization`. Northstar E; layers Learn.
- Scope:
  - Export portable artifact (`blueprint.json`, entities, workflows, views, skills, coworkers, README); strip secrets/PII/records by construction.
  - Import validates schema version and capability availability in the target workspace.
  - Sanitization pipeline generalizing a bespoke Blueprint into a template, with human review gate.
- Depends on: WA-01, WA-08.
- Acceptance: AC1 export of a fixture contains no secrets/PII (scanner test); AC2 import of a tampered package fails; AC3 sanitized template passes WA-02 in a clean workspace. Local.

### WA-15 — Architect security hardening, conflicts, clarification interview
- Spec: §22, §35, §39. Cross-cutting, constrains all AI-touching cards.
- Labels: `category:governance`, `phase:3`, `milestone:next`, `capability:security`, `capability:autonomy-policy`. Northstar D; layers See, Act.
- Scope:
  - Enforce the 12 fail-closed rules (§35): data-vs-instruction, no self-ceiling changes, no silent provider connects, no autonomous external actions, no approval bypass, tenant isolation, registered-capability-only steps, unknown-command failure, evidence retention, audit, no secrets in Blueprint JSON, side-effect-free simulation.
  - Conflict detection surfaces default-vs-exception with a question instead of picking silently.
  - Minimal high-value clarification questions only; structural ambiguity prioritized.
- Depends on: WA-01, WA-02. Blocks acceptance of WA-04, WA-07, WA-08, WA-09.
- Acceptance: AC1 each of the 12 rules has a negative test; AC2 conflict fixture yields a question; AC3 trivial-question fixture yields none. Local.

### WA-16 — Manufacturing acceptance scenario end to end
- Spec: §42, §43 (all 18 criteria). Last.
- Labels: `category:quality`, `phase:6`, `milestone:later`, `capability:testing`, `capability:productization`. Northstar E; layers See → Learn.
- Scope:
  - Fictional deposit→sample→review→revision→QA→ship→pay business; expects Contact/Company/Opportunity/ProductionOrder/Invoice, two boards, three coworkers, three workflows, four Today rules.
  - Proves evidence, assumptions, missing integrations, approvals, simulation before apply.
  - Maps each of the 18 §43 criteria to an assertion; existing workspaces unaffected without Architect enabled.
- Depends on: all WA-01…WA-15.
- Acceptance: the 18 criteria, each with named evidence. Local + Playwright.

## 4. Non-goals (spec §40)

No card implements unrestricted code generation, unapproved production
migrations, arbitrary React generation, unreviewed plugin installs, permission
escalation, automatic OAuth, full-Drive ingestion, perfect process mining, core
primitive replacement, automatic template publication, schema deletion, or mass
migration of ambiguous records. WA-14 publication remains a human-gated draft
path only.

## 5. Promotion checklist for the founder

1. Review this doc.
2. `npm run seed:features -- --plan /tmp/workspace-architect-plan.json --cards <keys>` per card group, inspect diff, then `--apply`.
3. Wire UUID dependencies per §2 ordering with `--link-dependencies`.
4. WA-01 implementation (in progress, this branch) satisfies its AC1–AC3 locally.
5. WA-02 implementation (this branch) satisfies its AC1–AC3 locally via
   `collectBlueprintLiveContext` + `validateBlueprintAgainstLive`
   (`npm run test:workspace-blueprint`, group 10).
