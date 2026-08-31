import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const migration = readFileSync("migrations/20260830-tenant-public-boundaries.sql", "utf8");
for (const invariant of [
  "encrypted_credentials JSONB",
  "credential_version INTEGER",
  "environment_fallback_allowed BOOLEAN",
  "tenant_id = public.accelerate_default_tenant_id()",
  'CREATE POLICY "Tenant ingest metadata create"',
  'CREATE POLICY "Tenant ingest metadata rotate"',
]) assert.ok(migration.includes(invariant), `tenant provider migration is missing ${invariant}`);

const ingest = readFileSync("src/lib/tenancy/ingest.ts", "utf8");
for (const invariant of [
  'tenant.status !== "active"',
  'key.surfaces.includes(surface)',
  "key.allowed_origins.includes(origin)",
  "rateLimit(`tenant-ingest:${key.id}`",
  'createHash("sha256").update(token)',
  "createServiceRoleClient(context)",
]) assert.ok(ingest.includes(invariant), `tenant ingest resolver is missing ${invariant}`);

const directServiceClients = execFileSync("rg", ["-l", "createClient\\(|SUPABASE_SERVICE_ROLE_KEY", "src/app/api"], { encoding: "utf8" })
  .trim().split("\n").filter((file) => file && !file.includes("/admin/setup/"));
