# Extending Revenue OS

Three things can be added without forking core: a **module**, an **integration
adapter**, and an **AI tool**. Each one inherits the same governance the rest of
the system runs under, by construction rather than by remembering to.

What every extension inherits automatically:

- **The approval queue.** An AI tool that mutates anything can only stage a
  proposal into `action_queue`. The registry throws at runtime if a tool
  declared as a write does not stage one, and if a tool declared as a read
  does. There is no path around it.
- **The audit ledger.** Writes that go through the canonical services in
  `src/lib/revenue-os/` land in `audit_log` with actor, origin, and
  before/after state.
- **Module gating.** When a workspace disables a module, its navigation
  disappears, its pages show a disabled notice (display gating; the real
  refusal is at the API layer), and its AI tools report as unavailable to
  both the in-app agent and external MCP clients. An API route only refuses
  the request if its module is listed in `MODULE_API_DIRECTORIES`
  (`scripts/verify-module-route-guards.mjs`) — add a manifest-registered
  module's API routes there to get the same enforcement a core module gets.
- **MCP exposure.** MCP derives its tool list from the same registry the UI
  uses. A tool you register is offered to Claude Desktop, Claude Code, ChatGPT,
  Cursor, and Antigravity with the same impact tier and the same gates.

---

## 1. Add a module

A module is the unit a workspace turns on and off. Registering one takes a JSON
manifest and the pages it names. You do not edit any core array.

Create `extensions/<your-module>.module.json`:

```json
{
  "$schema": "./module-manifest.schema.json",
  "id": "acme-inventory",
  "name": "Inventory",
  "description": "Stock levels, reorder points, and supplier lead times.",
  "category": "delivery",
  "defaultEnabled": true,
  "navLinks": [
    {
      "id": "acme-inventory",
      "label": "Inventory",
      "href": "/admin/acme-inventory",
      "icon": "Library",
      "description": "Stock levels and reorder points",
      "moreGroup": "Delivery"
    }
  ],
  "routes": ["/admin/acme-inventory"],
  "aiToolNames": [],
  "setupChecks": []
}
```

Then create `src/app/admin/acme-inventory/page.tsx`, run
`npm run build:extensions`, and commit both the manifest and the regenerated
`src/lib/revenue-os/extension-modules.generated.ts`.

### Field reference

