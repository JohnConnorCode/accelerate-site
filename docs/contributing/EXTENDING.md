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
