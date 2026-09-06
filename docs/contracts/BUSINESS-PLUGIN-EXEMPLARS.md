# Business plugin exemplar implementation standard

Applies to the ten cards indexed in `docs/planning/BUSINESS-PLUGIN-SELECTION.md`.
The live Feature Board owns their definitions, dependencies and execution state.
This standard supplies common engineering acceptance, not a second roadmap.

## Product and northstar contract

Each plugin must complete a meaningful business loop: see canonical facts,
remember provenance, notice an actionable exception, propose/perform governed
work, and learn only from reviewed decisions. A report without a next action,
execution receipt and recovery path is not an acceptable exemplar. Each card is
Phase E (phase:6) and depends on the shared Phase D plugin/runtime foundations.

Read `docs/NORTHSTAR.md`, `AGENTS.md`, the engineering/tenancy contracts,
`WORKSHELTER-REUSE-CONTRACT.md` and every dependency's evidence before implementation.
The workshelter-reuse-baseline card reconciles completed branches. References to
c7da31b are real committed donor code, not a promise those files exist in the
current checkout. Do not copy a stale branch around that gate. Record the approved
repository base branch and exact merged commit before promoting work to Ready.
Donor code is an adaptation reference; retain Accelerate identity, tenancy,
services, UI tokens, audit and plugin boundaries. Do not create another host.

## Uniform implementation packet

Every card specifies business owner/value, trigger, ordered workflow, canonical
entities, lifecycle, narrow capabilities, idempotency identity, UI surfaces,
exceptions, demo data, non-goals, dependencies and acceptance IDs. Execute in order:

1. Produce a schema/state/permission contract with tenant-composite references,
   indexes, concurrency boundaries, retention and configuration/version rules.
2. Deliver an additive idempotent migration. Verify the environment identity,
   execute it through repository tooling and prove rollback/retry expectations.
   Never issue opportunistic schema changes from requests or delete historical facts.
3. Implement domain services in `src/lib/revenue-os/` and register ownership in
   README. Routes, tools, jobs, triggers, public forms and UI remain adapters.
4. Register versioned manifests, capability schemas, impact levels, config,
   permissions, budgets, actions, triggers and contextual record extensions.
   Use the existing host/isolate and connection broker; no route-local plugin registry.
5. Build operator and recipient flows using shared components and branding. Provide
   provenance, empty/loading/partial/error states, next action and safe recovery.
6. Add coherent scenario fixtures, integration/concurrency tests and inspected
   desktop/mobile screenshots. Attach evidence per acceptance ID and exact commit.

## Runtime and data invariants

Canonical person/account/project/work/document/invoice IDs win over email joins.
Ambiguous identity creates review work. Plugin-specific records extend canonical
entities through tenant-bound references; they do not clone contacts, calendars,
mail transport, invoices, proposal lifecycle, storage, job runners or AI gateways.

Register reads, internal writes and external actions separately. AI may draft
structured proposals from bounded source context; it cannot mint business facts
or bypass confirmation. External actions enter action_queue, re-read live source
version/permission/plugin/suppression state immediately before execution, and
call the same service used by the approved operator flow. Tenant WorkItems carry
work ownership, budgets, leases, retries and terminal receipts. Provider failure,
partial completion, skipped work and missing configuration remain distinct.

Every logical effect has a deterministic tenant-scoped idempotency key and
concurrency proof. Persist provider receipts and immutable source facts separately
from operator notes, estimates, intent and model suggestions. Unknown is not zero.
Money uses currency and integer minor units; time uses explicit units/timezones.
Do not sum currencies or silently revise approved historical rates/terms.

Permissions apply to UI, HTTP, jobs, exports, AI context, MCP and public access.
Public links bind tenant, entity, exact version, recipient/authority, expiry and
revocation. Use existing encrypted/server-only credentials and scoped connections.
Never expose secrets or restricted raw content in logs, tools, demos or audit metadata.

## Installation, disable and upgrade

A plugin begins disabled with meaningful config validation and a permissions
preview. Enabling is explicit. Missing prerequisites create actionable setup
states. Disabling blocks new execution and queued effects at the final execution
boundary; pause/cancel pending work with a receipt. Preserve business records,
provider facts and historical evidence. Re-enable resumes only eligible work after
fresh checks. Upgrade uses versioned schemas/config and tested migrations; no
silent changes to approved terms or action payloads. Uninstall retains/exportably
archives records according to policy and never cascades through shared core entities.

## Demo and visual acceptance

Use the actual admin/public components and a session-local demo transport, with
no native protected/provider calls. All five existing scenarios need coherent
people, companies, projects, amounts, dates, documents and failure states. Each
card's demo packet must include a normal workflow, a blocked/ambiguous case, a
provider failure and a disabled/re-enabled case. Label synthetic evidence as demo.
A zero-key sandbox must exercise the full workflow locally; real-provider proof
requires a controlled sandbox fixture and is recorded separately.

Inspect 1440px desktop and 390px mobile screenshots in light and dark appearances;
verify keyboard focus, reduced motion, long text, slow reads, empty state and safe
retry. Use shared design tokens and primitives, accessible labels and minimum
40px action targets. AI-generated pages use the reviewed document/branding
contract with structured content, deterministic rendering and an accessible
fallback; no arbitrary model-generated HTML/JavaScript execution.

## Verification and handoff

Run agent contract, typecheck, lint, closest service/SQL/API/plugin-conformance
suites, browser journey, production build and diff check. Tests must demonstrate
happy path, invalid input, duplicate/replay, concurrency, stale approval, failed
provider, partial completion, retry, disable during queued work and cross-tenant
isolation. Assert exact effect counts and receipts, not merely HTTP 200.

Every AC ID needs a named check and openable evidence/artifact. Include changed
files, migrations executed/verified, manifest/capability versions, configuration,
demo scenario coverage, API/tool examples and recovery instructions. Submit for
review with an exact implementation commit. Accepted verification, merge,
provider sandbox proof and production deployment are separate facts. Never deploy
or send real customer/vendor/candidate messages merely to finish an exemplar.