for (const file of directServiceClients) {
  const source = readFileSync(file, "utf8");
  assert.doesNotMatch(source, /createClient\([\s\S]{0,180}SUPABASE_SERVICE_ROLE_KEY/, `${file} bypasses the tenant system database boundary`);
}

const publicRoute = readFileSync("src/app/api/public/[tenantSlug]/intake/[surface]/route.ts", "utf8");
assert.ok(publicRoute.includes("authorizeTenantIngest(request, tenantSlug, surface)"), "tenant public route must authorize before mutation");
assert.ok(publicRoute.includes('onConflict: "tenant_id,event_id"'), "tenant analytics replay must be tenant-composite");
for (const surface of ["proposal/[token]", "unsubscribe/[token]"]) {
  const route = readFileSync(`src/app/api/public/[tenantSlug]/${surface}/route.ts`, "utf8");
  assert.ok(route.includes("resolveActiveTenantSystemContext"), `${surface} must resolve an active tenant before token lookup`);
}

const resend = readFileSync("src/lib/email/resend.ts", "utf8");
assert.ok(resend.includes("tenantId === ACCELERATE_TENANT_ID"), "environment email fallback must be Accelerate-only");
assert.ok(resend.includes("decryptSecret(encryptedApiKey)"), "tenant email credentials must be decrypted only at execution");
assert.ok(resend.includes('assertActiveTenantExecution(supabase, "resend")'), "Resend execution must recheck active tenant state after resolving context");

const emailPreview = readFileSync("src/app/api/admin/emails/preview/route.ts", "utf8");
assert.ok(emailPreview.includes("sendRecordedEmail(supabase"), "Email Studio test sends must use the canonical tenant-bound sender service");
assert.ok(emailPreview.includes("email-template-test:"), "Email Studio test-send retries need a deterministic provider idempotency key");
assert.ok(emailPreview.includes("InactiveTenantExecutionError"), "Email Studio must return an explicit suspended-workspace response");
assert.ok(emailPreview.includes("The test email delivery is recorded, but its audit receipt could not be written"), "Email Studio must distinguish a delivered email from a failed audit receipt");
assert.doesNotMatch(emailPreview, /emails\.send\(\{ from: FROM_EMAIL/, "tenant Email Studio must never inherit the bootstrap sender");

const communications = readFileSync("src/lib/revenue-os/communications.ts", "utf8");
assert.match(communications, /try \{[\s\S]*getTenantResend\(supabase\)[\s\S]*emails\.send[\s\S]*catch \(error\) \{/, "provider resolution and delivery must share one failure-receipt boundary");
assert.match(communications, /update\(\{\s*status: "failed"/, "provider failures must terminate the claimed message receipt");
assert.ok(communications.includes("Email provider did not return a confirmed delivery identifier"), "a provider 2xx response without an immutable provider ID must not be marked sent");
assert.ok(communications.includes("did not produce a confirmed provider receipt"), "an uncertain provider outcome must instruct reconciliation before retry");
assert.ok(communications.includes("provider accepted the message but its local receipt could not be recorded"), "a provider-accepted send must never be reported as safely retryable without reconciliation");

const calendlyHandler = readFileSync("src/app/api/webhooks/calendly/route.ts", "utf8");
assert.ok(calendlyHandler.includes("scheduledAt && isBootstrapTenant"), "client Calendly webhooks must not send the bootstrap-only roofing prep email");
assert.ok(calendlyHandler.includes('"New Calendly booking"'), "client Calendly notifications need neutral tenant-safe copy");

for (const webhook of ["resend", "calendly"]) {
  const route = readFileSync(`src/app/api/public/[tenantSlug]/webhooks/${webhook}/route.ts`, "utf8");
  assert.ok(route.includes(`resolveTenantProviderSecrets(tenantSlug, "${webhook}")`), `${webhook} webhook must resolve tenant-owned credentials before processing`);
  assert.ok(route.includes("runWithTenantRequestContext(provider.context"), `${webhook} webhook must execute inside its tenant context`);
}

for (const cron of ["google-workspace-sync", "revenue-campaigns", "system-health-snapshot"]) {
  const route = readFileSync(`src/app/api/cron/${cron}/route.ts`, "utf8");
  assert.ok(route.includes("listTenantSystemContexts"), `${cron} must enumerate bounded tenant work`);
  assert.ok(route.includes("runWithTenantRequestContext"), `${cron} must isolate every tenant run`);
  assert.ok(route.includes('status: "failed"'), `${cron} must contain one tenant failure without aborting the batch`);
}

const googleAuthorize = readFileSync("src/app/api/admin/google/authorize/route.ts", "utf8");
const googleCallback = readFileSync("src/app/api/admin/google/callback/route.ts", "utf8");
assert.ok(googleAuthorize.includes("tenantId: auth.tenant.id"), "Google OAuth state must bind tenant identity");
assert.ok(googleCallback.includes("verifyGoogleOAuthStateBinding(encodedState, { state, tenantId: auth.tenant.id, tenantSlug: auth.tenant.slug })"), "Google callback must verify signed state against the active tenant context");

const providerApi = readFileSync("src/app/api/admin/tenant/providers/route.ts", "utf8");
assert.ok(providerApi.includes("credentialVersion = Number(existing?.credential_version || 0) + 1"), "provider credential rotations must increment their version");
assert.ok(providerApi.includes("recordAudit"), "provider credential changes must be audited without returning secrets");
assert.ok(providerApi.includes('action: z.literal("configure_openrouter")'), "tenant administrators must be able to configure OpenRouter");
assert.ok(providerApi.includes("validateOpenRouterApiKey"), "OpenRouter keys must be verified before storage");
assert.ok(providerApi.includes('encryptTenantSecret(parsed.data.apiKey.trim(), authorization.tenant.id, "openrouter", "api_key")'), "OpenRouter ciphertext must bind the active tenant and provider field");
assert.ok(providerApi.includes("environment_fallback_allowed: false"), "tenant BYOK must disable platform credential fallback");
const providerUi = readFileSync("src/components/admin/TenantProviderControls.tsx", "utf8");
assert.ok(providerUi.includes('type={visible ? "text" : "password"}'), "provider credential entry must default to masked and expose an explicit reveal control");
assert.ok(providerUi.includes("credential_version"), "provider controls must expose the active credential version without returning the secret");
assert.ok(providerUi.includes("Signed webhook endpoint"), "provider controls must expose the canonical tenant-bound webhook endpoint");
assert.ok(providerUi.includes("Disconnect provider"), "provider disconnect must require a deliberate confirmation surface");
assert.ok(providerUi.includes('name="OpenRouter"'), "provider controls must expose tenant OpenRouter BYOK");
assert.ok(providerUi.includes("Your key, your spend"), "OpenRouter controls must make cost ownership explicit");

const openRouterGateway = readFileSync("src/lib/ai/openrouter.ts", "utf8");
assert.ok(openRouterGateway.includes("resolveOpenRouterCredential(input.database)"), "production OpenRouter traffic must resolve a tenant credential");
assert.ok(openRouterGateway.includes('process.env.NODE_ENV === "production"'), "unscoped production OpenRouter calls must fail closed");

console.log(JSON.stringify({ result: "passed", checkedApiFiles: directServiceClients.length, signedSurfaces: 2 }));
