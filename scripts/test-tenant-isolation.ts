import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

let adminServiceFiles: string[] = [];
try {
  adminServiceFiles = execFileSync("rg", ["-l", "createServiceRoleClient\\(", "src/app/api/admin"], { encoding: "utf8" })
    .trim().split("\n").filter(Boolean);
} catch {
  // ripgrep exits with status 1 when no matches are found, which is the desired state.
}
assert.deepEqual(adminServiceFiles, [], "interactive admin routes must use the database returned by requireAdmin");

const nonAdminServiceFiles = execFileSync("rg", ["-l", "createServiceRoleClient\\(", "src"], { encoding: "utf8" })
  .trim().split("\n").filter((file) => file && !file.startsWith("src/app/api/admin/") && file !== "src/lib/supabase/server.ts");
for (const file of nonAdminServiceFiles) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /createServiceRoleClient\(\s*\)/, `${file} uses service-role access without TenantSystemContext`);
}
assert.ok(readFileSync("src/lib/tenancy/ingest.ts", "utf8").includes("createServiceRoleClient(context)"), "tenant ingest must pass its resolved TenantSystemContext explicitly");

const server = readFileSync("src/lib/supabase/server.ts", "utf8");
for (const invariant of [
  "Service database access requires an explicit TenantSystemContext",
  "attachTenant(rows, tenantId)",
  'result.eq("tenant_id", tenantId)',
  'headers: { "x-tenant-id": systemContext.tenantId }',
]) assert.ok(server.includes(invariant), `tenant database boundary is missing ${invariant}`);

const auth = readFileSync("src/lib/admin/auth.ts", "utf8");
for (const invariant of [
  "Explicit tenant context required",
  'membership?.status !== "active"',
  'tenantRow.status !== "active"',
  "enterTenantRequestContext(authorization)",
]) assert.ok(auth.includes(invariant), `tenant authorization is missing ${invariant}`);

const middleware = readFileSync("src/middleware.ts", "utf8");
assert.match(middleware, /\/t\\\/\(\[a-z0-9\]/, "middleware must recognize canonical workspace URLs");
assert.ok(middleware.includes('requestHeaders.set("x-tenant-id", tenantId)'), "middleware must forward resolved tenant identity");
assert.ok(middleware.includes('isConfiguredAdmin(user.email)'), "platform routes must remain founder-only");

const login = readFileSync("src/app/api/admin/login/route.ts", "utf8");
assert.ok(login.includes('eq("status", "active")'), "login must require an active membership");

console.log(JSON.stringify({
  result: "passed",
  implicitAdminServiceFiles: adminServiceFiles.length,
  explicitSystemServiceFiles: nonAdminServiceFiles.length,
}));
