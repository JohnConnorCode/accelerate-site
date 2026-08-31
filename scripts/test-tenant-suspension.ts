import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("migrations/20260831-tenant-suspension-guards.sql", "utf8");
const system = readFileSync("src/lib/tenancy/system.ts", "utf8");
const resend = readFileSync("src/lib/email/resend.ts", "utf8");
const google = readFileSync("src/lib/revenue-os/google.ts", "utf8");

assert.match(migration, /SELECT status INTO tenant_status[\s\S]*tenant_status IS DISTINCT FROM 'active'/, "operational RPC authorization must recheck active tenant state");
assert.match(migration, /RAISE EXCEPTION 'tenant execution is unavailable' USING ERRCODE = '42501'/, "inactive tenant execution must fail as authorization, not as missing data");
assert.match(migration, /auth\.role\(\) = 'service_role' OR private\.has_active_tenant_membership/, "active service and member callers must retain the existing authorization paths");
assert.doesNotMatch(migration, /DELETE\s+FROM|TRUNCATE|DROP\s+TABLE/i, "suspension guards must preserve tenant data and receipts");
assert.match(system, /export async function assertActiveTenantExecution/, "provider effects need a reusable just-in-time lifecycle assertion");
assert.match(system, /tenantScopeForDatabase\(database\)/, "the lifecycle assertion must derive canonical tenant identity from the bound database");
assert.match(resend, /await assertActiveTenantExecution\(supabase, "resend"\)/, "Resend execution must recheck tenant state immediately before returning a provider client");
for (const source of ["google-connect", "google", "gmail-send"]) {
  assert.ok(google.includes(`assertActiveTenantExecution(supabase, "${source}")`), `Google execution is missing the ${source} lifecycle guard`);
}

console.log(JSON.stringify({ result: "passed", databaseGuard: true, providerGuards: 4 }));
