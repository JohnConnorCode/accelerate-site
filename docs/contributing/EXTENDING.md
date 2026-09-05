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
