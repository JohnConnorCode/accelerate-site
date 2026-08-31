import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("migrations/20260831-tenant-lifecycle-rpcs.sql", "utf8");
const service = readFileSync("src/lib/tenancy/lifecycle.ts", "utf8");
const route = readFileSync("src/app/api/admin/tenants/route.ts", "utf8");
const directory = readFileSync("src/app/admin/tenants/page.tsx", "utf8");
const setup = readFileSync("docs/REVENUE-OS-SETUP.md", "utf8");

for (const functionName of [
  "platform_create_tenant",
  "platform_upsert_tenant_membership",
  "platform_set_tenant_status",
  "platform_revoke_tenant_membership",
]) {
  assert.ok(migration.includes(`FUNCTION public.${functionName}`), `lifecycle migration is missing ${functionName}`);
  assert.match(migration, new RegExp(`REVOKE ALL ON FUNCTION public\\.${functionName}[\\s\\S]*FROM PUBLIC, anon, authenticated`), `${functionName} must not be callable by browser roles`);
  assert.match(migration, new RegExp(`GRANT EXECUTE ON FUNCTION public\\.${functionName}[\\s\\S]*TO service_role`), `${functionName} must remain service-role-only`);
  assert.ok(service.includes(`database.rpc("${functionName}"`), `tenant lifecycle service must own ${functionName}`);
}

for (const invariant of [
  "FOR UPDATE",
  "INSERT INTO public.platform_audit_log",
  "The bootstrap tenant cannot be suspended or archived",
  "Archived tenants cannot be reactivated",
  "Invitations are disabled while tenant is",
  "The platform owner membership cannot be revoked",
]) assert.ok(migration.includes(invariant), `atomic lifecycle migration is missing ${invariant}`);

assert.doesNotMatch(migration, /DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i, "tenant lifecycle must never hard-delete tenant data");
assert.ok(service.includes("existing.email_confirmed_at"), "an unconfirmed invited Auth user must never become an active tenant member on retry");
assert.ok(service.includes("page <= 100"), "Auth user reconciliation must use a bounded paginated lookup");
assert.ok(service.includes("warning: \"Workspace created safely"), "partial provisioning must return a truthful retryable warning");
assert.ok(service.includes("class TenantLifecycleError"), "tenant lifecycle failures must expose a stable typed contract");
assert.ok(service.includes("The administrator invitation could not be sent"), "provider failures must return a safe retryable message");
assert.ok(route.includes("createTenantWorkspace"), "tenant route must delegate creation to the lifecycle service");
assert.ok(route.includes("setTenantLifecycleStatus"), "tenant route must delegate transitions to the lifecycle service");
assert.ok(route.includes("error instanceof TenantLifecycleError"), "tenant route must preserve lifecycle HTTP semantics without parsing raw errors");
assert.doesNotMatch(route, /duplicate\|unique|error instanceof Error \? error\.message/, "tenant route must not expose or classify raw infrastructure errors");
assert.doesNotMatch(route, /platform_audit_log|tenant_memberships"\)\.upsert/, "tenant route must not coordinate lifecycle writes itself");
assert.ok(directory.includes("toast.warning(result.warning)"), "the operator must see partial provisioning instead of a false success");
assert.match(setup, /20260831-tenant-lifecycle-rpcs\.sql/, "setup order must include atomic tenant lifecycle RPCs");

console.log(JSON.stringify({ result: "passed", atomicLifecycleFunctions: 4, hardDeletes: 0 }));
