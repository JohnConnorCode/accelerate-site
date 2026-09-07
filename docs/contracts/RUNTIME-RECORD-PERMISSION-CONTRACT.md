# Runtime record permission contract

One shared evaluator — `src/lib/revenue-os/record-permissions.ts`
(`authorizeRecordAccess`) — decides record and action permissions for UI,
API, AI, MCP, and plugins. Surfaces delegate to it instead of redefining
the rules, so the same fixture decides identically everywhere.

## Authority boundaries

| Principal | How it authenticates | What it may touch |
|---|---|---|
| `platform_admin` | `ADMIN_EMAIL` exact match (`src/lib/admin/access.ts`) | Any record inside one explicit tenant; still module- and grant-bound. Never ambient cross-tenant reads. |
| `workspace_member` | Active `tenant_memberships` row for the tenant | Reads and relates with any active membership. Writes, exports, and actions require the `admin` role. |
| `integration` | Explicit tenant-bound system identity (`TenantSystemContext`, MCP bearer key, cron allowlist) | Tenant-active, module, and grant checks still apply. No membership row exists, so none is consulted. |

Tenant workspaces additionally require an active `tenants` row and explicit
tenant context in middleware and API authorization (`MULTI-TENANCY-CONTRACT.md`).

## Evaluation order (default-deny)

1. **Tenant binding.** The client must carry a tenant scope; unbound clients
   fail closed. Suspended, archived, or unknown workspaces deny with
   `tenant_unknown_or_suspended`.
2. **Membership and role.** Missing, invited-only, or revoked memberships deny
   with `membership_revoked`. Non-admin roles deny writes, exports, and
   actions with `role_insufficient`.
3. **Module.** Unknown or disabled modules deny with `module_disabled`. The
   check is `isModuleEnabled` against the workspace's stored `tenants.config`
   — the same helper admin navigation, `requireAdminForModule`, and AI tool
   availability use.
4. **Entity and field.** Registered custom types inherit the host checks above
   and additionally require an explicit capability grant (`entity_not_granted`
   otherwise). Field reads are limited to the type's `readable_columns`
   (`field_not_readable` otherwise), so a manifest can never widen its own
   authority. Host-canonical tables are governed by the tenant-bound client,
   membership, and module checks; they carry no field ACLs.
5. **Autonomy.** Writes and actions honor a caller-supplied `checkAutonomy`
   verdict; a refused or hard-floor verdict denies with `autonomy_denied`.

Every denial carries a machine-readable code from `RECORD_DENY_CODES` and a
policy reference (`tenantId`, `moduleId`, `entityType`, `grant`,
`autonomyLevel`).

## Default-deny examples

- A guessed record ID in another workspace: the tenant-bound client returns
  no row, and the evaluator denies a forged tenant context with
  `tenant_unknown_or_suspended`.
- A revoked member replays an old approval link: `membership_revoked`.
- A plugin update ships a new column without a grant: `entity_not_granted`
  for the type, `field_not_readable` for the column.
- A standing permission is withdrawn after approval but before execution:
  the executor re-resolves autonomy post-claim and writes a terminal
  `denied` receipt (`denyAction`) plus an `action.denied` audit entry —
  never a generic failure, never a silent retry.
- An MCP client reads a resource whose module is disabled: the resource is
  hidden from `resources/list` and refused on `resources/read` with the deny
  code and policy reference.

## Machine-readable reference

`docs/generated/record-permission-reference.json` is generated from the
executable registrations by
`scripts/generate-record-permission-reference.ts`. It lists deny codes,
autonomy levels, hard floors, modules, tool-to-module grants, and the MCP
resource-to-module map. The contract test fails on drift: change the
registrations, regenerate, commit both.

## Non-goals

- The evaluator does not authenticate callers; entrypoints resolve identity
  first (`requireAdmin`, `resolveMcpAuth`, `TenantSystemContext`).
- It does not replace row-level tenant scoping; the bound client owns that.
- MCP `tools/call` keeps its registry/propose-structure gates, and autonomy
  hard floors execute in `action-executor.ts`; the evaluator is the shared
  decision record, not a second enforcement stack.
