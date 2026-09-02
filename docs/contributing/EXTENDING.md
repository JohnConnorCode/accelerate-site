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
  disappears, its routes fail closed, and its AI tools report as unavailable to
  both the in-app agent and external MCP clients.
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
  verify(credentials: TCreds): Promise<IntegrationVerificationResult>;
  connect(credentials: TCreds): Promise<IntegrationConnectionReceipt>;
}
```

`verify` makes a real call against the provider and reports whether the
credentials work. `connect` returns the receipt that gets stored. Register the
adapter in `INTEGRATION_ADAPTERS` in the same file, and wire `verify` into the
tenant provider flow in `src/app/api/admin/tenant/providers/route.ts` so a
credential is never saved before it has been checked, the way WhatsApp,
HubSpot, and OpenRouter already are.

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
