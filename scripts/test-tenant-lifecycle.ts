import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const migration = readFileSync("migrations/20260831-tenant-lifecycle-rpcs.sql", "utf8");
const invitationReceiptMigration = readFileSync("migrations/20260831-tenant-invitation-receipt-idempotency.sql", "utf8");
const service = readFileSync("src/lib/tenancy/lifecycle.ts", "utf8");
const route = readFileSync("src/app/api/admin/tenants/route.ts", "utf8");
const directory = readFileSync("src/app/admin/tenants/page.tsx", "utf8");
const callback = readFileSync("src/app/auth/callback/route.ts", "utf8");
const templates = readFileSync("src/lib/email/templates.ts", "utf8");
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
assert.match(invitationReceiptMigration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_audit_tenant_invitation_request/, "invitation delivery receipts must be replay-idempotent in PostgreSQL");
assert.match(invitationReceiptMigration, /metadata ->> 'request_id'/, "invitation receipt idempotency must bind the API request identity");
assert.ok(service.includes('error?.code === "23505"'), "an exact invitation receipt replay must return the existing successful outcome");
assert.ok(service.includes("existing?.email_confirmed_at"), "an unconfirmed invited Auth user must never become an active tenant member on retry");
assert.ok(service.includes("page <= 100"), "Auth user reconciliation must use a bounded paginated lookup");
assert.ok(service.includes("warning: \"Workspace created safely"), "partial provisioning must return a truthful retryable warning");
assert.ok(service.includes("class TenantLifecycleError"), "tenant lifecycle failures must expose a stable typed contract");
assert.ok(service.includes("auth.admin.generateLink"), "invitation delivery must use a server-generated one-time token");
assert.doesNotMatch(service, /inviteUserByEmail/, "tenant invitations must not depend on Supabase's restricted default SMTP delivery");
assert.ok(service.includes('existing ? "magiclink" as const : "invite" as const'), "unconfirmed accounts must receive a fresh usable magic link");
assert.ok(service.includes("tenant.invitation.${input.status}"), "invitation outcomes must create an immutable platform audit receipt");
assert.ok(service.includes("providerReceiptId"), "successful invitation responses must contain a truthful provider receipt");
assert.ok(service.includes("email provider outcome is unknown"), "uncertain provider outcomes must not be reported as safe failures");
assert.ok(service.includes("idempotencyKey: `tenant-invite:${input.tenantId}:${invitation.userId}:${input.requestId}`"), "provider retry safety must bind tenant, user, and request identity");
assert.ok(service.includes('.eq("slug", input.tenantSlug)'), "invitation activation must bind the requested tenant id to its canonical slug");
assert.ok(route.includes("createTenantWorkspace"), "tenant route must delegate creation to the lifecycle service");
assert.ok(route.includes("setTenantLifecycleStatus"), "tenant route must delegate transitions to the lifecycle service");
assert.ok(route.includes("error instanceof TenantLifecycleError"), "tenant route must preserve lifecycle HTTP semantics without parsing raw errors");
assert.doesNotMatch(route, /duplicate\|unique|error instanceof Error \? error\.message/, "tenant route must not expose or classify raw infrastructure errors");
assert.doesNotMatch(route, /platform_audit_log|tenant_memberships"\)\.upsert/, "tenant route must not coordinate lifecycle writes itself");
assert.ok(route.includes("NEXT_PUBLIC_SITE_URL"), "emailed invitation links must use the configured public origin rather than an untrusted request host");
assert.ok(directory.includes("toast.warning(result.warning)"), "the operator must see partial provisioning instead of a false success");
assert.ok(directory.includes("Resend invitation to"), "every pending invitation must expose an accessible recovery action");
assert.ok(directory.includes("requestId: crypto.randomUUID()"), "every invite attempt must carry a stable request identity to the API");
assert.ok(callback.includes('type === "invite" || type === "magiclink"'), "the callback must accept both new-user invitations and unconfirmed-account retries");
assert.ok(callback.includes("activateInvitedTenantMembership"), "the callback must delegate exact membership activation to the lifecycle service");
assert.doesNotMatch(callback, /from\("tenant_memberships"\)[\s\S]{0,200}\.update\(/, "the callback must not activate memberships through an unaudited direct write");
assert.ok(templates.includes("tenantAdminInvitationEmail"), "tenant invitations must use a branded first-party email template");
assert.match(setup, /20260831-tenant-lifecycle-rpcs\.sql/, "setup order must include atomic tenant lifecycle RPCs");

console.log(JSON.stringify({ result: "passed", atomicLifecycleFunctions: 4, hardDeletes: 0 }));