| Field            | Required | Notes                                                                                                                 |
| ---------------- | -------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`             | yes      | Kebab-case, 3 to 49 characters. Must not collide with a core module id; the build rejects it if it does.              |
| `name`           | yes      | Shown in navigation groupings and the modules console.                                                                |
| `description`    | yes      | Shown in the modules console. Say what the module does, not what it is called.                                        |
| `category`       | yes      | One of `revenue`, `delivery`, `intelligence`, `sources`, `system`.                                                    |
| `defaultEnabled` | yes      | Whether a workspace gets it without opting in.                                                                        |
| `navLinks`       | yes      | Up to eight entries. `icon` is a name from the allowlist in `scripts/build-extension-modules.mjs`, never a component. |
| `routes`         | no       | Admin route prefixes the module owns. Each must have a real `page.tsx`; CI checks this.                               |
| `aiToolNames`    | no       | Tool names registered in `ai-tools.ts`. Each must exist and belong to exactly one module.                             |
| `setupChecks`    | no       | Setup Center check ids the module depends on.                                                                         |
| `docsUrl`        | no       | Where an operator reads more.                                                                                         |
| `settings`       | no       | Up to 12 configurable values, rendered by the shared settings form. See below.                                        |

### Settings, without shipping UI

A module can declare values a workspace admin configures, and the shared
`ModuleSettingsForm` component renders them, so a registered module gets a
real settings screen without shipping React:

```json
"settings": [
  {
    "key": "reorderThreshold",
    "label": "Reorder threshold",
    "description": "Flag an item as low stock once its quantity falls to or below this number.",
    "type": "number",
    "default": 10,
    "min": 0,
    "max": 10000
  },
  {
    "key": "defaultWarehouse",
    "label": "Default warehouse",
    "type": "enum",
    "options": ["main", "overflow"],
    "default": "main"
  }
]
```

`type` is one of `string`, `number`, `boolean`, `enum` (requires `options`), or
`url`. There is deliberately no secret type: values are stored in
`tenants.config.moduleSettings`, which reaches client components through the
admin layout, so a settings field is public by construction. A key or label
that looks like a secret (`apiKey`, `webhookSecret`, and similar) is rejected
at build time for an extension manifest, and at CI time for a core module too
(`scripts/verify-module-settings.ts`). Credentials go through an integration
adapter's encrypted credential path instead, never here.

### What a manifest deliberately cannot do

A manifest is data. Nothing in `extensions/` is executed. That is the invariant
that lets an operator read exactly what a module can reach before enabling it,
and it is why a manifest cannot ship an icon component, arbitrary code, or a
schema change. Schema changes are ordered migrations in `migrations/`, reviewed
like any other. Core modules are compile-time and cannot be overridden.

---

## 2. Add an integration adapter

An adapter is how a provider's credentials get verified and how its inbound
data becomes canonical records. The contract is in
`src/lib/revenue-os/integration-adapters.ts`:

```ts
export interface IntegrationAdapter<TCreds = Record<string, unknown>> {
  id: string;
  name: string;
  category: "crm" | "messaging" | "notifications" | "delivery";
  credentialFields: ReadonlyArray<{ formField: string; encryptedKey: string }>;
  verify(credentials: TCreds): Promise<IntegrationVerificationResult>;
  connect(credentials: TCreds): Promise<IntegrationConnectionReceipt>;
}
```

`verify` makes a real call against the provider and reports whether the
credentials work. `connect` returns the receipt that gets stored.
`credentialFields` maps each field a workspace admin submits to the key it is
stored under in `integration_connections.encrypted_credentials`. Register the
adapter in `INTEGRATION_ADAPTERS` in the same file, and that is the whole
registration: `configureAdapterProvider()` in
`src/app/api/admin/tenant/providers/route.ts` looks the adapter up by id,
calls `verify`, encrypts each declared field, and audits the write, the same
generic cycle WhatsApp and HubSpot both go through. Nothing in that route
needs to change per adapter. OpenRouter and MCP stay outside this generic
path on purpose (tenant-scoped AAD encryption and a server-issued key,
respectively); most new adapters will not need that exception.

Two rules that are not negotiable:

- **Credentials are encrypted at rest.** Write them through `encryptSecret`
  and read them through `resolveTenantProviderSecrets`. Never store or read a
  plaintext credential.
- **Writes are tenant-bound.** Inside a webhook or any system-context path,
  build the database client with `createServiceRoleClient(provider.context)`,
  never `createPlatformServiceRoleClient`. The unbound client writes rows with
  no `tenant_id` and reads across every workspace.

Inbound webhook handlers live under
`src/app/api/public/[tenantSlug]/webhooks/<provider>/`, verify the provider's
signature with `timingSafeEqual`, and reject replays outside a bounded window.

---

## 3. Add an AI tool

Tools are registered in `src/lib/revenue-os/ai-tools.ts`. Every tool declares
its input and output schema, the service boundary it is permitted to call, and
its impact tier:

```ts
{
  name: "propose_reorder",
  description: "Stage a stock reorder for founder approval.",
  inputSchema: { /* ... */ },
  outputSchema: { /* ... */ },
  serviceTarget: "src/lib/revenue-os/inventory.ts",
  connectionRequirement: "none",
  impact: "internal_write",
  confirmationRequired: true,
  execute: async (context, input) => { /* stage a proposal, return it */ },
}
```

The rules the registry enforces at runtime, not by convention:

- A tool with `impact: "read"` that stages a proposal throws. A tool with
  `internal_write`, `external_action`, or `destructive` that does **not** stage
  one also throws. Mutating tools propose; they never act.
- `destructive` fails closed at dispatch. There is no reviewed recovery policy
  for it yet, so it is unavailable by design.
- Input and output are both validated against the declared schema. Validation
  messages are written for the model to read and retry, not for a log.

Then claim the tool in a module's `aiToolNames`. `npm run verify:module-contract`
fails if a registered tool belongs to no module, because an unclaimed tool would
escape module gating entirely.

---

## Verify your work

```bash
npm run build:extensions        # regenerate from manifests
npm run verify:extensions       # generated file is in sync
npm run verify:module-contract  # nav ids, routes, and tool names all resolve
npm run verify:agent-contract
npm run typecheck
npm run lint -- --max-warnings=0
npm run test:core
npm run build
```

`extensions/example-inventory.module.json` and
`src/app/admin/example-inventory/page.tsx` are a complete working example of a
module registered entirely from a manifest. It ships disabled, so it stays out
of a real workspace until someone turns it on.

## Command-agent tool discovery

Declare every registered tool in exactly one module's `aiToolNames`. The command
agent derives bundles from those declarations; plugin authors do not maintain
another discovery map. `discover_tool_bundles` searches module metadata and tool
names, and `activate_tool_bundle` loads one bundle alongside eight common tools.
Large modules are split automatically, keeping each model turn at 40 tools or fewer.
Run `npm run test:ai-tool-discovery` to verify ownership, reachability and bounds.

Activation applies to the current command run and takes effect on its next turn.
It grants no permission or approval. The host checks the advertised tool set and
refreshes active tenant/module state before dispatch. Existing explicit MCP tool
pack restrictions remain in force. Cross-run activation restoration is not yet
implemented; the next run can discover the same tools again. Business changes
still require their existing typed proposal, human approval and canonical executor.

## Capability data boundary

`capability-data-api.ts` is a host-only adapter, not a tool whose grant fields an agent may fill in. The host must resolve the authenticated tenant database and approved capability declaration. All four data operations refuse unbound clients or a different tenant in the grant. No grant, tenant ID, table, or readable-field declaration may be taken from plugin arguments.

Register readable scalar fields through `registerEntityType({ ..., readableColumns: ["title", "status"] })`. Omission preserves an existing declaration; an explicit empty array removes extra readable fields. The registry and data boundary validate identifiers; wildcard, relationship and alias expressions are refused. The returned row projection is also restricted to those fields. Core writes still use the action executor.

Recipes do not expand authority. `entity_count` requires an enabled entity grant. `link_degree` requires both `params.type` and `params.id`; both endpoints of every graph result must be enabled granted types. `recent_links` applies the same endpoint filters and reports truncation. Counts are bounded, not unlimited totals. Usage counts fetched data rows including lookahead and duplicate endpoint reads; it excludes registry authorization reads.

Namespace values are bounded plain JSON, at most 8 KiB in UTF-8, with structural depth and node limits. Secret rows cannot be read or overwritten. Concurrent writes refuse rather than clobbering a changed value; reread before retrying. Namespace state has no authority over core records or grants.

The per-process call guard is bounded and expires inactive buckets, but it is not distributed budget enforcement. Persisted metering and approved host invocation remain separate platform acceptance. Tests cover grants, cross-tenant refusal, disabled types, graph visibility, projection injection, malformed input, UTF-8 limits, secret storage, concurrency, and usage receipts.

### Runnable bundled report plugins

`/admin/plugins` is the shared workbench, linked from Integrations. Four optional
plugins ship disabled: Pipeline follow-up, Overdue commitments, Meeting preparation,
and Business pulse. The latter combines three sources without another host or UI.
The inventory manifest remains a declarative scaffold, not an inventory product.

For a workspace you administer, first inspect the source-registration plan:

```sh
npm run plugins:setup -- <tenant-uuid>
# Check the printed project hostname and workspace, then apply to that environment:
npm run plugins:setup -- <tenant-uuid> --apply
```

This registers three read policies over existing `opportunities`, `tasks`, and
`calendar_events` tables; it never creates schema, sends messages, or overwrites
an existing host policy. The normal tenant/entity-registry migrations must already
be installed. There is no production setup hidden in a page request. Turn each
plugin on in Plugins or Integrations, then run it in Plugins or ask the command
agent to run its report. Disabling a plugin blocks the shared host even when an
AI session retained an older enabled configuration. Configuration writes compare
the previous JSON snapshot and retry contention rather than overwrite other changes.

To add another report:

1. Add `extensions/<id>.module.json` with `report.version: 1`, one to three named
   sources, their registered entity types, and exact columns (including `id`).
   Declare the generated AI tool `run_<id_with_underscores>`.
2. Put the synchronous report expression in `plugins/<id>/report.js`. This file
   runs only in QuickJS, including for first-party plugins. `readSource(name)`
   returns that declared snapshot; `reportContext()` returns the fixed run time.
   No database, provider key, filesystem, networking, or mutation binding exists.
3. Return `{ summary, totalFindings, items }`. Each item has `source`, `id`,
   `title`, `detail`, and `severity` (`attention` or `info`). References must match
   fetched records. Return at most 20 items, with the full observed finding count.
4. Run `npm run build:extensions` and `npm run test:report-plugins`, then the normal
   repository checks. The generator pins source hashes in a server-only artifact;
   drift fails CI. Module discovery supplies the shared UI and AI registrations.

The host intersects declared fields with the entity registry's enabled read policy.
It inspects at most 100 rows per source in stable ID order, bounds the total snapshot
to 64 KiB, and runs for at most 250 ms with an 8 MiB isolate heap. A report is an
explicit bounded snapshot, **not a complete monitoring sweep**. Findings beyond 20
and sources beyond 100 produce a partial-view notice. Date-only commitments use
UTC dates; meeting preparation covers stored events in the next 48 hours. It does
not claim to have synced a calendar or researched attendees. Failed reads cannot
become an empty successful report. Start and verified completion receipts reuse
`agent_runs`; they record source hash and counts without raw customer findings.

The full fictional admin demo explicitly excludes server plugin execution because
its browser-only data must never authorize a live host. Browser QA uses fictional
API fixtures for interaction evidence; `test:report-plugins` runs the actual isolate
and host over controlled stored fixtures, including tenant and disabled-plugin
refusals, forged references, timeout, concurrent configuration, and failed receipts.

This lane does not implement arbitrary uploads, remote installation, asynchronous
isolate bindings, persistent event subscriptions, distributed metering, or the
separate third-party plugin review lifecycle. Those retain their Feature Board
acceptance rather than inheriting a claim of completion from bundled examples.

### Isolate transport and resource contract

The report and workflow hosts use the same `plugin-isolate.ts` boundary. Plugin
JavaScript executes in a fresh QuickJS context, with only the synchronous bindings
selected by the trusted host from its declared sources. Those bindings receive JSON
values, never a database client, environment object or provider credential. Core
host callbacks must remain bounded: a guest interrupt cannot preempt synchronous
JavaScript running in the Node host.

Only plain JSON crosses the boundary. Nested functions, `undefined`, non-finite
numbers, bigint, symbols, accessors, sparse/extended arrays, cycles, custom objects
such as dates/maps, and asynchronous results are refused. Convert dates explicitly
to strings before returning them. Shared references are allowed as repeated JSON
values. A private codec captures pristine intrinsics before plugin execution, so
replacing guest `JSON` or `Object` methods cannot change transport validation.
Property accessors are not evaluated during transport; proxy traps execute only
inside the interruptible guest context.

Each transported value is limited to 256 KiB of UTF-8 JSON, 10,000 visited values
and 64 nested levels. The existing 64 KiB source-snapshot and business input/output
limits remain tighter where applicable. Code is limited to 256 KiB; an evaluation
allows at most 10,000 host calls and 32 arguments per call. Resource options must
be finite integers: timeout 1 through 30,000 ms and heap 256 KiB through 64 MiB.
The normal business hosts retain their 250 ms / 8 MiB budgets. Serialization runs
inside the same guest deadline and the runtime is disposed after success or failure.

The pinned QuickJS version has an [upstream aggregate-allocation accounting
issue](https://github.com/justjake/quickjs-emscripten/issues/255). The host therefore
checks actual aggregate usage at interrupts, before host calls and before returning
a result. A breach terminates the evaluation. A separate fixed WebAssembly memory
ceiling bounds allocation between those checks: at least 16 MiB (the prebuilt
engine's minimum), or the configured heap budget plus 2 MiB, rounded to a 64 KiB
page. The receipt records that hard ceiling. The 8 MiB budget is a sampled guest
quota, not a promise that peak host-process memory stays below 8 MiB. At most four
bounded engine variants are cached; tenant contexts and values are never reused.

`npm run test:plugin-isolate`, required by `test:core` in CI, measures the **first
evaluation including WASM initialization** against the 50 ms acceptance budget.
It reports that measurement separately from fresh-context timing with the WASM
module already cached. Neither measurement includes Node startup, module loading,
or business data reads. Adversarial tests cover transport, authority probes,
allocation refusal, invalid resource options, timeouts and subsequent host recovery.
`PluginIsolateError.receipt.timedOut` comes from the host deadline. `memoryLimited` is true only when the host observes aggregate usage exceeding the
budget. Other failures use `null`: QuickJS does not expose a trustworthy
allocation-failure flag, and plugin-supplied error text must not become an
authoritative diagnosis.

### Actionable business workflow exemplars

The primary examples are now **Stripe invoicing**, **Client onboarding**, and
**Meeting commitments**. All are optional and disabled by default. The four
reports above remain read-only runtime examples. Explicitly enabling a bundled
plugin installs its missing, trusted entity read-policy rows through the existing
registry; it never runs SQL or overwrites an operator policy. Unknown third-party
sources still require host registration. Apply the normal tenant schema and
`20260904-plugin-workflow-foundations.sql` in a controlled environment first.

Each workflow has a pure-data module manifest and `plugins/<id>/workflow.js`.
`workflow.inputSchema` is a closed, bounded JSON Schema subset: no regexes, remote
references, recursive schemas, custom formats or async validators. The build
validates it with AJV and compiles code plus its SHA-256 into the server-only
workflow registry. At execution, the code runs in QuickJS (250 ms, 8 MiB), receives
only validated input and declared record snapshots, and returns a proposed action.
It receives no database, credentials, network access or provider client.

The shared host revalidates business identity, current capabilities, assignments
and provider facts. It produces a preview digest, then stages the same digest and
request identity in `action_queue`. Generated `prepare_<plugin>` and
`propose_<plugin>` AI tools use those same services. Current activation and code
hash are checked again at execution. New action types require a reviewed host
service and executor registration; a manifest cannot grant itself a new effect.

- **Stripe invoicing:** select a canonical CRM customer, enter exact line items,
  preview, and approve draft creation. Sending is a separate approved operation.
  The adapter pins Stripe API version `2025-06-30.basil`, uses fixed endpoints,
  bounds response bytes/time, and never exposes the tenant-encrypted key to plugin
  code. CRM search is bounded to 100 matches; Stripe choices use the selected
  contact's billing email. Ambiguity requires explicit customer selection.
- **Client onboarding:** start from a won opportunity and review a delivery
  checklist with dates and active workspace assignees. The shared task service
  writes actual assigned tasks linked to that opportunity.
- **Meeting commitments:** select a stored meeting and enter reviewed commitments,
  dates and assignees. Approval creates linked tasks. The workspace shows live
  task completion separately from immutable creation receipts; completion reuses
  the existing task service. This exemplar does not claim automatic transcript
  extraction or customer email sending.

Stripe drafts use deterministic tenant/action keys for invoice creation, line
population, finalization and sending. Partial results retain the invoice ID.
Retry reuses the same action and checkpoint; operations expire after 20 hours to
stay inside Stripe's documented minimum 24-hour idempotency retention. Expired or
changed-account operations require reconciliation, not automatic recreation.
Task effects and workflow request identities remain unique across terminal states.
Turning a plugin off prevents new plans and queued execution without deleting
business history. Provider mutation steps recheck connection and activation.

The invoice workbench distinguishes recorded receipts from a fresh **Check payment
status** read. Test-mode sending does not deliver email. Live sending records
provider acceptance, not proof of inbox delivery. This implementation supports
five two-decimal currencies and up to ten lines. It does not calculate taxes or
discounts, charge saved payment methods, manage subscriptions/refunds, or implement
webhook reconciliation. Account tax settings that change the reviewed total cause
execution to refuse. Existing draft revisions can be made in Stripe, but changed
billing facts require fresh review; the original approval is never rewritten.

#### Branding and AI-assisted customer invoice pages

`/admin/branding` edits the tenant's shared `config.brand`: business identity,
public HTTPS logo URL (replace/remove with initials fallback), accent, document
text and background colors, typography, billing address, support email and site.
It uses a live invoice preview, contrast validation, a brand revision and whole
configuration compare-and-swap. Concurrent module changes survive; stale brand
edits refuse. Logo binaries are hosted by the operator; this version manages their
URL and does not provide a file-storage upload service.

Invoice page designs use two renderer layouts and bounded plain-text fields.
Operators can write them directly or ask the configured workspace AI gateway to
draft them. AI generation opens and verifies a durable run trace with model usage;
it never supplies authoritative amounts, customer identity or payment status.
UI and AI share the page preview and publication proposal services.

Publishing requires a finalized invoice and a human-approved design/brand/billing
digest. Published pages retain a brand snapshot and cannot be edited in SQL;
corrections create a new reviewed version. Public access uses a 256-bit random
bearer token, hashed for lookup and encrypted with tenant/field-bound AAD for owner
retrieval. Tokens expire after 90 days and can be revoked. Public rendering checks
current tenant/plugin state, revocation, provider ownership and billing digest;
reads live Stripe payment status; and sets no-index/no-referrer metadata. Only
Stripe-hosted HTTPS payment URLs are linked. Publishing creates a link; it does
not email it. Payment state can change without revising the presentation; changed
line items or billing identity require a new review.

#### Verification and local browser fixtures

Run `npm run test:stripe-workflow`, `npm run test:business-workflows`, and
`npm run test:plugin-workflow-postgres`, plus the normal core, lint, typecheck and
build gates. The PostgreSQL test creates and removes its own database, applies
the migration twice, and verifies cross-tenant foreign keys, terminal replay
constraints, RLS, immutable publication and permanent revocation.

Browser QA uses `qa-business-fixture-server.mjs` on port 3044 and Next on 3023
configured with its local Supabase URL, fixture keys and `ADMIN_EMAIL=qa@example.example`.
For the public page, preload `qa-business-fetch-fixture.mjs` through `NODE_OPTIONS`
and set `GOOGLE_TOKEN_ENCRYPTION_KEY=controlled-browser-encryption`. The preload
refuses external fetches and serves only the declared Stripe read fixture. Run
`node scripts/qa-business-workflows.mjs` for desktop/mobile journeys. Never load
these test adapters in a production process.

These fixture tests are complemented by the opt-in real-provider check:

```sh
STRIPE_SANDBOX_ACCOUNT=acct_your_test_account npm run test:stripe-sandbox
```

Authenticate the Stripe CLI first, or supply `STRIPE_TEST_API_KEY` through your
local secret manager. Never paste keys into source or command history. The check
requires the exact expected account ID and refuses live keys. It runs real
QuickJS and the shared domain/approval executor with isolated in-memory application
records and real Stripe transport; it never connects to the application database.
It creates a fictional customer and a USD 5.00 test invoice, deliberately loses a
successful line-write response, verifies an idempotent retry leaves one invoice
and one line, checks disabled/duplicate approvals, finalizes and requests a
test-mode send, and verifies branded publication/revocation using actual Stripe
facts. It voids its open test invoice and retains provider audit history; a failed
draft is reported for inspection. A successful run writes provider request IDs to
`accelerate-stripe-sandbox-evidence.json` in the OS temporary directory.

Real Stripe verification passed on 2026-09-05. This proves provider integration,
not deployed application database behavior or a completed payment. Database and
browser checks above remain separate required coverage; production activation
and payment-method acceptance remain release-specific verification.
Stripe's authoritative semantics: [invoice creation](https://docs.stripe.com/api/invoices/create),
[sending](https://docs.stripe.com/api/invoices/send), and
[idempotent requests](https://docs.stripe.com/api/idempotent_requests).

### Business workflows in the full admin demos

All five `/demo/command-center/<scenario>` workspaces render the actual admin
invoicing, branding, plugins, onboarding and meeting-commitment pages. There is no
second demo UI. `business-profiles.ts` contributes fictional service descriptions,
minor-unit prices and task suggestions to each scenario pack. `business-runtime.ts`
is part of the existing browser demo transport; it reuses the shared invoice,
branding, presentation and task input contracts and simulates their operations.

The scenario starts with open, paid and draft invoices, assigned delivery tasks,
its business mark and its shared brand. Review, approval, simulated send, AI
presentation, publication/revocation, task completion and module changes write
only to the scenario's versioned session state and local receipts. Tasks and pending
approvals enter the existing Today/task/approval views; receipts appear in Activity.
The sample-logo control uses the existing scenario mark without remote downloads.
Demo customer links reopen the shared invoicing page in a customer-preview state
and work only inside the same scenario's browser session; they are not public links.
The real public invoice route and real provider connections remain unchanged.

Use `npm run test:demo-business-workflows` for all five normalized scenario graphs,
input refusals, disabled execution, replay, branding conflicts and publication
revocation. Run `npm run qa:demo-business-workflows` against a local app (override
`PLAYWRIGHT_BASE_URL` when needed) for the actual shared UI, desktop/mobile
journeys, scenario persistence/reset and appearances. The browser harness refuses
and reports any protected API or external request that escapes the demo transport.

## Collections: a complete native workspace reference

`extensions/receivables-collections.module.json` declares a default-off business
workspace. The Plugins page lists manifest extensions with workspaces as well
as isolated workflows/reports, and uses the same module toggle service. It does
not claim that native server modules can be downloaded and installed as isolated
third-party code; the generalized plugin SDK and installer remain backlog work.

Enable Stripe invoicing and Collections, configure the workspace's Stripe and
Resend connections, then open `/admin/collections`. Track an executed platform
invoice to load verified balances. Assign an owner, record a promise/dispute/pause,
preview a branded reminder, queue it and approve through the shared action queue.
The host rechecks current facts before sending. Test invoices are visibly labeled
in the reminder subject/content. Receipt-only reconciliation never sends again.

The same `CollectionsWorkspace` component runs in all five full admin demos.
`collections-runtime.ts` is an adapter within the shared fictional demo engine,
not a copied page or a provider connection. Case policy validation, summary
calculations and the email renderer are shared with the live host. Source invoices,
actions, receipts and case WorkItems remain linked in the same scenario state.

Read `plugins/receivables-collections/README.md` for operational limits and
`scripts/test-receivables-workspace-demo.ts` / `scripts/qa-collections-workspace.mjs`
for repeatable host, demo and browser verification. The authenticated host bridge
in `src/lib/supabase/server.ts` permits only four named Collections RPCs after
matching the request actor/database and rechecking active membership. It returns
a receipt, never a service-role database handle; actor reads remain RLS-scoped.

### Collections agent entrypoint reference

`collection-agent-contract.ts` owns browser-safe tool descriptors/input schemas;
`collection-agent.ts` projects bounded results from the existing Collections
workspace and reminder services. `ai-tools.ts` registers those services once for
internal AI and `mcp-server.ts` dispatches the same tools. The module manifest owns
the three tool names. Internal model requests, MCP discovery and the capability
surface use workspace configuration, while the domain services recheck current
activation and tenant identity.

Use `get_collection_cases` → `preview_collection_reminder` →
`propose_collection_reminder` as a contributor reference for read/proposal
separation. A returned proposal remains pending for human approval. The
[Collections guide](../../plugins/receivables-collections/README.md#ai-and-mcp-workflow)
documents inputs, exact digest handling, result bounds and remaining limitations.
`test:collections-agent-tools` exercises the real registry and MCP adapter against
the same controlled provider fixture as the underlying reminder service tests.

## Every admin control has a conversational equivalent

Follow the [universal AI/admin parity contract](../contracts/ADMIN-AI-PARITY.md).
Plugins and native features expose the same narrowly typed operations to the
admin, AI and authorized MCP clients. Writes use exact proposals and human
approval through the shared executor. Document missing coverage on the live board
and refresh the route inventory after semantic review; a passing inventory check
is not evidence that an operation has AI support.

## Shared workflow input contracts

Bundled workflows select a trusted host validator with `workflow.inputContract`:
`task-batch-opportunity-v1`, `task-batch-meeting-v1`, or `stripe-invoice-draft-v1`.
These contracts live in `src/lib/revenue-os/plugin-workflow-contract.ts` and reuse
`workflow-task-contract.ts` and `stripe-contract.ts`, the validators used by the
business services. A plugin cannot name an arbitrary import or action implementation.

Run `npm run build:extensions` after changing the contract. It regenerates the
workflow's `inputSchema`, `actions`, `policy`, `tools`, and `contractHash` in `extensions/*.module.json`, then the
compiled module registry. Those fields are generated output; do not maintain
a parallel schema there. `npm run verify:extensions` rejects changes to either
side that have not been regenerated. `npm run test:plugin-workflow-contract`
exercises both directions of drift in a disposable fixture.

The advertised JSON schema is a bounded discovery projection. UUID/date patterns
and cross-field refinements are enforced by the original Zod validator before
plugin evaluation, and again by the business service. Normalized input is passed
to the isolate. This keeps AI tool descriptions bounded without weakening runtime
validation. Generation imports only trusted host contracts; plugin JavaScript is
read and hashed as data and executes only in QuickJS.

Each supported workflow also registers a canonical identity source and explicit
request/effect idempotency policies in `plugin-workflow-contract.ts`.
`plugin-workflow-policy.ts` validates that registration against the implemented
action: opportunity/meeting task batches require their matching source; invoice
drafts require a contact source. Missing evidence, missing retry policies and
contradictory registrations fail generation. The host verifies the source before
running plugin code and prevents the returned plan from changing that identity.
Domain services still resolve live, tenant-bound records and provider identities.

The authoritative action classification in `action-reversibility-contract.ts`
determines the generated workflow tier (2 for these internal task writes, 3 for
external invoice drafts), impact and reversibility. An irreversible action's
requested autonomous ceiling is rewritten to `always-propose` with a warning.
All three bundled workflows require approval. This does not enable autonomous
third-party plugins. The existing request, task-effect and Stripe-effect key
formats are preserved; their shared builders are used by the actual services.

Generated `contractHash` fingerprints the trusted validator/policy source files,
the workflow declaration and its sources. Proposals record that hash alongside
the plugin JavaScript hash. Approved execution checks both against the current
registration, rechecks enablement and enforces the approval ceiling. A host
contract change therefore invalidates pending proposals, even when plugin code
is unchanged. This deliberately includes source changes that may be semantically
harmless. After upgrading from proposals without this hash, prepare and approve
a fresh workflow; legacy proposals fail closed. Completed receipts and effect
retry keys remain intact.

This covers the three isolated workflow registrations. Native adapter operations,
event registration, general entity read/write grants, and complete registration
parity remain tracked by `plugin-manifest-generator`. It is not a complete
third-party registration or installation SDK.

## Registered business tools

`src/lib/revenue-os/plugin-tool-contract.ts` is the trusted registration for the
six prepare/propose workflow tools and three bundled Stripe adapters. It owns
their operation keys, names, full Zod input validators, discovery schemas,
service targets, impact and confirmation metadata. `build:extensions` derives
`workflow.tools` and the module's `aiToolNames` from this registration. Both are
generated grants; editing either without regeneration fails `verify:extensions`.

The AI registry constructs these same nine tools from that registration. Each
operation maps to one typed, reviewed adapter in `ai-tools.ts`, which calls the
existing workflow, invoicing or invoice-page service. New operations require a
reviewed host adapter; a manifest cannot name an arbitrary function or import.
Tool grants are checked against the registration at startup and before dispatch.
Disabled modules remain unavailable through the normal module/tool-pack gates.

These tools use the registered Zod parser at dispatch, including nested fields,
UUIDs, digest syntax, unknown-field rejection and normalization. The domain
service remains authoritative for live identity, freshness, amounts, approval
and effects. For example, a valid empty invoice memo works through AI just as it
does through the invoice service; malformed invoice designs fail before any
business service call. The registry contract is now `revenue-os-tools.v10`.

Run `npm run test:plugin-workflow-contract`, `npm run test:ai-tool-gates`, and
`npm run verify:module-contract` for generation drift, exact runtime/manifest
parity, invalid-input refusal and pack/enablement coverage. The business-workflow
and Stripe fixture suites exercise all nine registered adapters through AI
dispatch and then through the existing approval executor. They verify assigned
tasks, invoice draft/retry/send and branded page publication with controlled
provider transport. They do not send to real customers.

This registration covers tools for the three bundled workflows, including their
existing native Stripe adapters. Native effect policies, general entity
read/write grants, durable events and the installation SDK remain separate work.

## Cold-start verification

The Node host lazily loads QuickJS's public CommonJS Emscripten entrypoint.
It uses the same pinned release engine and fixed WASM memory ceiling as before;
loading, compiling and initializing the engine all remain inside the first
`evaluateInIsolate` call. Next externalizes this native package and traces the
WASM asset. CI reconstructs the engine from each representative route's deployment
trace and executes it without falling back to workspace package files.

`npm run test:plugin-cold-start` records five independently cold Node processes,
including module import time, full process wall time, the first evaluation and
five subsequent fresh-context evaluations. It retains every sample and requires
the slowest first evaluation to remain below the existing 50 ms budget. There is
no retry or warmup. CI alternates candidate and baseline processes, records CPU,
OS, architecture and Node version, and retains the JSON even when the gate fails.
The baseline source is the pinned pre-optimization commit `318b11d`.

The evaluator metric includes WASM initialization, runtime/context creation,
transport initialization, guest execution and disposal. Process startup and
module import costs are reported separately. OS filesystem cache and shared
runner scheduling are uncontrolled, so this is a measured regression budget,
not a universal latency guarantee. The original 50.375514 ms failure remains
linked from the `plugin-isolate-cold-start-headroom` work card.
